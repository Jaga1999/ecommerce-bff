import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { HttpService } from '@nestjs/axios';
import { UsersService } from '../users/users.service';
import { KeycloakProperties } from '../config/properties/keycloak.properties';
import { AppProperties } from '../config/properties/app.properties';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { of, throwError } from 'rxjs';
import { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import * as jwt from 'jsonwebtoken';
import { AuthenticationFailedException } from '../common/exceptions';
import { User } from '../users/user.entity';
import { Role } from '../common/enums/role.enum';
import {
  KeycloakProfile,
  KeycloakTokenResponse,
} from './interfaces/auth.interface';
import { Cache } from 'cache-manager';

jest.mock('jsonwebtoken');
jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

describe('AuthService', () => {
  let service: AuthService;
  let httpPostMock: jest.SpyInstance;
  let httpGetMock: jest.SpyInstance;
  let httpPutMock: jest.SpyInstance;
  let upsertUserMock: jest.SpyInstance;
  let updateProfileMock: jest.SpyInstance;
  let findByUsernameOrEmailMock: jest.SpyInstance;
  let findByIdMock: jest.SpyInstance;
  let cacheSetMock: jest.SpyInstance;
  let cacheGetMock: jest.SpyInstance;
  let cacheDelMock: jest.SpyInstance;

  const mockKeycloakProps = {
    serverUrl: 'http://keycloak:8080',
    realm: 'test-realm',
    clientId: 'test-client',
    clientSecret: 'test-secret',
    adminClientId: 'admin-cli',
    adminUser: 'admin',
    adminPass: 'admin',
    externalUrl: 'http://external-keycloak',
  } as KeycloakProperties;

  const createAxiosResponse = <T>(
    data: T,
    status = 200,
    headers = {},
  ): AxiosResponse<T> =>
    ({
      data,
      status,
      statusText: 'OK',
      headers,
      config: {} as InternalAxiosRequestConfig,
    }) as AxiosResponse<T>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: HttpService,
          useValue: {
            post: jest.fn(),
            get: jest.fn(),
            put: jest.fn(),
          },
        },
        {
          provide: UsersService,
          useValue: {
            upsertUser: jest.fn(),
            findByUsernameOrEmail: jest.fn(),
            findById: jest.fn(),
            updateProfile: jest.fn(),
          },
        },
        {
          provide: KeycloakProperties,
          useValue: mockKeycloakProps,
        },
        {
          provide: AppProperties,
          useValue: {
            port: 8080,
            contextPath: '/api',
            dashboardUrl: 'http://dashboard',
            frontendUrl: 'http://frontend',
            nodeEnv: 'test',
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            set: jest.fn(),
            get: jest.fn(),
            del: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    const httpService = module.get<HttpService>(HttpService);
    const usersService = module.get<UsersService>(UsersService);
    const cacheManager = module.get<Cache>(CACHE_MANAGER);

    httpPostMock = jest.spyOn(httpService, 'post');
    httpGetMock = jest.spyOn(httpService, 'get');
    httpPutMock = jest.spyOn(httpService, 'put');
    upsertUserMock = jest.spyOn(usersService, 'upsertUser');
    updateProfileMock = jest.spyOn(usersService, 'updateProfile');
    findByUsernameOrEmailMock = jest.spyOn(
      usersService,
      'findByUsernameOrEmail',
    );
    findByIdMock = jest.spyOn(usersService, 'findById');
    cacheSetMock = jest.spyOn(cacheManager, 'set');
    cacheGetMock = jest.spyOn(cacheManager, 'get');
    cacheDelMock = jest.spyOn(cacheManager, 'del');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should successfully login and return session info', async () => {
      const mockTokens: KeycloakTokenResponse = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        id_token: 'id-token',
        expires_in: 3600,
        refresh_expires_in: 7200,
        token_type: 'Bearer',
        'not-before-policy': 0,
        session_state: 'state',
        scope: 'openid',
      };

      const mockProfile: KeycloakProfile = {
        sub: 'user-id',
        preferred_username: 'testuser',
        email: 'test@example.com',
        email_verified: true,
      };

      const mockResponse = createAxiosResponse(mockTokens);

      httpPostMock.mockReturnValue(of(mockResponse));
      httpGetMock.mockReturnValue(of(createAxiosResponse([{ id: 'user1' }])));
      (jwt.decode as jest.Mock).mockReturnValue(
        mockProfile as unknown as jwt.JwtPayload,
      );
      upsertUserMock.mockResolvedValue({
        id: 'u1',
        username: 'testuser',
        email: 'test@example.com',
      } as unknown as User);

      const result = await service.login({
        username: 'testuser',
        password: 'password',
        rememberMe: true,
      });

      expect(httpPostMock).toHaveBeenCalled();
      expect(jwt.decode as jest.Mock).toHaveBeenCalled();
      expect(upsertUserMock).toHaveBeenCalled();
      expect(result.sessionId).toBe('test-uuid');
      expect(result.user.username).toBe('testuser');
      expect(cacheSetMock).toHaveBeenCalled();
    });

    it('should throw AuthenticationFailedException on invalid credentials', async () => {
      const mockErrorResponse = {
        data: { error_description: 'Invalid user credentials' },
      };

      httpPostMock.mockImplementation(() => {
        const error = new Error();

        const errObj: any = error;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        errObj.isAxiosError = true;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        errObj.response = mockErrorResponse;
        throw error;
      });

      httpGetMock.mockReturnValue(of(createAxiosResponse([{ id: 'user1' }])));

      await expect(
        service.login({ username: 'user', password: 'wrong' }),
      ).rejects.toThrow(AuthenticationFailedException);
    });
  });

  describe('googleLogin', () => {
    it('should return correct Google auth URL', () => {
      const result = service.googleLogin();
      expect(result.url).toContain('kc_idp_hint=google');
      expect(result.url).toContain(
        'redirect_uri=http%3A%2F%2Flocalhost%3A8080%2Fapi%2Fauth%2Fcallback',
      );
    });
  });

  describe('handleCallback', () => {
    it('should exchange code for tokens and create session', async () => {
      const mockTokens = {
        access_token: 'at',
        refresh_token: 'rt',
        id_token: 'it',
      };
      const mockProfile = { sub: 's1', preferred_username: 'u1', email: 'e1' };

      httpPostMock.mockReturnValue(of(createAxiosResponse(mockTokens)));
      (jwt.decode as jest.Mock).mockReturnValue(mockProfile);
      upsertUserMock.mockResolvedValue({ id: 'u1', username: 'u1' } as any);

      const result = await service.handleCallback('code123');
      expect(result.sessionId).toBe('test-uuid');
      expect(result.user.username).toBe('u1');
    });

    it('should throw AuthenticationFailedException on failure', async () => {
      httpPostMock.mockReturnValue(
        throwError(() => new Error('Exchange failed')),
      );
      await expect(service.handleCallback('code123')).rejects.toThrow(
        AuthenticationFailedException,
      );
    });
  });

  describe('logout', () => {
    it('should call keycloak logout and delete session from cache', async () => {
      cacheGetMock.mockResolvedValue({ refreshToken: 'ref-token' });
      httpPostMock.mockReturnValue(of(createAxiosResponse({})));

      await service.logout('test-session');

      expect(cacheGetMock).toHaveBeenCalled();
      expect(httpPostMock).toHaveBeenCalled();
      expect(cacheDelMock).toHaveBeenCalled();
    });
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      findByUsernameOrEmailMock.mockResolvedValue(null);
      // admin token
      httpPostMock.mockReturnValueOnce(
        of(createAxiosResponse({ access_token: 'at' })),
      );

      // userExistsInKeycloak
      httpGetMock.mockReturnValueOnce(of(createAxiosResponse([])));
      httpGetMock.mockReturnValueOnce(of(createAxiosResponse([])));

      // create user
      httpPostMock.mockReturnValueOnce(
        of(createAxiosResponse({}, 201, { location: '/kc-id' })),
      );
      // assign role - find role
      httpGetMock.mockReturnValueOnce(
        of(createAxiosResponse([{ name: 'user', id: 'rid' }])),
      );
      // assign role - post mapping
      httpPostMock.mockReturnValueOnce(of(createAxiosResponse({}, 204)));
      upsertUserMock.mockResolvedValue({ id: 'u2' } as unknown as User);

      const result = await service.register({
        username: 'nu',
        email: 'n@e.com',
        password: 'p',
      });
      expect(result.message).toBe('User registered successfully');
      expect(upsertUserMock).toHaveBeenCalled();
    });
  });

  describe('updateUserRole', () => {
    it('should update role', async () => {
      findByIdMock.mockResolvedValue({ keycloakId: 'kc' } as unknown as User);
      // admin token
      httpPostMock.mockReturnValueOnce(
        of(createAxiosResponse({ access_token: 'at' })),
      );
      // find role
      httpGetMock.mockReturnValueOnce(
        of(createAxiosResponse([{ name: 'admin', id: 'rid' }])),
      );
      // assign role
      httpPostMock.mockReturnValueOnce(of(createAxiosResponse({}, 204)));
      upsertUserMock.mockResolvedValue({ id: 'u1' } as unknown as User);

      const result = await service.updateUserRole('u1', Role.ADMIN);
      expect(result.message).toContain('successfully');
    });
  });

  describe('updateProfile', () => {
    it('should call keycloak and update local DB', async () => {
      const user = {
        id: 'u1',
        username: 'testuser',
        keycloakId: 'kc',
        email: 'e',
        roles: [{ name: 'user' }],
      };
      findByIdMock.mockResolvedValue(user);

      // admin token
      httpPostMock.mockReturnValueOnce(
        of(createAxiosResponse({ access_token: 'at' })),
      );

      // fetch keycloak user
      httpGetMock.mockReturnValueOnce(of(createAxiosResponse({ id: 'kc' })));

      // update keycloak user
      httpPutMock.mockReturnValueOnce(of(createAxiosResponse({})));

      updateProfileMock.mockResolvedValue({
        ...user,
        firstName: 'New',
      } as unknown as User);

      const result = await service.updateProfile('u1', { firstName: 'New' });

      expect(httpPutMock).toHaveBeenCalled();
      expect(updateProfileMock).toHaveBeenCalledWith('u1', 'New', undefined);
      expect(result.message).toBe('Profile updated successfully');
      expect(result.user.username).toBe('testuser');
    });
  });
});
