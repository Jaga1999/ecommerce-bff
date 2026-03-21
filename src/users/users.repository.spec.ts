import { Test, TestingModule } from '@nestjs/testing';
import { UsersRepository } from './users.repository';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './user.entity';
import { Repository } from 'typeorm';

describe('UsersRepository', () => {
  let repository: UsersRepository;
  let ormRepository: Repository<User>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersRepository,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    repository = module.get<UsersRepository>(UsersRepository);
    ormRepository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findByUsernameOrEmail', () => {
    it('should call findOne with correct parameters', async () => {
      const findOneSpy = jest
        .spyOn(ormRepository, 'findOne')
        .mockResolvedValue(null);
      await repository.findByUsernameOrEmail('user', 'email');
      expect(findOneSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: [{ username: 'user' }, { email: 'email' }],
        }),
      );
    });

    it('should throw error if findOne fails', async () => {
      jest
        .spyOn(ormRepository, 'findOne')
        .mockRejectedValue(new Error('DB Error'));
      await expect(repository.findByUsernameOrEmail('u', 'e')).rejects.toThrow(
        'DB Error',
      );
    });
  });

  describe('save', () => {
    it('should throw error if save fails', async () => {
      jest
        .spyOn(ormRepository, 'save')
        .mockRejectedValue(new Error('Save failed'));
      await expect(repository.save({} as User)).rejects.toThrow('Save failed');
    });
  });
});
