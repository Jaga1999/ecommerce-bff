import { Test, TestingModule } from '@nestjs/testing';
import { MigrationService } from './migration.service';
import { DataSource, QueryRunner } from 'typeorm';
import { Logger } from '@nestjs/common';

describe('MigrationService', () => {
  let service: MigrationService;
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  beforeEach(async () => {
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      query: jest.fn(),
    } as unknown as QueryRunner;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MigrationService,
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(queryRunner),
            options: { migrationsTableName: 'migrations' },
            migrations: [],
          },
        },
      ],
    }).compile();

    service = module.get<MigrationService>(MigrationService);
    dataSource = module.get<DataSource>(DataSource);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('runMigrations', () => {
    it('should log success if no migrations pending', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (dataSource as any).migrations = [];
      const loggerSpy = jest.spyOn(Logger.prototype, 'log');

      await service.runMigrations();

      expect(loggerSpy).toHaveBeenCalledWith(
        'Database migration process completed. Proceeding to application startup.',
      );
    });

    it('should run migrations successfully', async () => {
      const migration = {
        name: 'M1',
        up: jest.fn().mockResolvedValue(undefined),
        timestamp: 123,
      };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (dataSource as any).migrations = [migration];

      const qr: any = queryRunner;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      qr.query.mockResolvedValue([]);

      await service.runMigrations();

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(qr.startTransaction).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(qr.commitTransaction).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(qr.release).toHaveBeenCalled();
      expect(migration.up).toHaveBeenCalled();
    });

    it('should rollback transaction on failure', async () => {
      const failingMigration = {
        name: 'FailingMigration',
        up: jest.fn().mockRejectedValue(new Error('Fail')),
        timestamp: 456,
      };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (dataSource as any).migrations = [failingMigration];

      const qr: any = queryRunner;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      qr.query.mockResolvedValue([]);

      await expect(service.runMigrations()).rejects.toThrow('Fail');

      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(qr.rollbackTransaction).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(qr.release).toHaveBeenCalled();
    });
  });
});
