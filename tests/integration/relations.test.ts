/**
 * Integration tests for relations and graph edges
 *
 * Tests SurrealDB graph relations with custom fields.
 */

import { exec } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanupTestFiles, TEST_DATABASES } from './setup';

const execAsync = promisify(exec);

describe('Relations Integration Tests', () => {
  const CLI_PATH = path.join(process.cwd(), 'dist', 'cli.js');
  const TEST_CONFIG_PATH = path.join(process.cwd(), 'smig.config.ts');
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
      'smig.config.ts',
      'tests/integration/fixtures/relation-*.ts',
    ]);
  });

  afterEach(async () => {
    cleanupTestFiles([
      'smig-debug-*.txt',
      'smig.config.ts',
      'tests/integration/fixtures/relation-*.ts',
    ]);
  });

  function createSchema(name: string, content: string): string {
    const filename = `relation-${name}.ts`;
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

  describe('Basic relations', () => {
    it('should create simple relation between two tables', async () => {
      const dbName = `test_relation_simple_${Date.now()}`;

      const schemaPath = createSchema(
        'simple',
        `
import { defineSchema, defineRelation, composeSchema, string, datetime } from 'smig';

const user = defineSchema({
  table: 'rel_user',
  fields: {
    name: string().required(),
  }
});

const post = defineSchema({
  table: 'rel_post',
  fields: {
    title: string().required(),
  }
});

const authored = defineRelation({
  name: 'authored',
  from: 'rel_user',
  to: 'rel_post',
  fields: {
    createdAt: datetime().value('time::now()'),
  }
});

export default composeSchema({
  models: { rel_user: user, rel_post: post },
  relations: { authored }
});`,
      );

      createConfig(schemaPath, dbName);

      const { stdout } = await execAsync(`node ${CLI_PATH} generate --debug`);

      // Relations are defined with TYPE RELATION which auto-creates in/out fields
      expect(stdout).toContain('DEFINE TABLE authored TYPE RELATION IN rel_user OUT rel_post');
      // in/out fields are not explicitly defined when using TYPE RELATION
      expect(stdout).not.toContain('DEFINE FIELD in ON TABLE authored');
      expect(stdout).not.toContain('DEFINE FIELD out ON TABLE authored');

      // Apply
      const { stderr } = await execAsync(`node ${CLI_PATH} migrate`);
      expect(stderr).toContain('Migration applied successfully');

      // Verify
      const { stdout: verifyOutput } = await execAsync(`node ${CLI_PATH} generate`);
      expect(verifyOutput).toContain('No changes detected');
    }, 60000);

    it('should create self-referencing relation', async () => {
      const dbName = `test_relation_self_${Date.now()}`;

      const schemaPath = createSchema(
        'self-ref',
        `
import { defineSchema, defineRelation, composeSchema, string, datetime, bool } from 'smig';

const person = defineSchema({
  table: 'person',
  fields: {
    name: string().required(),
  }
});

const follows = defineRelation({
  name: 'follows',
  from: 'person',
  to: 'person',
  fields: {
    since: datetime().value('time::now()'),
    muted: bool().default(false),
  }
});

export default composeSchema({
  models: { person },
  relations: { follows }
});`,
      );

      createConfig(schemaPath, dbName);

      const { stdout } = await execAsync(`node ${CLI_PATH} generate --debug`);

      // Self-referencing relations use TYPE RELATION with same table for in/out
      expect(stdout).toContain('DEFINE TABLE follows TYPE RELATION IN person OUT person');
      // in/out fields are not explicitly defined when using TYPE RELATION
      expect(stdout).not.toContain('DEFINE FIELD in ON TABLE follows');
      expect(stdout).not.toContain('DEFINE FIELD out ON TABLE follows');
      expect(stdout).toContain('DEFINE FIELD muted');

      // Apply and verify
      const { stderr } = await execAsync(`node ${CLI_PATH} migrate`);
      expect(stderr).toContain('Migration applied successfully');
    }, 60000);

    it('should create relation with multiple custom fields', async () => {
      const dbName = `test_relation_fields_${Date.now()}`;

      const schemaPath = createSchema(
        'with-fields',
        `
import { defineSchema, defineRelation, composeSchema, string, int, float, datetime, bool } from 'smig';

const customer = defineSchema({
  table: 'customer',
  fields: {
    name: string().required(),
    email: string(),
  }
});

const product = defineSchema({
  table: 'product',
  fields: {
    name: string().required(),
    price: float().default(0.0),
  }
});

const purchased = defineRelation({
  name: 'purchased',
  from: 'customer',
  to: 'product',
  fields: {
    quantity: int().default(1),
    unitPrice: float(),
    totalPrice: float().computed('quantity * unitPrice'),
    purchasedAt: datetime().value('time::now()'),
    isGift: bool().default(false),
    giftMessage: string(),
  }
});

export default composeSchema({
  models: { customer, product },
  relations: { purchased }
});`,
      );

      createConfig(schemaPath, dbName);

      const { stdout } = await execAsync(`node ${CLI_PATH} generate --debug`);

      // Relations with custom fields use TYPE RELATION
      expect(stdout).toContain('DEFINE TABLE purchased TYPE RELATION IN customer OUT product');
      // in/out fields are not explicitly defined when using TYPE RELATION
      expect(stdout).not.toContain('DEFINE FIELD in ON TABLE purchased');
      expect(stdout).not.toContain('DEFINE FIELD out ON TABLE purchased');
      // Custom fields are still defined
      expect(stdout).toContain('DEFINE FIELD quantity');
      expect(stdout).toContain('DEFINE FIELD unitPrice');
      expect(stdout).toContain('DEFINE FIELD totalPrice');
      expect(stdout).toContain('DEFINE FIELD isGift');

      // Apply
      const { stderr } = await execAsync(`node ${CLI_PATH} migrate`);
      expect(stderr).toContain('Migration applied successfully');

      // Verify no remaining changes
      const { stdout: verifyOutput } = await execAsync(`node ${CLI_PATH} generate`);
      expect(verifyOutput).toContain('No changes detected');
    }, 60000);
  });

  describe('Relation modifications', () => {
    it('should detect field additions to relations', async () => {
      const dbName = `test_relation_add_field_${Date.now()}`;

      // Initial relation
      const v1 = createSchema(
        'add-field-v1',
        `
import { defineSchema, defineRelation, composeSchema, string, datetime } from 'smig';

const user = defineSchema({
  table: 'rel_user2',
  fields: { name: string() }
});

const item = defineSchema({
  table: 'rel_item',
  fields: { title: string() }
});

const owns = defineRelation({
  name: 'owns',
  from: 'rel_user2',
  to: 'rel_item',
  fields: {
    since: datetime().value('time::now()'),
  }
});

export default composeSchema({
  models: { rel_user2: user, rel_item: item },
  relations: { owns }
});`,
      );

      createConfig(v1, dbName);
      const { stderr: v1Stderr } = await execAsync(`node ${CLI_PATH} migrate`);
      expect(v1Stderr).toContain('Migration applied successfully');

      // Add field to relation
      const v2 = createSchema(
        'add-field-v2',
        `
import { defineSchema, defineRelation, composeSchema, string, datetime, int } from 'smig';

const user = defineSchema({
  table: 'rel_user2',
  fields: { name: string() }
});

const item = defineSchema({
  table: 'rel_item',
  fields: { title: string() }
});

const owns = defineRelation({
  name: 'owns',
  from: 'rel_user2',
  to: 'rel_item',
  fields: {
    since: datetime().value('time::now()'),
    quantity: int().default(1),
  }
});

export default composeSchema({
  models: { rel_user2: user, rel_item: item },
  relations: { owns }
});`,
      );

      createConfig(v2, dbName);

      // Should detect the new field
      const { stdout: diffOutput } = await execAsync(`node ${CLI_PATH} generate --debug`);
      expect(diffOutput).toContain('DEFINE FIELD quantity ON TABLE owns');

      // Apply and verify
      const { stderr: v2Stderr } = await execAsync(`node ${CLI_PATH} migrate`);
      expect(v2Stderr).toContain('Migration applied successfully');

      const { stdout: verifyOutput } = await execAsync(`node ${CLI_PATH} generate`);
      expect(verifyOutput).toContain('No changes detected');
    }, 90000);
  });
});
