import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Todo } from './todo.entity';

@Injectable()
export class TodosRepository {
  private readonly logger: Logger;

  constructor(
    @InjectRepository(Todo)
    private readonly repository: Repository<Todo>,
  ) {
    this.logger = new Logger(TodosRepository.name);
  }

  create(todoData: Partial<Todo>): Todo {
    this.logger.debug('Creating new todo instance');
    return this.repository.create(todoData);
  }

  async save(todo: Todo): Promise<Todo> {
    this.logger.log(`Saving todo: ${todo.title}`);
    try {
      return await this.repository.save(todo);
    } catch (error: unknown) {
      this.logger.error(
        `Error saving todo: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  async findAll(ownerId: string, isAdmin: boolean): Promise<Todo[]> {
    this.logger.debug(`Fetching todos: ownerId=${ownerId}, isAdmin=${isAdmin}`);
    if (isAdmin) {
      return this.repository.find({ relations: ['owner'] });
    }
    return this.repository.find({
      where: { ownerId },
      relations: ['owner'],
    });
  }

  async findById(id: string): Promise<Todo | null> {
    this.logger.debug(`Searching for todo by ID: ${id}`);
    return this.repository.findOne({
      where: { id },
      relations: ['owner'],
    });
  }

  async remove(todo: Todo): Promise<void> {
    this.logger.warn(`Removing todo: ${todo.id} (${todo.title})`);
    try {
      await this.repository.remove(todo);
    } catch (error: unknown) {
      this.logger.error(
        `Error removing todo: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }
}
