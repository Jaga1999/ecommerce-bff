import { Test, TestingModule } from '@nestjs/testing';
import { TodoOwnershipPipe } from './todo-ownership.pipe';
import { TodosRepository } from '../../todos/todos.repository';
import { REQUEST } from '@nestjs/core';
import {
  NotFoundException,
  ArgumentMetadata,
  ForbiddenException,
} from '@nestjs/common';
import { Todo } from '../../todos/todo.entity';

describe('TodoOwnershipPipe', () => {
  let pipe: TodoOwnershipPipe;
  let findByIdMock: jest.SpyInstance;
  const mockRequest = {
    user: { id: 'u1', username: 'testuser', roles: ['user'] },
    method: 'GET',
    url: '/',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TodoOwnershipPipe,
        {
          provide: TodosRepository,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: REQUEST,
          useValue: mockRequest,
        },
      ],
    }).compile();

    pipe = await module.resolve<TodoOwnershipPipe>(TodoOwnershipPipe);
    const repository = module.get<TodosRepository>(TodosRepository);
    findByIdMock = jest.spyOn(repository, 'findById');
  });

  it('should be defined', () => {
    expect(pipe).toBeDefined();
  });

  it('should return todo if user is owner', async () => {
    const mockTodo = { id: 't1', ownerId: 'u1' } as Todo;
    findByIdMock.mockResolvedValue(mockTodo);

    const metadata: ArgumentMetadata = { type: 'param', data: 'id' };
    const result = await pipe.transform('t1', metadata);

    expect(result).toBe(mockTodo);
    expect(findByIdMock).toHaveBeenCalledWith('t1');
  });

  it('should throw NotFoundException if todo not found', async () => {
    findByIdMock.mockResolvedValue(null);
    const metadata: ArgumentMetadata = { type: 'param', data: 'id' };

    await expect(pipe.transform('invalid', metadata)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw ForbiddenException if user is not owner', async () => {
    const mockTodo = { id: 't1', ownerId: 'other-user' } as Todo;
    findByIdMock.mockResolvedValue(mockTodo);
    const metadata: ArgumentMetadata = { type: 'param', data: 'id' };

    await expect(pipe.transform('t1', metadata)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should return todo if user is admin even if not owner', async () => {
    mockRequest.user.roles = ['admin'];
    const mockTodo = { id: 't1', ownerId: 'other-user' } as Todo;
    findByIdMock.mockResolvedValue(mockTodo);
    const metadata: ArgumentMetadata = { type: 'param', data: 'id' };

    const result = await pipe.transform('t1', metadata);

    expect(result).toBe(mockTodo);
  });
});
