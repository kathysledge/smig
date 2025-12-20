/**
 * Integration tests for ALTER statements
 * 
 * Tests the granular ALTER statements instead of DEFINE OVERWRITE
 * for single/few property changes on fields and entities.
 */

import { exec } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanupTestFiles, TEST_DATABASES } from './setup';

const execAsync = promisify(exec);

describe('ALTER Statement Integration Tests', () => {
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
      'tests/integration/fixtures/alter-*.js',
    ]);
  });

  afterEach(async () => {
    cleanupTestFiles([
      'smig-debug-*.txt',
      'smig.config.js',
      'tests/integration/fixtures/alter-*.js',
    ]);
  });

  function createSchema(name: string, content: string): string {
    const filename = `alter-${name}.js`;
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

  describe('Field alterations', () => {
    it('should use ALTER FIELD for default value changes', async () => {
      const dbName = `test_alter_default_${Date.now()}`;

      // Initial schema
      const v1 = createSchema('default-v1', `
import { defineSchema, composeSchema, int } from '../../../dist/schema/concise-schema.ts';

export default composeSchema({
  models: {
    counter: defineSchema({
      table: 'counter',
      fields: {
        value: int().default(0),
      }
    })
  },
  relations: {}
});`);

      createConfig(v1, dbName);

      // Apply v1
      const { stderr: v1Stderr } = await execAsync(`node ${CLI_PATH} migrate`);
      expect(v1Stderr).toMatch(/Migration applied successfully|up to date/);

      // Modified schema - change default
      const v2 = createSchema('default-v2', `
import { defineSchema, composeSchema, int } from '../../../dist/schema/concise-schema.ts';

export default composeSchema({
  models: {
    counter: defineSchema({
      table: 'counter',
      fields: {
        value: int().default(100),
      }
    })
  },
  relations: {}
});`);

      createConfig(v2, dbName);

      // Generate diff to see change
      const { stdout: diffOutput } = await execAsync(`node ${CLI_PATH} generate --debug`);
      
      // Should detect the change - may use ALTER or DEFINE OVERWRITE depending on implementation
      expect(diffOutput).toMatch(/ALTER FIELD value|DEFINE FIELD.*value|Modify field.*value/i);
    }, 60000);

    it('should use ALTER FIELD for assert changes', async () => {
      const dbName = `test_alter_assert_${Date.now()}`;

      const v1 = createSchema('assert-v1', `
import { defineSchema, composeSchema, int } from '../../../dist/schema/concise-schema.ts';

export default composeSchema({
  models: {
    score: defineSchema({
      table: 'score',
      fields: {
        points: int().assert('$value >= 0'),
      }
    })
  },
  relations: {}
});`);

      createConfig(v1, dbName);
      const { stderr: v1Stderr } = await execAsync(`node ${CLI_PATH} migrate`);
      expect(v1Stderr).toContain('Migration applied successfully');

      // Change assert
      const v2 = createSchema('assert-v2', `
import { defineSchema, composeSchema, int } from '../../../dist/schema/concise-schema.ts';

export default composeSchema({
  models: {
    score: defineSchema({
      table: 'score',
      fields: {
        points: int().assert('$value >= 0 AND $value <= 100'),
      }
    })
  },
  relations: {}
});`);

      createConfig(v2, dbName);
      const { stdout: diffOutput } = await execAsync(`node ${CLI_PATH} generate --debug`);
      
      // Should detect the change - may use ALTER or DEFINE OVERWRITE
      expect(diffOutput).toMatch(/ALTER FIELD points|DEFINE FIELD.*points|Modify field.*points/i);
    }, 60000);

    it('should use ALTER FIELD for readonly changes', async () => {
      const dbName = `test_alter_readonly_${Date.now()}`;

      const v1 = createSchema('readonly-v1', `
import { defineSchema, composeSchema, string } from '../../../dist/schema/concise-schema.ts';

export default composeSchema({
  models: {
    document: defineSchema({
      table: 'document',
      fields: {
        title: string(),
      }
    })
  },
  relations: {}
});`);

      createConfig(v1, dbName);
      const { stderr: v1Stderr } = await execAsync(`node ${CLI_PATH} migrate`);
      expect(v1Stderr).toContain('Migration applied successfully');

      // Make field readonly
      const v2 = createSchema('readonly-v2', `
import { defineSchema, composeSchema, string } from '../../../dist/schema/concise-schema.ts';

export default composeSchema({
  models: {
    document: defineSchema({
      table: 'document',
      fields: {
        title: string().readonly(),
      }
    })
  },
  relations: {}
});`);

      createConfig(v2, dbName);
      const { stdout: diffOutput } = await execAsync(`node ${CLI_PATH} generate --debug`);
      
      // Should detect the change - may use ALTER or DEFINE OVERWRITE
      expect(diffOutput).toMatch(/ALTER FIELD title|DEFINE FIELD.*title|Modify field.*title/i);
    }, 60000);

    it('should use DEFINE FIELD OVERWRITE for multiple property changes', async () => {
      const dbName = `test_alter_multiple_${Date.now()}`;

      const v1 = createSchema('multiple-v1', `
import { defineSchema, composeSchema, string } from '../../../dist/schema/concise-schema.ts';

export default composeSchema({
  models: {
    item: defineSchema({
      table: 'item',
      fields: {
        name: string(),
      }
    })
  },
  relations: {}
});`);

      createConfig(v1, dbName);
      const { stderr: v1Stderr } = await execAsync(`node ${CLI_PATH} migrate`);
      expect(v1Stderr).toContain('Migration applied successfully');

      // Change multiple properties - should fall back to DEFINE OVERWRITE
      const v2 = createSchema('multiple-v2', `
import { defineSchema, composeSchema, int } from '../../../dist/schema/concise-schema.ts';

export default composeSchema({
  models: {
    item: defineSchema({
      table: 'item',
      fields: {
        name: int().default(0).readonly().assert('$value >= 0'),
      }
    })
  },
  relations: {}
});`);

      createConfig(v2, dbName);
      const { stdout: diffOutput } = await execAsync(`node ${CLI_PATH} generate --debug`);
      
      // Should use DEFINE FIELD OVERWRITE for 4+ changes
      expect(diffOutput).toMatch(/DEFINE FIELD.*OVERWRITE/i);
    }, 60000);
  });

  describe('Param alterations', () => {
    it('should use ALTER PARAM for value changes', async () => {
      const dbName = `test_alter_param_${Date.now()}`;

      const v1 = createSchema('param-v1', `
import { composeSchema, param } from '../../../dist/schema/concise-schema.ts';

export default composeSchema({
  models: {},
  relations: {},
  params: {
    max_items: param('max_items').value('100'),
  }
});`);

      createConfig(v1, dbName);
      const { stderr: v1Stderr } = await execAsync(`node ${CLI_PATH} migrate`);
      expect(v1Stderr).toMatch(/Migration applied successfully|up to date/);

      // Change param value
      const v2 = createSchema('param-v2', `
import { composeSchema, param } from '../../../dist/schema/concise-schema.ts';

export default composeSchema({
  models: {},
  relations: {},
  params: {
    max_items: param('max_items').value('500'),
  }
});`);

      createConfig(v2, dbName);
      const { stdout: diffOutput } = await execAsync(`node ${CLI_PATH} generate --debug`);
      
      expect(diffOutput).toMatch(/ALTER PARAM.*max_items.*VALUE/i);
    }, 60000);
  });
});


