import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role, RoleHierarchy } from '../enums/role.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Request } from 'express';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user: AuthenticatedUser }>();
    const user = request.user;

    this.logger.debug(
      `Checking roles for user: ${user?.username || 'unknown'}`,
    );

    if (!user || !user.roles) {
      this.logger.warn(
        `Access denied: User or roles missing for user: ${user?.username || 'unknown'}`,
      );
      throw new ForbiddenException('User roles not found');
    }

    const hasRole = requiredRoles.some((role) =>
      user.roles.some((userRole) => {
        const normalizedUserRole = userRole.toLowerCase() as Role;
        const normalizedRequiredRole = role.toLowerCase() as Role;

        // Exact match or inherited via hierarchy
        return (
          normalizedUserRole === normalizedRequiredRole ||
          (RoleHierarchy[normalizedUserRole] &&
            RoleHierarchy[normalizedUserRole].includes(normalizedRequiredRole))
        );
      }),
    );

    if (!hasRole) {
      this.logger.warn(
        `Access denied for user ${user.username}. Required: [${requiredRoles.join(', ')}], Found: [${user.roles.join(', ')}]`,
      );
      throw new ForbiddenException(
        `Requires one of the following roles: ${requiredRoles.join(', ')}`,
      );
    }

    this.logger.debug(
      `Access granted for user ${user.username} with roles [${user.roles.join(', ')}]`,
    );
    return true;
  }
}
