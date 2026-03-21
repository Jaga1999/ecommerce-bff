import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './role.entity';

@Injectable()
export class RolesRepository {
  private readonly logger: Logger;

  constructor(
    @InjectRepository(Role)
    private readonly repository: Repository<Role>,
  ) {
    this.logger = new Logger(RolesRepository.name);
  }

  async findByName(name: string): Promise<Role | null> {
    this.logger.debug(`Searching for role by name: ${name}`);
    return this.repository.findOne({ where: { name } });
  }

  async save(role: Role): Promise<Role> {
    this.logger.log(`Saving role: ${role.name}`);
    return this.repository.save(role);
  }

  create(roleData: Partial<Role>): Role {
    this.logger.debug('Creating new role instance');
    return this.repository.create(roleData);
  }
}
