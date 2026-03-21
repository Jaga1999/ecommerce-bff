import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from './user.entity';
import { Role } from './role.entity';
import { UsersRepository } from './users.repository';
import { RolesRepository } from './roles.repository';
import type { KeycloakProfile } from '../auth/interfaces/auth.interface';

@Injectable()
export class UsersService {
  private readonly logger: Logger;

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly rolesRepository: RolesRepository,
    private readonly dataSource: DataSource,
  ) {
    this.logger = new Logger(UsersService.name);
  }

  async findByUsernameOrEmail(
    username: string,
    email: string,
  ): Promise<User | null> {
    this.logger.debug(
      `Looking up user by username: ${username} or email: ${email}`,
    );
    const user = await this.usersRepository.findByUsernameOrEmail(
      username,
      email,
    );
    if (user) {
      this.logger.debug(`User found: ${user.username} (ID: ${user.id})`);
    } else {
      this.logger.debug(`User not found for: ${username}/${email}`);
    }
    return user;
  }

  async upsertUser(
    keycloakId: string,
    profile: KeycloakProfile,
    rolesNames: string[],
  ): Promise<User> {
    try {
      // Use the injected dataSource for transactions as requested
      return await this.dataSource.transaction(async (manager) => {
        // 1. Get or create roles
        const roleEntities: Role[] = [];
        for (const name of rolesNames) {
          let role = await manager.findOne(Role, { where: { name } });
          if (!role) {
            role = manager.create(Role, { name });
            role = await manager.save(Role, role);
          }
          roleEntities.push(role);
        }

        // 2. Find existing user
        let user = await manager.findOne(User, {
          where: { keycloakId },
          relations: ['roles'],
        });

        const userData = {
          username: profile.preferred_username || profile.email || profile.sub,
          email:
            profile.email || `${profile.preferred_username}@no-email.internal`,
          firstName: profile.given_name || '',
          lastName: profile.family_name || '',
          roles: roleEntities,
        };

        if (user) {
          // Update
          this.logger.log(
            `Updating existing user in local DB: ${userData.username} (Keycloak ID: ${keycloakId})`,
          );
          Object.assign(user, userData);
          return await manager.save(User, user);
        }

        // Create
        this.logger.log(
          `Creating new user in local DB: ${userData.username} (Keycloak ID: ${keycloakId})`,
        );
        user = manager.create(User, {
          keycloakId,
          ...userData,
        });
        return await manager.save(User, user);
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error in upsertUser: ${message}`);
      throw new InternalServerErrorException('Failed to sync user profile');
    }
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findByUsername(username);
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.findAll();
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findById(id);
  }

  async updateProfile(
    id: string,
    firstName?: string,
    lastName?: string,
  ): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;

    return await this.usersRepository.save(user);
  }
}
