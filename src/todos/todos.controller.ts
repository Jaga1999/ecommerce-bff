import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Logger,
  Patch,
} from '@nestjs/common';
import { TodosService } from './todos.service';
import { CreateTodoDto } from './dto/create-todo.dto';
import { UpdateTodoDto } from './dto/update-todo.dto';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { TodoOwnershipPipe } from '../common/pipes/todo-ownership.pipe';
import { Todo } from './todo.entity';
import type { AuthenticatedUser } from '../auth/interfaces/auth.interface';

@ApiTags('todos')
@ApiBearerAuth()
@Controller('todos')
export class TodosController {
  private readonly logger: Logger;
  constructor(private readonly todosService: TodosService) {
    this.logger = new Logger(TodosController.name);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new todo' })
  create(
    @Body() createTodoDto: CreateTodoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.todosService.create(createTodoDto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Get all todos for current user' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.todosService.findAll(user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one todo' })
  findOne(@Param('id', TodoOwnershipPipe) todo: Todo) {
    return todo;
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a todo' })
  update(
    @Param('id', TodoOwnershipPipe) todo: Todo,
    @Body() updateTodoDto: UpdateTodoDto,
  ) {
    return this.todosService.updateFromObject(todo, updateTodoDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a todo' })
  remove(@Param('id', TodoOwnershipPipe) todo: Todo) {
    return this.todosService.removeFromObject(todo);
  }
}
