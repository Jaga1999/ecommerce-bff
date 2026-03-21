import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import type { Request } from 'express';
import { SessionProperties } from '../../config/properties/session.properties';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import {
  UserSession,
  AuthenticatedUser,
} from '../../auth/interfaces/auth.interface';
import { Logger } from '@nestjs/common';

@Injectable()
export class SessionGuard implements CanActivate {
  private readonly logger = new Logger(SessionGuard.name);

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private sessionProps: SessionProperties,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<
        Request & { session: UserSession; user: AuthenticatedUser }
      >();

    this.logger.debug(
      `Checking session for request: ${request.method} ${request.url}`,
    );

    const sessionIdHeader = this.sessionProps.idHeader;
    const cookieName = this.sessionProps.cookieName;

    const cookies = request.cookies as Record<string, string | undefined>;
    const sessionId = cookies[cookieName] || request.header(sessionIdHeader);

    if (!sessionId) {
      this.logger.warn(
        `Unauthorized: Session ID is missing for request: ${request.method} ${request.url}`,
      );
      throw new UnauthorizedException('Session ID is missing');
    }

    const sessionData = await this.cacheManager.get<string | UserSession>(
      `session:${sessionId}`,
    );
    if (!sessionData) {
      this.logger.warn(
        `Unauthorized: Session not found or expired for ID: ${sessionId}`,
      );
      return false;
    }

    this.logger.debug(`Session verified for ID: ${sessionId}`);

    const session: UserSession =
      typeof sessionData === 'string'
        ? (JSON.parse(sessionData) as UserSession)
        : sessionData;
    request.session = session;
    request.user = session.user;

    return true;
  }
}
