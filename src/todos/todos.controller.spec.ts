import { Test, TestingModule } from '@nestjs/testing';
import { TodosController } from './todos.controller';
import { TodosService } from './todos.service';
import { TodoOwnershipPipe } from '../common/pipes/todo-ownership.pipe';
import { Todo } from './todo.entity';
import { AuthenticatedUser } from '../auth/interfaces/auth.interface';

describe('TodosController', () => {
  let controller: TodosController;
  let service: TodosService;

  const mockTodo = {
    id: 't1',
    title: 'T1',
    description: 'D1',
    completed: false,
    ownerId: 'u1',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Todo;

  const mockUser: AuthenticatedUser = {
    id: 'u1',
    username: 'user1',
    email: 'u1@e.com',
    roles: ['user'],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TodosController],
      providers: [
        {
          provide: TodosService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            update: jest.fn(),
            updateFromObject: jest.fn(),
            removeFromObject: jest.fn(),
          },
        },
      ],
    })
      .overridePipe(TodoOwnershipPipe)
      .useValue({ transform: (value: Todo) => value })
      .compile();

    controller = module.get<TodosController>(TodosController);
    service = module.get<TodosService>(TodosService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new todo', async () => {
      const dto = { title: 'New Todo', description: 'desc' };
      const createSpy = jest
        .spyOn(service, 'create')
        .mockResolvedValue({ id: 't1', ...dto } as unknown as Todo);

      const result = await controller.create(dto, mockUser);

      expect(createSpy).toHaveBeenCalledWith(dto, mockUser);
      expect(result.id).toBe('t1');
    });
  });

  describe('findAll', () => {
    it('should return todos for current user', async () => {
      const mockTodos = [mockTodo];
      const findAllSpy = jest
        .spyOn(service, 'findAll')
        .mockResolvedValue(mockTodos);

      const result = await controller.findAll(mockUser);

      expect(findAllSpy).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual(mockTodos);
    });
  });

  describe('findOne', () => {
    it('should return the todo passed by the pipe', () => {
      const result = controller.findOne(mockTodo);
      expect(result).toEqual(mockTodo);
    });
  });

  describe('update', () => {
    it('should update todo from object', async () => {
      const updateDto = { title: 'Updated' };
      const updateSpy = jest
        .spyOn(service, 'updateFromObject')
        .mockResolvedValue({ ...mockTodo, ...updateDto } as unknown as Todo);

      const result = await controller.update(mockTodo, updateDto);

      expect(updateSpy).toHaveBeenCalledWith(mockTodo, updateDto);
      expect(result.title).toBe('Updated');
    });
  });

  describe('remove', () => {
    it('should remove todo from object', async () => {
      const removeSpy = jest
        .spyOn(service, 'removeFromObject')
        .mockResolvedValue(undefined);

      await controller.remove(mockTodo);

      expect(removeSpy).toHaveBeenCalledWith(mockTodo);
    });
  });
});
