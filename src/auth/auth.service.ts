import {
  Injectable,
  InternalServerErrorException,
  ConflictException,
  NotFoundException,
  Inject,
  Logger,
  HttpException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { KeycloakProperties } from '../config/properties/keycloak.properties';
import { AppProperties } from '../config/properties/app.properties';
import type { Cache } from 'cache-manager';
import { lastValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Role } from '../common/enums/role.enum';
import {
  KeycloakProfile,
  KeycloakTokenResponse,
  KeycloakAdminToken,
  KeycloakRole,
  AuthResult,
} from './interfaces/auth.interface';
import { AuthenticationFailedException } from '../common/exceptions';
import axios from 'axios';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthService {
  private readonly logger: Logger;

  constructor(
    private readonly httpService: HttpService,
    private readonly usersService: UsersService,
    private readonly keycloakProps: KeycloakProperties,
    private readonly appProps: AppProperties,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    this.logger = new Logger(AuthService.name);
  }

  async login(loginDto: LoginDto): Promise<AuthResult> {
    const { username, password, rememberMe } = loginDto;
    const tokenUrl = `${this.getRealmUrl()}/protocol/openid-connect/token`;

    try {
      this.logger.debug(`Attempting login for user: ${username}`);

      const { access_token: adminToken } = await this.getAdminToken();
      const exists = await this.userExistsInKeycloak(
        username,
        username,
        adminToken,
      );
      if (!exists) {
        throw new NotFoundException('User not found');
      }

      const params = new URLSearchParams({
        grant_type: 'password',
        client_id: this.keycloakProps.clientId,
        client_secret: this.keycloakProps.clientSecret,
        username,
        password,
        scope: 'openid profile email',
      });

      const response = await lastValueFrom(
        this.httpService.post<KeycloakTokenResponse>(tokenUrl, params, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );

      return this.processTokenResponse(response.data, !!rememberMe);
    } catch (error: unknown) {
      this.handleAuthError('Login', error, tokenUrl);
    }
  }

  private handleAuthError(
    context: string,
    error: unknown,
    url?: string,
  ): never {
    if (error instanceof HttpException) {
      throw error;
    }

    this.logger.error(
      `${context} error: ${error instanceof Error ? error.message : 'Unknown error'}${url ? ` (URL: ${url})` : ''}`,
    );
    if (axios.isAxiosError(error) && error.response) {
      const errorData = error.response.data as Record<string, unknown>;
      this.logger.error(`Keycloak error data: ${JSON.stringify(errorData)}`);

      const errorDescription =
        typeof errorData?.errorMessage === 'string'
          ? errorData.errorMessage
          : typeof errorData?.error_description === 'string'
            ? errorData.error_description
            : error.message;
      throw new AuthenticationFailedException(`${context} failed`, [
        errorDescription,
      ]);
    }
    throw new AuthenticationFailedException(`${context} failed`);
  }

  private getRealmUrl(): string {
    return `${this.keycloakProps.serverUrl}/realms/${this.keycloakProps.realm}`;
  }

  private getAdminRealmUrl(): string {
    return `${this.keycloakProps.serverUrl}/admin/realms/${this.keycloakProps.realm}`;
  }

  private getAdminMasterUrl(): string {
    return `${this.keycloakProps.serverUrl}/realms/master`;
  }

  private mergeTokenClaims(
    idClaims: Record<string, unknown> | null,
    accessClaims: Record<string, unknown> | null,
  ): KeycloakProfile | null {
    const merged = { ...(accessClaims || {}), ...(idClaims || {}) } as Record<
      string,
      unknown
    >;
    if (!merged.sub || typeof merged.sub !== 'string') return null;

    const realmAccess = merged.realm_access as { roles?: string[] } | undefined;
    const resourceAccess = merged.resource_access as
      | Record<string, { roles?: string[] }>
      | undefined;

    return {
      sub: merged.sub,
      preferred_username: (merged.preferred_username as string) || '',
      email: (merged.email as string) || '',
      email_verified: !!merged.email_verified,
      given_name: merged.given_name as string | undefined,
      family_name: merged.family_name as string | undefined,
      realm_access: realmAccess?.roles
        ? { roles: realmAccess.roles }
        : undefined,
      resource_access: resourceAccess
        ? Object.fromEntries(
            Object.entries(resourceAccess).map(([k, v]) => [
              k,
              { roles: v?.roles ?? [] },
            ]),
          )
        : undefined,
      roles: merged.roles as string[] | undefined,
    };
  }

  private async processTokenResponse(
    tokens: KeycloakTokenResponse,
    rememberMe: boolean,
  ): Promise<AuthResult> {
    const idClaims = (
      tokens.id_token ? jwt.decode(tokens.id_token) : null
    ) as Record<string, unknown> | null;
    const accessClaims = jwt.decode(tokens.access_token) as Record<
      string,
      unknown
    > | null;

    const profile = this.mergeTokenClaims(idClaims, accessClaims);
    if (!profile?.sub) {
      throw new AuthenticationFailedException(
        'Invalid token: missing profile information',
      );
    }

    const username = profile.preferred_username || profile.email || profile.sub;
    const email = profile.email || `${username}@no-email.internal`;
    const roles = this.extractRoles(profile);

    const user = await this.usersService.upsertUser(
      profile.sub,
      { ...profile, preferred_username: username, email },
      roles,
    );

    const sessionId = uuidv4();
    const ttl = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 3600000;
    const sessionData = this.createSessionData(tokens, user, roles);

    await this.cacheManager.set(`session:${sessionId}`, sessionData, ttl);
    this.logger.log(
      `Session created in cache for user: ${username}, sessionId: ${sessionId}`,
    );

    return { sessionId, user: sessionData.user };
  }

  private extractRoles(profile: KeycloakProfile): string[] {
    const roles = new Set<string>([
      ...(profile.realm_access?.roles || []),
      ...(profile.resource_access?.[this.keycloakProps.clientId]?.roles || []),
      ...(profile.roles || []),
    ]);
    if (roles.size === 0) roles.add(Role.USER);
    return Array.from(roles);
  }

  private createSessionData(
    tokens: KeycloakTokenResponse,
    user: User,
    roles: string[],
  ) {
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      userId: user.id,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        roles,
      },
    };
  }

  async logout(sessionId: string): Promise<void> {
    const session = await this.cacheManager.get<{ refreshToken: string }>(
      `session:${sessionId}`,
    );
    if (!session) {
      this.logger.warn(`Logout attempt for non-existent session: ${sessionId}`);
      return;
    }

    this.logger.debug(`Logging out session: ${sessionId}`);
    const logoutUrl = `${this.getRealmUrl()}/protocol/openid-connect/logout`;
    const params = new URLSearchParams({
      client_id: this.keycloakProps.clientId,
      client_secret: this.keycloakProps.clientSecret,
      refresh_token: session.refreshToken,
    });

    try {
      await lastValueFrom(this.httpService.post(logoutUrl, params));
      this.logger.log(
        `Successfully logged out from Keycloak for session: ${sessionId}`,
      );
    } catch (error: unknown) {
      this.logger.error(
        `Keycloak logout error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      await this.cacheManager.del(`session:${sessionId}`);
      this.logger.debug(`Session deleted from cache: ${sessionId}`);
    }
  }

  async register(registerDto: RegisterDto): Promise<{ message: string }> {
    const { username, email, firstName, lastName, password } = registerDto;
    this.logger.log(`Registering new user: ${username} (${email})`);

    await this.ensureUserDoesNotExistLocally(username, email);

    this.logger.debug(`Obtaining admin token for Keycloak operations`);
    const { access_token: adminToken } = await this.getAdminToken();

    await this.ensureUserDoesNotExistInKeycloak(username, email, adminToken);

    if (!password)
      throw new InternalServerErrorException('Password is required');

    this.logger.debug(`Creating user ${username} in Keycloak`);
    const keycloakUserId = await this.createKeycloakUser(
      username,
      email,
      firstName ?? '',
      lastName ?? '',
      password,
      adminToken,
    );

    this.logger.debug(
      `Assigning role ${Role.USER} to user ${username} in Keycloak`,
    );
    await this.assignRoleToUser(keycloakUserId, Role.USER, adminToken);

    this.logger.debug(`Syncing user ${username} to local DB`);
    await this.usersService.upsertUser(
      keycloakUserId,
      this.mapToProfile(keycloakUserId, username, email, firstName, lastName),
      [Role.USER],
    );

    this.logger.log(`User registered successfully: ${username}`);
    return { message: 'User registered successfully' };
  }

  private mapToProfile(
    sub: string,
    username: string,
    email: string,
    firstName?: string,
    lastName?: string,
  ): KeycloakProfile {
    return {
      sub,
      preferred_username: username,
      email,
      given_name: firstName,
      family_name: lastName,
      email_verified: false,
    };
  }

  private async ensureUserDoesNotExistLocally(username: string, email: string) {
    const existingUser = await this.usersService.findByUsernameOrEmail(
      username,
      email,
    );
    if (existingUser) {
      this.logger.warn(
        `Registration failed: User already exists in local DB: ${username}`,
      );
      throw new ConflictException('User already exists');
    }
  }

  private async ensureUserDoesNotExistInKeycloak(
    username: string,
    email: string,
    adminToken: string,
  ) {
    const existsInKeycloak = await this.userExistsInKeycloak(
      username,
      email,
      adminToken,
    );
    if (existsInKeycloak) {
      this.logger.warn(
        `Registration failed: User already exists in Keycloak: ${username}`,
      );
      throw new ConflictException('User already exists in identity provider');
    }
  }

  private async userExistsInKeycloak(
    username: string,
    email: string,
    adminToken: string,
  ): Promise<boolean> {
    const url = `${this.getAdminRealmUrl()}/users`;
    const headers = { Authorization: `Bearer ${adminToken}` };

    try {
      const [userRes, emailRes] = await Promise.all([
        lastValueFrom(
          this.httpService.get<any[]>(url, {
            params: { username, exact: true },
            headers,
          }),
        ),
        lastValueFrom(
          this.httpService.get<any[]>(url, {
            params: { email, exact: true },
            headers,
          }),
        ),
      ]);
      return userRes.data?.length > 0 || emailRes.data?.length > 0;
    } catch (error: unknown) {
      this.logger.error(
        `Error checking user in Keycloak: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return false;
    }
  }

  private async createKeycloakUser(
    username: string,
    email: string,
    firstName: string,
    lastName: string,
    password: string,
    adminToken: string,
  ): Promise<string> {
    const url = `${this.getAdminRealmUrl()}/users`;
    const userData = {
      username,
      email,
      firstName,
      lastName,
      enabled: true,
      credentials: [{ type: 'password', value: password, temporary: false }],
    };

    try {
      const response = await lastValueFrom(
        this.httpService.post(url, userData, {
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
        }),
      );

      const location = response.headers.location as string;
      return location.split('/').pop() || '';
    } catch (error: unknown) {
      this.handleAuthError('Keycloak user creation', error, url);
    }
  }

  /**
   * Compute redirect URI from config (aligned with Java KeycloakProperties).
   * Matches: http://localhost:${APP_PORT:8080}${BFF_CONTEXT_PATH:/api}/auth/callback
   */
  private getRedirectUri(): string {
    const { port, contextPath } = this.appProps;
    const cleanContextPath = contextPath.startsWith('/')
      ? contextPath
      : `/${contextPath}`;
    return `http://localhost:${port}${cleanContextPath}/auth/callback`;
  }

  googleLogin(): { url: string } {
    const callbackUrl = encodeURIComponent(this.getRedirectUri());
    // Use external URL - browser redirect must reach Keycloak (localhost, not keycloak:8080)
    const url = `${this.keycloakProps.externalUrl}/realms/${this.keycloakProps.realm}/protocol/openid-connect/auth?client_id=${this.keycloakProps.clientId}&response_type=code&scope=openid profile email&redirect_uri=${callbackUrl}&kc_idp_hint=google`;
    return { url };
  }

  async handleCallback(code: string): Promise<AuthResult> {
    const tokenUrl = `${this.getRealmUrl()}/protocol/openid-connect/token`;
    const callbackUrl = this.getRedirectUri();

    try {
      this.logger.debug(
        `OAuth callback: tokenUrl=${tokenUrl}, redirect_uri=${callbackUrl}`,
      );

      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.keycloakProps.clientId,
        client_secret: this.keycloakProps.clientSecret,
        code,
        redirect_uri: callbackUrl,
      });

      const response = await lastValueFrom(
        this.httpService.post<KeycloakTokenResponse>(tokenUrl, params, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );

      return this.processTokenResponse(response.data, false);
    } catch (error: unknown) {
      this.handleAuthError('OAuth callback', error, tokenUrl);
    }
  }

  async createUser(
    registerDto: RegisterDto,
    role: Role,
  ): Promise<{ message: string }> {
    const { username, email, firstName, lastName, password } = registerDto;

    await this.ensureUserDoesNotExistLocally(username, email);

    const { access_token: adminToken } = await this.getAdminToken();
    if (!password)
      throw new InternalServerErrorException('Password is required');

    const keycloakUserId = await this.createKeycloakUser(
      username,
      email,
      firstName || '',
      lastName || '',
      password,
      adminToken,
    );

    await this.assignRoleToUser(keycloakUserId, role, adminToken);

    await this.usersService.upsertUser(
      keycloakUserId,
      {
        ...this.mapToProfile(
          keycloakUserId,
          username,
          email,
          firstName,
          lastName,
        ),
        email_verified: true,
      },
      [role.toLowerCase()],
    );

    return { message: `User with role ${role} created successfully` };
  }

  async updateUserRole(
    userId: string,
    role: Role,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const { access_token: adminToken } = await this.getAdminToken();

    await this.assignRoleToUser(user.keycloakId, role, adminToken);

    await this.usersService.upsertUser(
      user.keycloakId,
      {
        ...this.mapToProfile(
          user.keycloakId,
          user.username,
          user.email,
          user.firstName,
          user.lastName,
        ),
        email_verified: true,
      },
      [role.toLowerCase()],
    );

    return { message: `User role updated to ${role} successfully` };
  }

  private async assignRoleToUser(
    userId: string,
    roleName: string,
    adminToken: string,
  ): Promise<void> {
    const realmRolesUrl = `${this.getAdminRealmUrl()}/roles`;
    const userRoleUrl = `${this.getAdminRealmUrl()}/users/${userId}/role-mappings/realm`;
    const headers = { Authorization: `Bearer ${adminToken}` };

    try {
      const rolesRes = await lastValueFrom(
        this.httpService.get<KeycloakRole[]>(realmRolesUrl, { headers }),
      );
      const role = rolesRes.data.find(
        (r) => r.name.toLowerCase() === roleName.toLowerCase(),
      );

      if (!role) {
        this.logger.warn(`Role ${roleName} not found in Keycloak realm`);
        return;
      }

      await lastValueFrom(
        this.httpService.post(userRoleUrl, [role], {
          headers: { ...headers, 'Content-Type': 'application/json' },
        }),
      );
    } catch (error: unknown) {
      this.handleAuthError(
        `Keycloak role assignment (${roleName})`,
        error,
        userRoleUrl,
      );
    }
  }

  private async getAdminToken(): Promise<KeycloakAdminToken> {
    const url = `${this.getAdminMasterUrl()}/protocol/openid-connect/token`;
    const params = new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: this.keycloakProps.adminUser,
      password: this.keycloakProps.adminPass,
    });

    try {
      const response = await lastValueFrom(
        this.httpService.post<KeycloakAdminToken>(url, params, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }),
      );
      return response.data;
    } catch (error: unknown) {
      this.handleAuthError('Keycloak admin token', error, url);
    }
  }

  async updateProfile(
    userId: string,
    updateDto: UpdateProfileDto,
  ): Promise<{ message: string; user: AuthResult['user'] }> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const { access_token: adminToken } = await this.getAdminToken();
    const url = `${this.getAdminRealmUrl()}/users/${user.keycloakId}`;

    if (updateDto.firstName !== undefined || updateDto.lastName !== undefined) {
      this.logger.debug(
        `Updating user profile in Keycloak for ${user.username}`,
      );
      let kcUser: Record<string, unknown>;
      try {
        const getRes = await lastValueFrom(
          this.httpService.get<Record<string, unknown>>(url, {
            headers: { Authorization: `Bearer ${adminToken}` },
          }),
        );
        kcUser = getRes.data;
      } catch (error: unknown) {
        this.handleAuthError('Keycloak user fetch', error, url);
      }

      const payload = {
        username: kcUser.username,
        email: kcUser.email,
        firstName:
          updateDto.firstName !== undefined
            ? updateDto.firstName
            : kcUser.firstName,
        lastName:
          updateDto.lastName !== undefined
            ? updateDto.lastName
            : kcUser.lastName,
      };

      try {
        await lastValueFrom(
          this.httpService.put(url, payload, {
            headers: {
              Authorization: `Bearer ${adminToken}`,
              'Content-Type': 'application/json',
            },
          }),
        );
      } catch (error: unknown) {
        this.handleAuthError('Keycloak user update', error, url);
      }
    }

    const updatedDbUser = await this.usersService.updateProfile(
      user.id,
      updateDto.firstName,
      updateDto.lastName,
    );

    return {
      message: 'Profile updated successfully',
      user: {
        id: updatedDbUser.id,
        username: updatedDbUser.username,
        email: updatedDbUser.email,
        roles: updatedDbUser.roles.map((r) => r.name),
      },
    };
  }
}
