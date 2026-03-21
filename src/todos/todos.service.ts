import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Todo } from './todo.entity';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { AuthenticatedUser } from '../auth/interfaces/auth.interface';
import { TodosRepository } from './todos.repository';

@Injectable()
export class TodosService {
  private readonly logger: Logger;

  constructor(private readonly todosRepository: TodosRepository) {
    this.logger = new Logger(TodosService.name);
  }

  async create(
    createTodoDto: CreateTodoDto,
    user: AuthenticatedUser,
  ): Promise<Todo> {
    return this.todosRepository.save(
      this.todosRepository.create({
        title: createTodoDto.title,
        description: createTodoDto.description || '',
        ownerId: user.id,
      }),
    );
  }

  async findAll(user: AuthenticatedUser): Promise<Todo[]> {
    const isAdmin = user.roles?.some((role: string) =>
      role.toLowerCase().includes('admin'),
    );
    return this.todosRepository.findAll(user.id, isAdmin);
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<Todo> {
    const todo = await this.todosRepository.findById(id);

    if (!todo) {
      throw new NotFoundException(`Todo with ID ${id} not found`);
    }

    const isAdmin = user.roles?.some((role: string) =>
      role.toLowerCase().includes('admin'),
    );

    if (todo.ownerId !== user.id && !isAdmin) {
      throw new ForbiddenException(
        'You do not have permission to access this todo',
      );
    }

    return todo;
  }

  async update(
    id: string,
    updateData: UpdateTodoDto,
    user: AuthenticatedUser,
  ): Promise<Todo> {
    const todo = await this.findOne(id, user);
    Object.assign(todo, updateData);
    return this.todosRepository.save(todo);
  }

  async updateFromObject(todo: Todo, updateData: UpdateTodoDto): Promise<Todo> {
    Object.assign(todo, updateData);
    return this.todosRepository.save(todo);
  }

  async removeFromObject(todo: Todo): Promise<void> {
    await this.todosRepository.remove(todo);
  }
}
