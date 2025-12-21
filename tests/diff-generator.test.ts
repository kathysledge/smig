/**
 * @fileoverview Tests for the migration diff generator.
 */

import { describe, expect, it } from 'vitest';
import {
  generateMigrationDiff,
  hasSchemaChanges,
} from '../src/migrator/diff-generator';
import type { SurrealDBSchema } from '../src/types/schema';

// Helper to create minimal schema
function createSchema(overrides: Partial<SurrealDBSchema> = {}): SurrealDBSchema {
  return {
    tables: [],
    relations: [],
    functions: [],
    scopes: [],
    analyzers: [],
    comments: [],
    ...overrides,
  } as SurrealDBSchema;
}

describe('Migration Diff Generator', () => {
  describe('Table Changes', () => {
    it('should detect new table', () => {
      const current = createSchema();
      const desired = createSchema({
        tables: [
          {
            name: 'user',
            schemafull: true,
            fields: [{ name: 'name', type: 'string' }],
            indexes: [],
            events: [],
          },
        ],
      });

      const diff = generateMigrationDiff(current, desired);

      expect(diff.up).toContain('DEFINE TABLE user');
      expect(diff.up).toContain('DEFINE FIELD name');
      expect(diff.down).toContain('REMOVE TABLE user');
      expect(diff.changes).toContainEqual(
        expect.objectContaining({
          type: 'table',
          entity: 'user',
          operation: 'create',
        }),
      );
    });

    it('should detect removed table', () => {
      const current = createSchema({
        tables: [
          {
            name: 'legacy',
            schemafull: true,
            fields: [],
            indexes: [],
            events: [],
          },
        ],
      });
      const desired = createSchema();

      const diff = generateMigrationDiff(current, desired);

      expect(diff.up).toContain('REMOVE TABLE legacy');
      expect(diff.changes).toContainEqual(
        expect.objectContaining({
          type: 'table',
          entity: 'legacy',
          operation: 'remove',
        }),
      );
    });

    it('should detect table rename via was property', () => {
      const current = createSchema({
        tables: [
          {
            name: 'users',
            schemafull: true,
            fields: [{ name: 'email', type: 'string' }],
            indexes: [],
            events: [],
          },
        ],
      });
      const desired = createSchema({
        tables: [
          {
            name: 'customers',
            was: 'users',
            schemafull: true,
            fields: [{ name: 'email', type: 'string' }],
            indexes: [],
            events: [],
          } as any,
        ],
      });

      const diff = generateMigrationDiff(current, desired);

      expect(diff.up).toContain('ALTER TABLE users RENAME TO customers');
      expect(diff.down).toContain('ALTER TABLE customers RENAME TO users');
      expect(diff.changes).toContainEqual(
        expect.objectContaining({
          type: 'table',
          entity: 'customers',
          operation: 'rename',
          details: { oldName: 'users', newName: 'customers' },
        }),
      );
    });
  });

  describe('Field Changes', () => {
    it('should detect new field', () => {
      const current = createSchema({
        tables: [
          {
            name: 'user',
            schemafull: true,
            fields: [{ name: 'name', type: 'string' }],
            indexes: [],
            events: [],
          },
        ],
      });
      const desired = createSchema({
        tables: [
          {
            name: 'user',
            schemafull: true,
            fields: [
              { name: 'name', type: 'string' },
              { name: 'email', type: 'string' },
            ],
            indexes: [],
            events: [],
          },
        ],
      });

      const diff = generateMigrationDiff(current, desired);

      expect(diff.up).toContain('DEFINE FIELD email');
      expect(diff.down).toContain('REMOVE FIELD email');
      expect(diff.changes).toContainEqual(
        expect.objectContaining({
          type: 'field',
          entity: 'user.email',
          operation: 'create',
        }),
      );
    });

    it('should detect field type change', () => {
      const current = createSchema({
        tables: [
          {
            name: 'user',
            schemafull: true,
            fields: [{ name: 'age', type: 'string' }],
            indexes: [],
            events: [],
          },
        ],
      });
      const desired = createSchema({
        tables: [
          {
            name: 'user',
            schemafull: true,
            fields: [{ name: 'age', type: 'int' }],
            indexes: [],
            events: [],
          },
        ],
      });

      const diff = generateMigrationDiff(current, desired);

      // Now uses granular ALTER FIELD TYPE instead of DEFINE OVERWRITE
      expect(diff.up).toContain('ALTER FIELD age ON TABLE user TYPE int');
      expect(diff.changes).toContainEqual(
        expect.objectContaining({
          type: 'field',
          entity: 'user.age',
          operation: 'modify',
        }),
      );
    });

    it('should detect field rename via previousName', () => {
      const current = createSchema({
        tables: [
          {
            name: 'user',
            schemafull: true,
            fields: [{ name: 'userName', type: 'string' }],
            indexes: [],
            events: [],
          },
        ],
      });
      const desired = createSchema({
        tables: [
          {
            name: 'user',
            schemafull: true,
            fields: [{ name: 'fullName', type: 'string', previousName: 'userName' } as any],
            indexes: [],
            events: [],
          },
        ],
      });

      const diff = generateMigrationDiff(current, desired);

      expect(diff.up).toContain('ALTER FIELD userName ON TABLE user RENAME TO fullName');
      expect(diff.down).toContain('ALTER FIELD fullName ON TABLE user RENAME TO userName');
      expect(diff.changes).toContainEqual(
        expect.objectContaining({
          type: 'field',
          entity: 'user.fullName',
          operation: 'rename',
        }),
      );
    });
  });

  describe('Index Changes', () => {
    it('should detect new index', () => {
      const current = createSchema({
        tables: [
          {
            name: 'user',
            schemafull: true,
            fields: [{ name: 'email', type: 'string' }],
            indexes: [],
            events: [],
          },
        ],
      });
      const desired = createSchema({
        tables: [
          {
            name: 'user',
            schemafull: true,
            fields: [{ name: 'email', type: 'string' }],
            indexes: [{ name: 'idx_email', columns: ['email'], unique: true }],
            events: [],
          },
        ],
      });

      const diff = generateMigrationDiff(current, desired);

      expect(diff.up).toContain('DEFINE INDEX idx_email');
      expect(diff.up).toContain('UNIQUE');
      expect(diff.down).toContain('REMOVE INDEX idx_email');
    });

    it('should detect index rename', () => {
      const current = createSchema({
        tables: [
          {
            name: 'user',
            schemafull: true,
            fields: [],
            indexes: [{ name: 'idx_email', columns: ['email'], unique: false }],
            events: [],
          },
        ],
      });
      const desired = createSchema({
        tables: [
          {
            name: 'user',
            schemafull: true,
            fields: [],
            indexes: [
              { name: 'idx_user_email', columns: ['email'], unique: false, previousName: 'idx_email' } as any,
            ],
            events: [],
          },
        ],
      });

      const diff = generateMigrationDiff(current, desired);

      expect(diff.up).toContain('ALTER INDEX idx_email ON TABLE user RENAME TO idx_user_email');
    });
  });

  describe('Function Changes', () => {
    it('should detect new function', () => {
      const current = createSchema();
      const desired = createSchema({
        functions: [
          {
            name: 'fn::greet',
            parameters: [{ name: 'name', type: 'string' }],
            returnType: 'string',
            body: 'RETURN "Hello, " + $name;',
          },
        ],
      });

      const diff = generateMigrationDiff(current, desired);

      expect(diff.up).toContain('DEFINE FUNCTION fn::greet');
      expect(diff.down).toContain('REMOVE FUNCTION fn::greet');
    });

    it('should detect function rename', () => {
      const current = createSchema({
        functions: [
          {
            name: 'fn::get_user',
            parameters: [],
            body: 'RETURN 1;',
          },
        ],
      });
      const desired = createSchema({
        functions: [
          {
            name: 'fn::fetch_user',
            was: 'fn::get_user',
            parameters: [],
            body: 'RETURN 1;',
          } as any,
        ],
      });

      const diff = generateMigrationDiff(current, desired);

      expect(diff.up).toContain('ALTER FUNCTION fn::get_user RENAME TO fn::fetch_user');
    });
  });

  describe('Analyzer Changes', () => {
    it('should detect new analyzer', () => {
      const current = createSchema();
      const desired = createSchema({
        analyzers: [
          {
            name: 'english',
            tokenizers: ['blank', 'class'],
            filters: ['lowercase', 'snowball(english)'],
          },
        ],
      });

      const diff = generateMigrationDiff(current, desired);

      expect(diff.up).toContain('DEFINE ANALYZER english');
      expect(diff.down).toContain('REMOVE ANALYZER english');
    });
  });

  describe('Vector Index Changes', () => {
    it('should generate HNSW index with all options', () => {
      const current = createSchema({
        tables: [
          {
            name: 'documents',
            schemafull: true,
            fields: [{ name: 'embedding', type: 'array<float>' }],
            indexes: [],
            events: [],
          },
        ],
      });
      const desired = createSchema({
        tables: [
          {
            name: 'documents',
            schemafull: true,
            fields: [{ name: 'embedding', type: 'array<float>' }],
            indexes: [
              {
                name: 'idx_embedding',
                columns: ['embedding'],
                type: 'HNSW',
                dimension: 1536,
                dist: 'COSINE',
              } as any,
            ],
            events: [],
          },
        ],
      });

      const diff = generateMigrationDiff(current, desired);

      expect(diff.up).toContain('DEFINE INDEX idx_embedding');
      expect(diff.up).toContain('HNSW');
      expect(diff.up).toContain('DIMENSION 1536');
      expect(diff.up).toContain('DIST COSINE');
    });

    it('should generate MTREE index', () => {
      const current = createSchema({
        tables: [
          {
            name: 'locations',
            schemafull: true,
            fields: [{ name: 'coords', type: 'array<float>' }],
            indexes: [],
            events: [],
          },
        ],
      });
      const desired = createSchema({
        tables: [
          {
            name: 'locations',
            schemafull: true,
            fields: [{ name: 'coords', type: 'array<float>' }],
            indexes: [
              {
                name: 'idx_coords',
                columns: ['coords'],
                type: 'MTREE',
                dimension: 3,
                dist: 'EUCLIDEAN',
              } as any,
            ],
            events: [],
          },
        ],
      });

      const diff = generateMigrationDiff(current, desired);

      expect(diff.up).toContain('DEFINE INDEX idx_coords');
      expect(diff.up).toContain('MTREE');
      expect(diff.up).toContain('DIMENSION 3');
      expect(diff.up).toContain('DIST EUCLIDEAN');
    });

    it('should generate SEARCH index with analyzer', () => {
      const current = createSchema({
        tables: [
          {
            name: 'posts',
            schemafull: true,
            fields: [{ name: 'content', type: 'string' }],
            indexes: [],
            events: [],
          },
        ],
      });
      const desired = createSchema({
        tables: [
          {
            name: 'posts',
            schemafull: true,
            fields: [{ name: 'content', type: 'string' }],
            indexes: [
              {
                name: 'idx_content',
                columns: ['content'],
                type: 'SEARCH',
                analyzer: 'english',
                highlights: true,
              } as any,
            ],
            events: [],
          },
        ],
      });

      const diff = generateMigrationDiff(current, desired);

      expect(diff.up).toContain('DEFINE INDEX idx_content');
      expect(diff.up).toContain('FULLTEXT');
      expect(diff.up).toContain('ANALYZER english');
      expect(diff.up).toContain('HIGHLIGHTS');
    });
  });

  describe('Param Changes', () => {
    it('should detect new param', () => {
      const current = createSchema();
      const desired = {
        ...createSchema(),
        params: [
          { name: 'app_version', value: "'2.0.0'" },
        ],
      } as any;

      const diff = generateMigrationDiff(current, desired);

      expect(diff.up).toContain('DEFINE PARAM $app_version');
      expect(diff.up).toContain("VALUE '2.0.0'");
      expect(diff.down).toContain('REMOVE PARAM $app_version');
    });

    it('should detect param value change', () => {
      const current = {
        ...createSchema(),
        params: [{ name: 'max_retries', value: '3' }],
      } as any;
      const desired = {
        ...createSchema(),
        params: [{ name: 'max_retries', value: '5' }],
      } as any;

      const diff = generateMigrationDiff(current, desired);

      // Now uses ALTER PARAM VALUE instead of DEFINE OVERWRITE
      expect(diff.up).toContain('ALTER PARAM $max_retries VALUE 5');
      expect(diff.changes).toContainEqual(
        expect.objectContaining({
          type: 'param',
          entity: 'max_retries',
          operation: 'modify',
        }),
      );
    });

    it('should detect removed param', () => {
      const current = {
        ...createSchema(),
        params: [{ name: 'deprecated', value: "'old'" }],
      } as any;
      const desired = createSchema();

      const diff = generateMigrationDiff(current, desired);

      expect(diff.up).toContain('REMOVE PARAM $deprecated');
    });
  });

  describe('Sequence Changes', () => {
    it('should detect new sequence', () => {
      const current = createSchema();
      const desired = {
        ...createSchema(),
        sequences: [
          { name: 'order_number', start: 10000, step: 1 },
        ],
      } as any;

      const diff = generateMigrationDiff(current, desired);

      expect(diff.up).toContain('DEFINE SEQUENCE order_number');
      expect(diff.up).toContain('START 10000');
      expect(diff.down).toContain('REMOVE SEQUENCE order_number');
    });

    it('should detect removed sequence', () => {
      const current = {
        ...createSchema(),
        sequences: [{ name: 'legacy_seq' }],
      } as any;
      const desired = createSchema();

      const diff = generateMigrationDiff(current, desired);

      expect(diff.up).toContain('REMOVE SEQUENCE legacy_seq');
    });
  });

  describe('User Changes', () => {
    it('should detect new user', () => {
      const current = createSchema();
      const desired = {
        ...createSchema(),
        users: [
          { name: 'admin', level: 'DATABASE', roles: ['OWNER'] },
        ],
      } as any;

      const diff = generateMigrationDiff(current, desired);

      expect(diff.up).toContain('DEFINE USER admin');
      expect(diff.up).toContain('ROLES OWNER');
      expect(diff.down).toContain('REMOVE USER admin');
    });

    it('should detect removed user', () => {
      const current = {
        ...createSchema(),
        users: [{ name: 'temp_user', level: 'DATABASE' }],
      } as any;
      const desired = createSchema();

      const diff = generateMigrationDiff(current, desired);

      expect(diff.up).toContain('REMOVE USER temp_user');
    });
  });

  describe('hasSchemaChanges', () => {
    it('should return false for identical schemas', () => {
      const schema = createSchema({
        tables: [
          {
            name: 'user',
            schemafull: true,
            fields: [{ name: 'name', type: 'string' }],
            indexes: [],
            events: [],
          },
        ],
      });

      expect(hasSchemaChanges(schema, schema)).toBe(false);
    });

    it('should return true when changes exist', () => {
      const current = createSchema();
      const desired = createSchema({
        tables: [
          {
            name: 'user',
            schemafull: true,
            fields: [],
            indexes: [],
            events: [],
          },
        ],
      });

      expect(hasSchemaChanges(current, desired)).toBe(true);
    });
  });

  describe('Granular ALTER Statements', () => {
    it('should use ALTER FIELD TYPE for type changes', () => {
      const current = createSchema({
        tables: [
          {
            name: 'user',
            schemafull: true,
            fields: [{ name: 'age', type: 'int' }],
            indexes: [],
            events: [],
          },
        ],
      });
      const desired = createSchema({
        tables: [
          {
            name: 'user',
            schemafull: true,
            fields: [{ name: 'age', type: 'float' }],
            indexes: [],
            events: [],
          },
        ],
      });

      const diff = generateMigrationDiff(current, desired);

      expect(diff.up).toContain('ALTER FIELD age ON TABLE user TYPE float');
    });

    it('should use ALTER FIELD DEFAULT for default value changes', () => {
      const current = createSchema({
        tables: [
          {
            name: 'user',
            schemafull: true,
            fields: [{ name: 'status', type: 'string', default: 'pending' }],
            indexes: [],
            events: [],
          },
        ],
      });
      const desired = createSchema({
        tables: [
          {
            name: 'user',
            schemafull: true,
            fields: [{ name: 'status', type: 'string', default: 'active' }],
            indexes: [],
            events: [],
          },
        ],
      });

      const diff = generateMigrationDiff(current, desired);

      expect(diff.up).toContain('ALTER FIELD status ON TABLE user DEFAULT');
    });

    it('should use ALTER FIELD ASSERT for assertion changes', () => {
      const current = createSchema({
        tables: [
          {
            name: 'user',
            schemafull: true,
            fields: [{ name: 'age', type: 'int', assert: '$value >= 0' }],
            indexes: [],
            events: [],
          },
        ],
      });
      const desired = createSchema({
        tables: [
          {
            name: 'user',
            schemafull: true,
            fields: [{ name: 'age', type: 'int', assert: '$value >= 18' }],
            indexes: [],
            events: [],
          },
        ],
      });

      const diff = generateMigrationDiff(current, desired);

      expect(diff.up).toContain('ALTER FIELD age ON TABLE user ASSERT');
    });

    it('should use ALTER PARAM VALUE for param value changes', () => {
      const current = {
        ...createSchema(),
        params: [{ name: 'max_limit', value: '100' }],
      } as any;
      const desired = {
        ...createSchema(),
        params: [{ name: 'max_limit', value: '200' }],
      } as any;

      const diff = generateMigrationDiff(current, desired);

      expect(diff.up).toContain('ALTER PARAM $max_limit VALUE 200');
      expect(diff.down).toContain('ALTER PARAM $max_limit VALUE 100');
    });

    it('should fall back to OVERWRITE for complex field changes', () => {
      const current = createSchema({
        tables: [
          {
            name: 'user',
            schemafull: true,
            fields: [{ name: 'data', type: 'object' }],
            indexes: [],
            events: [],
          },
        ],
      });
      const desired = createSchema({
        tables: [
          {
            name: 'user',
            schemafull: true,
            fields: [{ 
              name: 'data', 
              type: 'object',
              default: '{}',
              assert: '$value != NONE',
              readonly: true,
              flexible: true,
            }],
            indexes: [],
            events: [],
          },
        ],
      });

      const diff = generateMigrationDiff(current, desired);

      // Should use OVERWRITE when too many properties change (>3)
      expect(diff.up).toContain('DEFINE FIELD OVERWRITE data');
    });
  });
});

