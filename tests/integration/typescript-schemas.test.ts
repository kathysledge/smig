/**
 * Integration tests for TypeScript schema files
 * 
 * Tests that smig can load and process .ts, .mts, .cts schema files
 * using jiti for zero-config TypeScript support.
 */

import { exec } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanupTestFiles, TEST_DATABASES } from './setup';

const execAsync = promisify(exec);

describe('TypeScript Schema Integration Tests', () => {
  const CLI_PATH = path.join(process.cwd(), 'dist', 'cli.js');
  const TEST_CONFIG_PATH = path.join(process.cwd(), 'smig.config.js');
  const FIXTURES_DIR = path.join(process.cwd(), 'tests', 'integration', 'fixtures');

  beforeAll(async () => {
    if (!fs.existsSync(CLI_PATH)) {
      throw new Error('CLI not built. Run "bun run build" first.');
    }
    if (!fs.existsSync(FIXTURES_DIR)) {
      fs.mkdirSync(FIXTURES_DIR, { recursive: true });
    }
  });

  beforeEach(async () => {
    cleanupTestFiles([
      'smig-debug-*.txt',
      'smig.config.js',
      'tests/integration/fixtures/ts-*.ts',
      'tests/integration/fixtures/ts-*.mts',
      'tests/integration/fixtures/ts-*.cts',
    ]);
  });

  afterEach(async () => {
    cleanupTestFiles([
      'smig-debug-*.txt',
      'smig.config.js',
      'tests/integration/fixtures/ts-*.ts',
      'tests/integration/fixtures/ts-*.mts',
      'tests/integration/fixtures/ts-*.cts',
    ]);
  });

  function createTsSchema(name: string, content: string, ext: string = 'ts'): string {
    const filename = `ts-${name}.${ext}`;
    const schemaPath = path.join(FIXTURES_DIR, filename);
    fs.writeFileSync(schemaPath, content);
    return `./tests/integration/fixtures/${filename}`;
  }

  function createConfig(schemaPath: string, dbName: string): void {
    const db = TEST_DATABASES.db1;
    const configContent = `
export default {
  url: '${db.url}',
  username: '${db.username}',
  password: '${db.password}',
  namespace: '${db.namespace}',
  database: '${dbName}',
  schema: '${schemaPath}'
};`;
    fs.writeFileSync(TEST_CONFIG_PATH, configContent);
  }

  it('should load and process .ts schema files', async () => {
    const dbName = `test_ts_schema_${Date.now()}`;

    const schemaPath = createTsSchema('basic', `
import { defineSchema, composeSchema, string, int, datetime } from '../../../dist/schema/concise-schema.js';

// TypeScript interfaces for type safety
interface UserFields {
  name: ReturnType<typeof string>;
  age: ReturnType<typeof int>;
  createdAt: ReturnType<typeof datetime>;
}

const user = defineSchema({
  table: 'ts_user',
  fields: {
    name: string().required(),
    age: int().default(0),
    createdAt: datetime().value('time::now()'),
  } satisfies UserFields
});

export default composeSchema({
  models: { ts_user: user },
  relations: {}
});
`, 'ts');

    createConfig(schemaPath, dbName);

    // Generate should work with TypeScript
    const { stdout } = await execAsync(`node ${CLI_PATH} generate --debug`);
    
    expect(stdout).toContain('DEFINE TABLE ts_user');
    expect(stdout).toContain('DEFINE FIELD name');
    expect(stdout).toContain('DEFINE FIELD age');
  }, 60000);

  it('should load and process .mts schema files', async () => {
    const dbName = `test_mts_schema_${Date.now()}`;

    const schemaPath = createTsSchema('module', `
import { defineSchema, composeSchema, string, bool } from '../../../dist/schema/concise-schema.js';

const settings = defineSchema({
  table: 'mts_settings',
  fields: {
    key: string().required(),
    enabled: bool().default(true),
  }
});

export default composeSchema({
  models: { mts_settings: settings },
  relations: {}
});
`, 'mts');

    createConfig(schemaPath, dbName);

    const { stdout } = await execAsync(`node ${CLI_PATH} generate --debug`);
    
    expect(stdout).toContain('DEFINE TABLE mts_settings');
    expect(stdout).toContain('DEFINE FIELD key');
    expect(stdout).toContain('DEFINE FIELD enabled');
  }, 60000);

  it('should apply migrations from TypeScript schemas', async () => {
    const dbName = `test_ts_migrate_${Date.now()}`;

    const schemaPath = createTsSchema('migrate', `
import { defineSchema, composeSchema, string, float } from '../../../dist/schema/concise-schema.js';

const product = defineSchema({
  table: 'ts_product',
  fields: {
    name: string().required(),
    price: float().default(0.0),
  }
});

export default composeSchema({
  models: { ts_product: product },
  relations: {}
});
`, 'ts');

    createConfig(schemaPath, dbName);

    // Apply migration from TypeScript schema
    const { stderr } = await execAsync(`node ${CLI_PATH} migrate`);
    
    expect(stderr).toContain('Migration applied successfully');

    // Verify no changes after migration
    const { stdout: verifyOutput } = await execAsync(`node ${CLI_PATH} generate`);
    expect(verifyOutput).toContain('No changes detected');
  }, 60000);

  it('should support TypeScript type annotations in schemas', async () => {
    const dbName = `test_ts_types_${Date.now()}`;

    const schemaPath = createTsSchema('typed', `
import { 
  defineSchema, 
  composeSchema, 
  string, 
  int,
  index,
  type SurrealDBSchema 
} from '../../../dist/schema/concise-schema.js';

// Use TypeScript enums
enum Status {
  Active = 'active',
  Inactive = 'inactive',
}

const item = defineSchema({
  table: 'ts_typed_item',
  fields: {
    name: string().required(),
    status: string().default(Status.Active),
    priority: int().default(0),
  },
  indexes: {
    statusIdx: index(['status']),
  }
});

// Type the export
const schema: SurrealDBSchema = composeSchema({
  models: { ts_typed_item: item },
  relations: {}
});

export default schema;
`, 'ts');

    createConfig(schemaPath, dbName);

    const { stdout } = await execAsync(`node ${CLI_PATH} generate --debug`);
    
    expect(stdout).toContain('DEFINE TABLE ts_typed_item');
    expect(stdout).toContain('DEFINE INDEX statusIdx');
  }, 60000);
});


