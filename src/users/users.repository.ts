import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersRepository {
  private readonly logger: Logger;

  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {
    this.logger = new Logger(UsersRepository.name);
  }

  async findByUsernameOrEmail(
    username: string,
    email: string,
  ): Promise<User | null> {
    this.logger.debug(
      `Searching for user by username: ${username} or email: ${email}`,
    );
    try {
      return await this.repository.findOne({
        where: [{ username }, { email }],
        relations: ['roles'],
      });
    } catch (error: unknown) {
      this.logger.error(
        `Error finding user by username/email: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  async findByUsername(username: string): Promise<User | null> {
    this.logger.debug(`Searching for user by username: ${username}`);
    return this.repository.findOne({
      where: { username },
      relations: ['roles'],
    });
  }

  async findById(id: string): Promise<User | null> {
    this.logger.debug(`Searching for user by ID: ${id}`);
    return this.repository.findOne({
      where: { id },
      relations: ['roles'],
    });
  }

  async findAll(): Promise<User[]> {
    this.logger.debug('Fetching all users');
    return this.repository.find({ relations: ['roles'] });
  }

  async save(user: User): Promise<User> {
    this.logger.log(`Saving user: ${user.username}`);
    try {
      return await this.repository.save(user);
    } catch (error: unknown) {
      this.logger.error(
        `Error saving user: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  create(userData: Partial<User>): User {
    this.logger.debug('Creating new user instance');
    return this.repository.create(userData);
  }

  async findOneWithRoles(keycloakId: string): Promise<User | null> {
    this.logger.debug(
      `Searching for user with roles by Keycloak ID: ${keycloakId}`,
    );
    return this.repository.findOne({
      where: { keycloakId },
      relations: ['roles'],
    });
  }
}
