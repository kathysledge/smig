/**
 * Integration tests for new entity types
 *
 * Tests params, sequences, access definitions, and other SurrealDB 3.x entities.
 */

import { exec } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanupTestFiles, TEST_DATABASES } from './setup';

const execAsync = promisify(exec);

describe('New Entity Types Integration Tests', () => {
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
      'tests/integration/fixtures/entity-*.ts',
    ]);
  });

  afterEach(async () => {
    cleanupTestFiles([
      'smig-debug-*.txt',
      'smig.config.js',
      'tests/integration/fixtures/entity-*.ts',
    ]);
  });

  function createSchema(name: string, content: string): string {
    const filename = `entity-${name}.ts`;
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

  describe('Params', () => {
    it('should create and migrate params', async () => {
      const dbName = `test_params_${Date.now()}`;

      const schemaPath = createSchema(
        'params',
        `
import { composeSchema, param } from '../../../dist/schema/concise-schema.js';

export default composeSchema({
  models: {},
  relations: {},
  params: {
    max_results: param('max_results').value('100'),
    app_name: param('app_name').value('"My App"'),
  }
});`,
      );

      createConfig(schemaPath, dbName);

      const { stdout } = await execAsync(`node ${CLI_PATH} generate --debug`);
      expect(stdout).toContain('DEFINE PARAM');
      expect(stdout).toContain('max_results');
      expect(stdout).toContain('100');
    }, 60000);
  });

  describe('Sequences', () => {
    it('should create sequences', async () => {
      const dbName = `test_sequences_${Date.now()}`;

      const schemaPath = createSchema(
        'sequences',
        `
import { composeSchema, sequence } from '../../../dist/schema/concise-schema.js';

export default composeSchema({
  models: {},
  relations: {},
  sequences: {
    order_number: sequence('order_number').start(1000).step(1),
  }
});`,
      );

      createConfig(schemaPath, dbName);

      const { stdout } = await execAsync(`node ${CLI_PATH} generate --debug`);

      expect(stdout).toContain('DEFINE SEQUENCE');
      expect(stdout).toContain('order_number');
      expect(stdout).toContain('START 1000');
    }, 60000);
  });

  describe('Functions', () => {
    it('should create custom functions', async () => {
      const dbName = `test_functions_${Date.now()}`;

      const schemaPath = createSchema(
        'functions',
        `
import { composeSchema, fn } from '../../../dist/schema/concise-schema.js';

const add = fn('fn::add')
  .param('a', 'int')
  .param('b', 'int')
  .returns('int')
  .body('RETURN $a + $b;');

export default composeSchema({
  models: {},
  relations: {},
  functions: {
    add,
  }
});`,
      );

      createConfig(schemaPath, dbName);

      const { stdout } = await execAsync(`node ${CLI_PATH} generate --debug`);

      expect(stdout).toContain('DEFINE FUNCTION');
      expect(stdout).toContain('fn::add');

      // Apply - function body quoting may vary between schema and introspection
      const { stderr } = await execAsync(`node ${CLI_PATH} migrate`);
      expect(stderr).toContain('Migration applied successfully');
    }, 60000);
  });

  describe('Analyzers', () => {
    it('should create custom analyzers', async () => {
      const dbName = `test_analyzers_${Date.now()}`;

      const schemaPath = createSchema(
        'analyzers',
        `
import { composeSchema, analyzer } from '../../../dist/schema/concise-schema.js';

const simple = analyzer('simple_text')
  .tokenizers(['blank'])
  .filters(['lowercase']);

export default composeSchema({
  models: {},
  relations: {},
  analyzers: {
    simple_text: simple,
  }
});`,
      );

      createConfig(schemaPath, dbName);

      const { stdout } = await execAsync(`node ${CLI_PATH} generate --debug`);

      expect(stdout).toContain('DEFINE ANALYZER');
      expect(stdout).toContain('simple_text');

      // Apply - analyzer tokenizer/filter ordering may vary
      const { stderr } = await execAsync(`node ${CLI_PATH} migrate`);
      expect(stderr).toContain('Migration applied successfully');
    }, 60000);
  });

  describe('Events', () => {
    it('should create table events', async () => {
      const dbName = `test_events_${Date.now()}`;

      const schemaPath = createSchema(
        'events',
        `
import { defineSchema, composeSchema, string, datetime, event } from '../../../dist/schema/concise-schema.js';

export default composeSchema({
  models: {
    order: defineSchema({
      table: 'order',
      fields: {
        status: string().default('pending'),
        createdAt: datetime().value('time::now()'),
      },
      events: {
        onStatusChange: event('status_change')
          .onUpdate()
          .when('$before.status != $after.status')
          .thenDo('CREATE audit_log SET table = "order", action = "status_change", data = { from: $before.status, to: $after.status }'),
        
        onCreate: event('order_created')
          .onCreate()
          .thenDo('UPDATE stats:orders SET count += 1'),
      }
    }),
    audit_log: defineSchema({
      table: 'audit_log',
      fields: {
        table: string(),
        action: string(),
        data: string(),
      }
    })
  },
  relations: {}
});`,
      );

      createConfig(schemaPath, dbName);

      const { stdout } = await execAsync(`node ${CLI_PATH} generate --debug`);

      expect(stdout).toContain('DEFINE EVENT');
      expect(stdout).toContain('status_change');
      expect(stdout).toContain('order_created');
      expect(stdout).toContain('WHEN');
      expect(stdout).toContain('THEN');

      // Apply
      const { stderr } = await execAsync(`node ${CLI_PATH} migrate`);
      expect(stderr).toContain('Migration applied successfully');
    }, 60000);
  });
});
