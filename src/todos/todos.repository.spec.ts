import { Test, TestingModule } from '@nestjs/testing';
import { TodosRepository } from './todos.repository';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Todo } from './todo.entity';
import { Repository } from 'typeorm';

describe('TodosRepository', () => {
  let repository: TodosRepository;
  let ormRepository: Repository<Todo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TodosRepository,
        {
          provide: getRepositoryToken(Todo),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
            findOne: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    repository = module.get<TodosRepository>(TodosRepository);
    ormRepository = module.get<Repository<Todo>>(getRepositoryToken(Todo));
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findAll', () => {
    it('should call find with ownerId if not admin', async () => {
      const findSpy = jest.spyOn(ormRepository, 'find').mockResolvedValue([]);
      await repository.findAll('u1', false);
      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ownerId: 'u1' } }),
      );
    });

    it('should call find without ownerId if admin', async () => {
      const findSpy = jest.spyOn(ormRepository, 'find').mockResolvedValue([]);
      await repository.findAll('u1', true);
      expect(findSpy).toHaveBeenCalledWith(
        expect.objectContaining({ relations: ['owner'] }),
      );
    });
  });

  describe('save', () => {
    it('should throw error if save fails', async () => {
      jest
        .spyOn(ormRepository, 'save')
        .mockRejectedValue(new Error('Save failed'));
      await expect(repository.save({} as Todo)).rejects.toThrow('Save failed');
    });
  });

  describe('remove', () => {
    it('should throw error if remove fails', async () => {
      jest
        .spyOn(ormRepository, 'remove')
        .mockRejectedValue(new Error('Remove failed'));
      await expect(repository.remove({} as Todo)).rejects.toThrow(
        'Remove failed',
      );
    });
  });
});
