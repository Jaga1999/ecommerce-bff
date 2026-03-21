import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm';
import type { User } from '../users/user.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @ManyToMany('User', 'roles')
  users: User[];
}
