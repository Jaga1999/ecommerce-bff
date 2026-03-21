import { Test, TestingModule } from '@nestjs/testing';
import { TodosService } from './todos.service';
import { TodosRepository } from './todos.repository';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Todo } from './todo.entity';
import { AuthenticatedUser } from '../auth/interfaces/auth.interface';

describe('TodosService', () => {
  let service: TodosService;
  let repository: TodosRepository;
  let saveMock: jest.SpyInstance;
  let createMock: jest.SpyInstance;
  let findAllMock: jest.SpyInstance;
  let findByIdMock: jest.SpyInstance;
  let removeMock: jest.SpyInstance;

  const mockUser: AuthenticatedUser = {
    id: 'u1',
    username: 'user1',
    email: 'u1@e.com',
    roles: ['user'],
  };
  const mockAdmin: AuthenticatedUser = {
    id: 'a1',
    username: 'admin1',
    email: 'a1@e.com',
    roles: ['admin'],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TodosService,
        {
          provide: TodosRepository,
          useValue: {
            save: jest.fn(),
            create: jest.fn(),
            findAll: jest.fn(),
            findById: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TodosService>(TodosService);
    repository = module.get<TodosRepository>(TodosRepository);

    saveMock = jest.spyOn(repository, 'save');
    createMock = jest.spyOn(repository, 'create');
    findAllMock = jest.spyOn(repository, 'findAll');
    findByIdMock = jest.spyOn(repository, 'findById');
    removeMock = jest.spyOn(repository, 'remove');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save a new todo', async () => {
      const dto = { title: 'T1', description: 'D1' };
      const mockTodo = { id: 't1', ...dto, ownerId: 'u1' } as unknown as Todo;
      createMock.mockReturnValue(mockTodo);
      saveMock.mockResolvedValue(mockTodo);

      const result = await service.create(dto, mockUser);

      expect(createMock).toHaveBeenCalled();
      expect(saveMock).toHaveBeenCalled();
      expect(result.id).toBe('t1');
    });
  });

  describe('findAll', () => {
    it('should return todos for owner', async () => {
      const mockTodos = [{ id: 't1', ownerId: 'u1' }] as unknown as Todo[];
      findAllMock.mockResolvedValue(mockTodos);

      const result = await service.findAll(mockUser);

      expect(findAllMock).toHaveBeenCalledWith('u1', false);
      expect(result).toEqual(mockTodos);
    });

    it('should return all todos for admin', async () => {
      const mockTodos = [{ id: 't1' }, { id: 't2' }] as unknown as Todo[];
      findAllMock.mockResolvedValue(mockTodos);

      const result = await service.findAll(mockAdmin);

      expect(findAllMock).toHaveBeenCalledWith('a1', true);
      expect(result).toEqual(mockTodos);
    });
  });

  describe('findOne', () => {
    it('should return todo if owner', async () => {
      const mockTodo = { id: 't1', ownerId: 'u1' } as unknown as Todo;
      findByIdMock.mockResolvedValue(mockTodo);

      const result = await service.findOne('t1', mockUser);
      expect(findByIdMock).toHaveBeenCalledWith('t1');
      expect(result).toEqual(mockTodo);
    });

    it('should throw NotFoundException if todo not found', async () => {
      findByIdMock.mockResolvedValue(null);
      await expect(service.findOne('invalid', mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if not owner and not admin', async () => {
      const mockTodo = { id: 't1', ownerId: 'other' } as unknown as Todo;
      findByIdMock.mockResolvedValue(mockTodo);
      await expect(service.findOne('t1', mockUser)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('update', () => {
    it('should update todo', async () => {
      const mockTodo = {
        id: 't1',
        ownerId: 'u1',
        title: 'Old',
      } as unknown as Todo;
      const updateDto = { title: 'New' };
      findByIdMock.mockResolvedValue(mockTodo);
      saveMock.mockResolvedValue({ ...mockTodo, ...updateDto });

      const result = await service.update('t1', updateDto, mockUser);
      expect(result.title).toBe('New');
    });
  });

  describe('updateFromObject', () => {
    it('should update todo from instance', async () => {
      const mockTodo = { id: 't1', title: 'Old' } as unknown as Todo;
      const updateDto = { title: 'New' };
      saveMock.mockResolvedValue({ ...mockTodo, ...updateDto });

      const result = await service.updateFromObject(mockTodo, updateDto);
      expect(result.title).toBe('New');
    });
  });

  describe('removeFromObject', () => {
    it('should remove todo', async () => {
      const todo = { id: 't1' } as unknown as Todo;
      removeMock.mockResolvedValue(todo);
      await service.removeFromObject(todo);
      expect(removeMock).toHaveBeenCalledWith(todo);
    });
  });
});
