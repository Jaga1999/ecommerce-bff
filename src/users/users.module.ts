import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { Role } from './role.entity';
import { UsersRepository } from './users.repository';
import { RolesRepository } from './roles.repository';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role])],
  providers: [UsersService, UsersRepository, RolesRepository],
  exports: [UsersService, UsersRepository, RolesRepository],
})
export class UsersModule {}
