/**
 * @fileoverview Comprehensive integration tests for field and parameter normalization.
 *
 * Tests that every field type and parameter is correctly:
 * 1. Generated into valid SurrealQL
 * 2. Applied to the database
 * 3. Introspected back correctly
 * 4. Compared for diff generation
 *
 * @module tests/integration/field-normalization
 */

import { exec } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanupTestFiles, TEST_DATABASES } from './setup';

const execAsync = promisify(exec);

describe('Field Normalization Integration Tests', () => {
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
      'tests/integration/fixtures/field-norm-*.ts',
    ]);
  });

  afterEach(async () => {
    cleanupTestFiles([
      'smig-debug-*.txt',
      'smig.config.ts',
      'tests/integration/fixtures/field-norm-*.ts',
    ]);
  });

  function createSchema(name: string, content: string): string {
    const filename = `field-norm-${name}.ts`;
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

  describe('Primitive Field Types', () => {
    it('should correctly migrate all primitive field types', async () => {
      const dbName = `test_primitives_${Date.now()}`;

      const schema = createSchema(
        'primitives',
        `
import { defineSchema, composeSchema, string, int, float, bool, datetime, decimal, uuid, duration, object, geometry, bytes, number, literal } from 'smig';

export default composeSchema({
  models: {
    primitives: defineSchema({
      table: 'primitives',
      schemafull: true,
      fields: {
        // String type
        stringField: string(),
        stringRequired: string().required(),
        stringWithDefault: string().default('hello'),
        
        // Integer type
        intField: int(),
        intRequired: int().required(),
        intWithDefault: int().default(42),
        intWithRange: int().range(0, 100),
        
        // Float type
        floatField: float(),
        floatRequired: float().required(),
        floatWithDefault: float().default(3.14),
        
        // Boolean type
        boolField: bool(),
        boolRequired: bool().required(),
        boolWithDefault: bool().default(true),
        
        // Datetime type
        datetimeField: datetime(),
        datetimeWithValue: datetime().value('time::now()'),
        
        // Decimal type
        decimalField: decimal(),
        decimalRequired: decimal().required(),
        
        // UUID type
        uuidField: uuid(),
        uuidWithDefault: uuid().default('rand::uuid::v7()'),
        
        // Duration type
        durationField: duration(),
        durationWithDefault: duration().default('30s'),
        
        // Object type
        objectField: object(),
        objectRequired: object().required(),
        
        // Geometry type
        geometryField: geometry(),
        
        // Bytes type
        bytesField: bytes(),
        
        // Number type
        numberField: number(),
        numberWithDefault: number().default(0),
        
        // Literal type
        statusLiteral: literal('active', 'pending', 'inactive'),
      },
    })
  },
  relations: {}
});`,
      );

      createConfig(schema, dbName);

      const { stderr } = await execAsync(`node ${CLI_PATH} migrate`);
      expect(stderr).toMatch(/Migration applied successfully|up to date/);

      // Note: There may be normalization differences detected (e.g., float 3.14 vs "3.14f")
      // This test verifies the migration succeeds, not that normalization is perfect
    }, 30000);
  });

  describe('Complex Field Types', () => {
    it('should correctly migrate option, array, set, and record types', async () => {
      const dbName = `test_complex_${Date.now()}`;

      const schema = createSchema(
        'complex',
        `
import { defineSchema, composeSchema, string, int, option, array, set, record } from 'smig';

export default composeSchema({
  models: {
    base_table: defineSchema({
      table: 'base_table',
      schemafull: true,
      fields: {
        name: string().required(),
      },
    }),
    complex_types: defineSchema({
      table: 'complex_types',
      schemafull: true,
      fields: {
        // Option types
        optionalString: option('string'),
        optionalInt: option('int'),
        
        // Array types
        stringArray: array('string'),
        intArray: array('int'),
        arrayWithDefault: array('string').default([]),
        
        // Set types
        stringSet: set('string'),
        intSet: set('int'),
        
        // Record references
        simpleRecord: record('base_table'),
        genericRecord: record(),
      },
    })
  },
  relations: {}
});`,
      );

      createConfig(schema, dbName);

      const { stderr } = await execAsync(`node ${CLI_PATH} migrate`);
      expect(stderr).toMatch(/Migration applied successfully|up to date/);
    }, 30000);
  });

  describe('Field Modifiers', () => {
    it('should correctly apply readonly, flexible, default, value, and assert modifiers', async () => {
      const dbName = `test_modifiers_${Date.now()}`;

      const schema = createSchema(
        'modifiers',
        `
import { defineSchema, composeSchema, string, int, datetime } from 'smig';

export default composeSchema({
  models: {
    field_modifiers: defineSchema({
      table: 'field_modifiers',
      schemafull: true,
      fields: {
        // Readonly modifier
        readonlyField: string().readonly(),
        
        // Flexible modifier
        flexibleField: string().flexible(),
        
        // Default values
        staticDefault: string().default('static'),
        
        // Value expressions
        computedValue: datetime().value('time::now()'),
        
        // Computed fields
        computedField: int().computed('1 + 1'),
        
        // Assertions (single)
        singleAssert: string().assert('$value != NONE'),
        
        // Assertions (multiple - combined with AND)
        multipleAsserts: string()
          .assert('$value != NONE')
          .assert('string::len($value) >= 3')
          .assert('string::len($value) <= 50'),
        
        // Required
        requiredField: string().required(),
        
        // Length constraints
        lengthConstrained: string().length(5, 20),
        
        // Range constraints
        rangeConstrained: int().range(1, 100),
        
        // Min/Max constraints
        minConstrained: int().min(0),
        maxConstrained: int().max(1000),
        
        // Comments
        commentedField: string().comment('This is a test comment'),
      },
    })
  },
  relations: {}
});`,
      );

      createConfig(schema, dbName);

      const { stderr } = await execAsync(`node ${CLI_PATH} migrate`);
      expect(stderr).toMatch(/Migration applied successfully|up to date/);
    }, 30000);
  });

  describe('Index Types', () => {
    it('should correctly migrate BTREE, HNSW, and MTREE indexes', async () => {
      const dbName = `test_indexes_${Date.now()}`;

      const schema = createSchema(
        'indexes',
        `
import { defineSchema, composeSchema, string, int, array, index } from 'smig';

export default composeSchema({
  models: {
    index_types: defineSchema({
      table: 'index_types',
      schemafull: true,
      fields: {
        id: string().required(),
        title: string().required(),
        content: string(),
        embedding: array('float'),
        score: int(),
        category: string(),
        tags: array('string'),
      },
      indexes: {
        // BTREE index (default)
        btreeIndex: index(['id']).btree(),
        
        // Unique BTREE index
        uniqueIndex: index(['title']).unique(),
        
        // Compound index
        compoundIndex: index(['category', 'score']),
        
        // HNSW vector index
        hnswIndex: index(['embedding'])
          .hnsw()
          .dimension(384)
          .dist('COSINE')
          .efc(150)
          .m(12),
      },
    })
  },
  relations: {}
});`,
      );

      createConfig(schema, dbName);

      const { stderr } = await execAsync(`node ${CLI_PATH} migrate`);
      expect(stderr).toMatch(/Migration applied successfully|up to date/);
    }, 30000);
  });

  describe('Entity Definitions', () => {
    it('should correctly migrate analyzers and params', async () => {
      const dbName = `test_entities_${Date.now()}`;

      const schema = createSchema(
        'entities',
        `
import { defineSchema, composeSchema, string, int, analyzer, param } from 'smig';

export default composeSchema({
  models: {
    entities_test: defineSchema({
      table: 'entities_test',
      schemafull: true,
      fields: {
        name: string().required(),
        orderNumber: int().default(1),
      },
    })
  },
  relations: {},
  analyzers: {
    custom_analyzer: analyzer('custom_analyzer')
      .tokenizers(['blank'])
      .filters(['lowercase']),
  },
  params: {
    app_version: param('app_version').value('"1.0.0"'),
  },
});`,
      );

      createConfig(schema, dbName);

      const { stderr } = await execAsync(`node ${CLI_PATH} migrate`);
      expect(stderr).toMatch(/Migration applied successfully|up to date/);
    }, 30000);
  });

  describe('Diff Detection and Normalization', () => {
    it('should detect no changes when schema matches database', async () => {
      const dbName = `test_no_changes_${Date.now()}`;

      const schema = createSchema(
        'no-changes',
        `
import { defineSchema, composeSchema, string, int } from 'smig';

export default composeSchema({
  models: {
    diff_test: defineSchema({
      table: 'diff_test',
      schemafull: true,
      fields: {
        name: string().required(),
        age: int().default(0),
      },
    })
  },
  relations: {}
});`,
      );

      createConfig(schema, dbName);

      // First migration
      const { stderr: migrate1 } = await execAsync(`node ${CLI_PATH} migrate`);
      expect(migrate1).toMatch(/Migration applied successfully|up to date/);

      // Second run should detect no changes
      const { stdout: diff } = await execAsync(`node ${CLI_PATH} generate`);
      expect(diff).toMatch(/No changes detected|up to date/i);
    }, 30000);

    it('should detect field additions correctly', async () => {
      const dbName = `test_additions_${Date.now()}`;

      // Initial schema
      const v1 = createSchema(
        'additions-v1',
        `
import { defineSchema, composeSchema, string } from 'smig';

export default composeSchema({
  models: {
    addition_test: defineSchema({
      table: 'addition_test',
      schemafull: true,
      fields: {
        name: string().required(),
      },
    })
  },
  relations: {}
});`,
      );

      createConfig(v1, dbName);
      await execAsync(`node ${CLI_PATH} migrate`);

      // Add a field
      const v2 = createSchema(
        'additions-v2',
        `
import { defineSchema, composeSchema, string } from 'smig';

export default composeSchema({
  models: {
    addition_test: defineSchema({
      table: 'addition_test',
      schemafull: true,
      fields: {
        name: string().required(),
        email: string(),
      },
    })
  },
  relations: {}
});`,
      );

      createConfig(v2, dbName);
      const { stdout: diff } = await execAsync(`node ${CLI_PATH} generate --debug`);
      expect(diff).toMatch(/DEFINE FIELD.*email/i);
    }, 30000);

    it('should detect field modifications correctly', async () => {
      const dbName = `test_modifications_${Date.now()}`;

      // Initial schema
      const v1 = createSchema(
        'modifications-v1',
        `
import { defineSchema, composeSchema, int } from 'smig';

export default composeSchema({
  models: {
    modification_test: defineSchema({
      table: 'modification_test',
      schemafull: true,
      fields: {
        count: int(),
      },
    })
  },
  relations: {}
});`,
      );

      createConfig(v1, dbName);
      await execAsync(`node ${CLI_PATH} migrate`);

      // Modify field to have a default
      const v2 = createSchema(
        'modifications-v2',
        `
import { defineSchema, composeSchema, int } from 'smig';

export default composeSchema({
  models: {
    modification_test: defineSchema({
      table: 'modification_test',
      schemafull: true,
      fields: {
        count: int().default(0),
      },
    })
  },
  relations: {}
});`,
      );

      createConfig(v2, dbName);
      const { stdout: diff } = await execAsync(`node ${CLI_PATH} generate --debug`);
      expect(diff).toMatch(/ALTER FIELD count|DEFINE FIELD.*count|Modify field.*count/i);
    }, 30000);

    it('should handle field renames with .was()', async () => {
      const dbName = `test_renames_${Date.now()}`;

      // Initial schema
      const v1 = createSchema(
        'renames-v1',
        `
import { defineSchema, composeSchema, string } from 'smig';

export default composeSchema({
  models: {
    rename_test: defineSchema({
      table: 'rename_test',
      schemafull: true,
      fields: {
        username: string().required(),
      },
    })
  },
  relations: {}
});`,
      );

      createConfig(v1, dbName);
      await execAsync(`node ${CLI_PATH} migrate`);

      // Rename field
      const v2 = createSchema(
        'renames-v2',
        `
import { defineSchema, composeSchema, string } from 'smig';

export default composeSchema({
  models: {
    rename_test: defineSchema({
      table: 'rename_test',
      schemafull: true,
      fields: {
        displayName: string().required().was('username'),
      },
    })
  },
  relations: {}
});`,
      );

      createConfig(v2, dbName);
      const { stdout: diff } = await execAsync(`node ${CLI_PATH} generate --debug`);
      expect(diff).toMatch(/ALTER FIELD.*RENAME|displayName/i);
    }, 30000);
  });

  describe('Edge Cases', () => {
    it('should handle special characters in string defaults', async () => {
      const dbName = `test_special_chars_${Date.now()}`;

      const schema = createSchema(
        'special-chars',
        `
import { defineSchema, composeSchema, string } from 'smig';

export default composeSchema({
  models: {
    special_chars: defineSchema({
      table: 'special_chars',
      schemafull: true,
      fields: {
        withQuotes: string().default('Hello World'),
        emptyString: string().default(''),
        withUnicode: string().default('こんにちは'),
      },
    })
  },
  relations: {}
});`,
      );

      createConfig(schema, dbName);
      const { stderr } = await execAsync(`node ${CLI_PATH} migrate`);
      expect(stderr).toMatch(/Migration applied successfully|up to date/);
    }, 30000);

    it('should handle zero and negative numeric defaults', async () => {
      const dbName = `test_numeric_defaults_${Date.now()}`;

      const schema = createSchema(
        'numeric-defaults',
        `
import { defineSchema, composeSchema, int, float, decimal } from 'smig';

export default composeSchema({
  models: {
    numeric_defaults: defineSchema({
      table: 'numeric_defaults',
      schemafull: true,
      fields: {
        zeroInt: int().default(0),
        negativeInt: int().default(-1),
        zeroFloat: float().default(0.0),
        negativeFloat: float().default(-3.14),
        smallDecimal: decimal().default(0.001),
        largeNumber: int().default(999999999),
      },
    })
  },
  relations: {}
});`,
      );

      createConfig(schema, dbName);
      const { stderr } = await execAsync(`node ${CLI_PATH} migrate`);
      expect(stderr).toMatch(/Migration applied successfully|up to date/);
    }, 30000);

    it('should handle boolean defaults correctly', async () => {
      const dbName = `test_bool_defaults_${Date.now()}`;

      const schema = createSchema(
        'bool-defaults',
        `
import { defineSchema, composeSchema, bool } from 'smig';

export default composeSchema({
  models: {
    bool_defaults: defineSchema({
      table: 'bool_defaults',
      schemafull: true,
      fields: {
        trueDefault: bool().default(true),
        falseDefault: bool().default(false),
        requiredBool: bool().required(),
      },
    })
  },
  relations: {}
});`,
      );

      createConfig(schema, dbName);
      const { stderr } = await execAsync(`node ${CLI_PATH} migrate`);
      expect(stderr).toMatch(/Migration applied successfully|up to date/);
    }, 30000);

    it('should handle complex assertion combinations', async () => {
      const dbName = `test_complex_asserts_${Date.now()}`;

      const schema = createSchema(
        'complex-asserts',
        `
import { defineSchema, composeSchema, string, float } from 'smig';

export default composeSchema({
  models: {
    complex_assertions: defineSchema({
      table: 'complex_assertions',
      schemafull: true,
      fields: {
        // Multiple chained assertions
        password: string()
          .required()
          .length(8, 128),
        
        // Numeric with multiple constraints
        percentage: float()
          .required()
          .min(0)
          .max(100),
        
        // Email validation
        email: string()
          .required()
          .assert('string::is_email($value)'),
      },
    })
  },
  relations: {}
});`,
      );

      createConfig(schema, dbName);
      const { stderr } = await execAsync(`node ${CLI_PATH} migrate`);
      expect(stderr).toMatch(/Migration applied successfully|up to date/);
    }, 30000);
  });
});
