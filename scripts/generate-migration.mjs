import { execSync } from 'child_process';

const migrationName = process.argv[2] || 'NewMigration';
const dataSourcePath = 'src/database/data-source.ts';
const migrationDir = 'src/migrations';

const command = `npm run typeorm -- migration:generate -d ${dataSourcePath} ${migrationDir}/${migrationName}`;

try {
  console.log(`Executing: ${command}`);
  execSync(command, { stdio: 'inherit' });
} catch (error) {
  process.exit(1);
}
