import { Injectable, Logger } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';

/**
 * Partial interface for TypeORM Migration to access common properties safely
 */
interface MigrationInstance {
  name: string;
  timestamp?: number;
  up(queryRunner: QueryRunner): Promise<void>;
}

@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);

  constructor(private readonly dataSource: DataSource) {}

  async runMigrations(): Promise<void> {
    this.logger.log('Database migration process started...');

    const queryRunner = this.dataSource.createQueryRunner('master');
    try {
      // 1. Get all migrations defined in the project
      // Cast to unknown then MigrationInstance[] to avoid 'any' lint errors
      const allMigrations = this.dataSource
        .migrations as unknown as MigrationInstance[];

      // 2. Get the migrations table name (defaults to "migrations")
      const migrationsTableName =
        this.dataSource.options.migrationsTableName || 'migrations';

      // 3. Get already executed migrations from the database
      let executedNames: Set<string>;
      try {
        const executed = (await queryRunner.query(
          `SELECT "name" FROM "${migrationsTableName}"`,
        )) as { name: string }[];
        executedNames = new Set(executed.map((m) => m.name));
      } catch {
        // If table doesn't exist, no migrations have been executed yet
        this.logger.debug(
          'Migrations table not found, assuming first run. Creating it...',
        );
        await queryRunner.query(
          `CREATE TABLE "${migrationsTableName}" (
            "id" SERIAL PRIMARY KEY,
            "timestamp" bigint NOT NULL,
            "name" character varying NOT NULL
          )`,
        );
        executedNames = new Set();
      }

      this.logger.debug(
        `Found ${allMigrations.length} total migrations and ${executedNames.size} already executed.`,
      );

      // 4. Iterate through all migrations and run ones that aren't executed yet
      for (const migration of allMigrations) {
        const name = migration.name || migration.constructor.name;

        this.logger.log(`Picking migration file: ${name}`);
        this.logger.log(
          `Checking if migration ${name} already exists in database...`,
        );

        if (executedNames.has(name)) {
          this.logger.log(`Migration ${name} already exists. Skipping.`);
        } else {
          this.logger.log(
            `Migration ${name} not found in database. Running migration...`,
          );

          await queryRunner.startTransaction();
          try {
            // Run the migration's "up" logic
            await migration.up(queryRunner);

            // Record the migration as executed
            const timestamp = migration.timestamp || Date.now();
            await queryRunner.query(
              `INSERT INTO "${migrationsTableName}" ("timestamp", "name") VALUES ($1, $2)`,
              [timestamp, name],
            );

            await queryRunner.commitTransaction();
            this.logger.log(`Migration ${name} successfully executed.`);
          } catch (error) {
            await queryRunner.rollbackTransaction();
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            this.logger.error(`Migration ${name} failed: ${errorMessage}`);
            throw error;
          }
        }
      }

      this.logger.log(
        'Database migration process completed. Proceeding to application startup.',
      );
    } finally {
      await queryRunner.release();
    }
  }
}
