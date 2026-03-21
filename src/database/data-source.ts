import 'dotenv/config'; // ✅ THIS is the fix

import { DataSource } from 'typeorm';
import { User } from '../users/user.entity';
import { Role } from '../users/role.entity';
import { Todo } from '../todos/todo.entity';

export default new DataSource({
  type: 'postgres',
  host: process.env.APP_DB_HOST,
  port: parseInt(process.env.APP_DB_PORT || '5432'),
  username: process.env.APP_DB_USER,
  password: process.env.APP_DB_PASSWORD,
  database: process.env.APP_DB_NAME,

  entities: [User, Role, Todo],

  migrations: ['src/migrations/*.ts'], // 👈 for generate
  synchronize: false,
});
