import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { RolesRepository } from './roles.repository';
import { DataSource, EntityManager } from 'typeorm';
import { User } from './user.entity';
import { Role } from './role.entity';
import type { KeycloakProfile } from '../auth/interfaces/auth.interface';

describe('UsersService', () => {
  let service: UsersService;
  let usersRepository: UsersRepository;
  let dataSource: DataSource;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UsersRepository,
          useValue: {
            findByUsername: jest.fn(),
            findByUsernameOrEmail: jest.fn(),
            findById: jest.fn(),
            findAll: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: RolesRepository,
          useValue: {
            findByName: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    usersRepository = module.get<UsersRepository>(UsersRepository);
    dataSource = module.get<DataSource>(DataSource);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByUsernameOrEmail', () => {
    it('should return a user if found', async () => {
      const mockUser = { id: '1', username: 'testuser' } as User;
      const findSpy = jest
        .spyOn(usersRepository, 'findByUsernameOrEmail')
        .mockResolvedValue(mockUser);

      const result = await service.findByUsernameOrEmail(
        'testuser',
        'test@e.com',
      );
      expect(result).toEqual(mockUser);
      expect(findSpy).toHaveBeenCalledWith('testuser', 'test@e.com');
    });
  });

  describe('upsertUser', () => {
    it('should create a new user if not exists', async () => {
      const mockManager = {
        findOne: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
      } as unknown as EntityManager;

      const transactionMock = jest.spyOn(dataSource, 'transaction');
      // Fix overload issue by handling both single and double argument calls
      transactionMock.mockImplementation((arg1: unknown, arg2?: unknown) => {
        const cb: any = typeof arg1 === 'function' ? arg1 : arg2;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
        return cb(mockManager);
      });

      const findOneMock = jest.spyOn(mockManager, 'findOne');
      const createMock = jest.spyOn(mockManager, 'create');
      const saveMock = jest.spyOn(mockManager, 'save');

      // 1. Mock role check
      findOneMock.mockResolvedValueOnce({
        id: 'r1',
        name: 'user',
      } as unknown as Role);
      // 2. Mock user check (not found)
      findOneMock.mockResolvedValueOnce(null);

      // Use any cast to avoid overload confusion
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      (createMock as any).mockReturnValue({
        keycloakId: 'kc-id',
        username: 'newuser',
        email: 'new@e.com',
        roles: [],
      } as unknown as User);

      saveMock.mockResolvedValue({
        id: 'u10',
        username: 'newuser',
        email: 'new@e.com',
      } as unknown as User);

      const profile: KeycloakProfile = {
        sub: 'kc-id',
        preferred_username: 'newuser',
        email: 'new@e.com',
        email_verified: true,
      };

      const result = await service.upsertUser('kc-id', profile, ['user']);

      expect(transactionMock).toHaveBeenCalled();
      expect(createMock).toHaveBeenCalled();
      expect(result.username).toBe('newuser');
    });
  });

  describe('findById', () => {
    it('should return a user by ID', async () => {
      const mockUser = { id: 'u1' } as User;
      const findByIdSpy = jest
        .spyOn(usersRepository, 'findById')
        .mockResolvedValue(mockUser);

      const result = await service.findById('u1');
      expect(result).toEqual(mockUser);
      expect(findByIdSpy).toHaveBeenCalledWith('u1');
    });
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      const mockUsers = [{ id: 'u1' }, { id: 'u2' }] as User[];
      const findAllSpy = jest
        .spyOn(usersRepository, 'findAll')
        .mockResolvedValue(mockUsers);

      const result = await service.findAll();
      expect(result).toEqual(mockUsers);
      expect(findAllSpy).toHaveBeenCalled();
    });
  });

  describe('updateProfile', () => {
    it('should update user first and last name', async () => {
      const mockUser = { id: 'u1', firstName: 'Old', lastName: 'Name' } as User;
      const findByIdSpy = jest
        .spyOn(service, 'findById')
        .mockResolvedValue(mockUser);

      const saveSpy = jest.spyOn(usersRepository, 'save').mockResolvedValue({
        ...mockUser,
        firstName: 'New',
        lastName: 'User',
      } as User);

      const result = await service.updateProfile('u1', 'New', 'User');

      expect(findByIdSpy).toHaveBeenCalledWith('u1');
      expect(mockUser.firstName).toBe('New');
      expect(mockUser.lastName).toBe('User');
      expect(saveSpy).toHaveBeenCalledWith(mockUser);
      expect(result.firstName).toBe('New');
    });
  });
});
