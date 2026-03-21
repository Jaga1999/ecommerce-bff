import {
  Injectable,
  PipeTransform,
  ArgumentMetadata,
  ForbiddenException,
  NotFoundException,
  Inject,
  Scope,
  Logger,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { TodosRepository } from '../../todos/todos.repository';
import { AuthenticatedUser } from '../../auth/interfaces/auth.interface';
import { Todo } from '../../todos/todo.entity';

@Injectable({ scope: Scope.REQUEST })
export class TodoOwnershipPipe implements PipeTransform<string, Promise<Todo>> {
  private readonly logger: Logger;

  constructor(
    @Inject(REQUEST)
    private readonly request: Request & { user: AuthenticatedUser },
    private readonly todosRepository: TodosRepository,
  ) {
    this.logger = new Logger(TodoOwnershipPipe.name);
  }

  async transform(value: string, metadata: ArgumentMetadata): Promise<Todo> {
    if (metadata.type !== 'param' || metadata.data !== 'id') {
      // This pipe is strictly for the 'id' parameter
      throw new Error(
        'TodoOwnershipPipe should only be used on the "id" parameter',
      );
    }

    this.logger.debug(`Checking ownership for todo ID: ${value}`);
    const user = this.request.user;
    if (!user) {
      this.logger.warn(
        `Access denied: User context missing for todo ID: ${value}`,
      );
      throw new ForbiddenException('User context missing');
    }

    const todo = await this.todosRepository.findById(value);
    if (!todo) {
      this.logger.warn(`Todo not found: ID ${value}`);
      throw new NotFoundException(`Todo with ID ${value} not found`);
    }

    const isAdmin = user.roles?.some((role: string) =>
      role.toLowerCase().includes('admin'),
    );

    if (todo.ownerId !== user.id && !isAdmin) {
      this.logger.warn(
        `Access denied: User ${user.id} attempted to access todo ${value} owned by ${todo.ownerId}`,
      );
      throw new ForbiddenException(
        'You do not have permission to access this todo',
      );
    }

    this.logger.debug(`Ownership verified for todo ID: ${value}`);

    return todo;
  }
}
