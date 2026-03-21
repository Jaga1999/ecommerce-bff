import { Test, TestingModule } from '@nestjs/testing';
import { RolesRepository } from './roles.repository';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Role } from './role.entity';
import { Repository } from 'typeorm';

describe('RolesRepository', () => {
  let repository: RolesRepository;
  let typeOrmRepository: Repository<Role>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesRepository,
        {
          provide: getRepositoryToken(Role),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    repository = module.get<RolesRepository>(RolesRepository);
    typeOrmRepository = module.get<Repository<Role>>(getRepositoryToken(Role));
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findByName', () => {
    it('should find role by name', async () => {
      const findOneSpy = jest.spyOn(typeOrmRepository, 'findOne');
      await repository.findByName('user');
      expect(findOneSpy).toHaveBeenCalledWith({
        where: { name: 'user' },
      });
    });
  });

  describe('save', () => {
    it('should delegate save to TypeORM repository', async () => {
      const role = { name: 'admin' } as unknown as Role;
      const saveSpy = jest.spyOn(typeOrmRepository, 'save');
      await repository.save(role);
      expect(saveSpy).toHaveBeenCalledWith(role);
    });
  });

  describe('create', () => {
    it('should delegate create to TypeORM repository', () => {
      const roleData = { name: 'admin' };
      const createSpy = jest.spyOn(typeOrmRepository, 'create');
      repository.create(roleData);
      expect(createSpy).toHaveBeenCalledWith(roleData);
    });
  });
});
