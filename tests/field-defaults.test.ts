import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SurrealClient } from '../src/database/surreal-client';
import { MigrationManager } from '../src/migrator/migration-manager';
import { any, array, bool, defineSchema, int, string } from '../src/schema/concise-schema';
import type { DatabaseConfig, SurrealDBSchema } from '../src/types/schema';

describe('Field Default Values', () => {
  let manager: MigrationManager;
  let mockClient: SurrealClient;
  let capturedQueries: string[] = [];

  const config: DatabaseConfig = {
    url: 'memory',
    namespace: 'test',
    database: 'test',
    username: 'root',
    password: 'root',
    schema: './schema.js',
  };

  beforeEach(() => {
    capturedQueries = [];
    mockClient = {
      executeQuery: async (query: string) => {
        capturedQueries.push(query);
        // Return empty schema (no tables)
        if (query.includes('INFO FOR DB')) {
          return [{}];
        }
        return [];
      },
      connect: async () => {},
      close: async () => {},
      select: async () => [],
    } as unknown as SurrealClient;

    manager = new MigrationManager(config, mockClient);
  });

  afterEach(() => {
    capturedQueries = [];
  });

  describe('Array Defaults', () => {
    it('should handle empty array default', async () => {
      const schema = {
        tables: [
          defineSchema({
            table: 'user',
            fields: {
              tags: array('string').default([]),
            },
          }),
        ],
        relations: [],
        comments: [],
      };

      await manager.initialize();
      const result = await manager.generateDiff(schema as unknown as SurrealDBSchema);

      expect(result.up).toContain('DEFINE FIELD tags ON TABLE user TYPE array<string> DEFAULT [];');
    });

    it('should handle array with string values', async () => {
      const schema = {
        tables: [
          defineSchema({
            table: 'user',
            fields: {
              tags: array('string').default(['admin', 'moderator']),
            },
          }),
        ],
        relations: [],
        comments: [],
      };

      await manager.initialize();
      const result = await manager.generateDiff(schema as unknown as SurrealDBSchema);

      expect(result.up).toContain(
        'DEFINE FIELD tags ON TABLE user TYPE array<string> DEFAULT ["admin","moderator"];',
      );
    });

    it('should handle array with number values', async () => {
      const schema = {
        tables: [
          defineSchema({
            table: 'user',
            fields: {
              scores: array('int').default([1, 2, 3]),
            },
          }),
        ],
        relations: [],
        comments: [],
      };

      await manager.initialize();
      const result = await manager.generateDiff(schema as unknown as SurrealDBSchema);

      expect(result.up).toContain(
        'DEFINE FIELD scores ON TABLE user TYPE array<int> DEFAULT [1,2,3];',
      );
    });

    it('should handle array with mixed types', async () => {
      const schema = {
        tables: [
          defineSchema({
            table: 'config',
            fields: {
              settings: array('any').default(['setting1', 42, true]),
            },
          }),
        ],
        relations: [],
        comments: [],
      };

      await manager.initialize();
      const result = await manager.generateDiff(schema as unknown as SurrealDBSchema);

      expect(result.up).toContain(
        'DEFINE FIELD settings ON TABLE config TYPE array<any> DEFAULT ["setting1",42,true];',
      );
    });
  });

  describe('String Defaults', () => {
    it('should quote literal string defaults', async () => {
      const schema = {
        tables: [
          defineSchema({
            table: 'user',
            fields: {
              role: string().default('user'),
            },
          }),
        ],
        relations: [],
        comments: [],
      };

      await manager.initialize();
      const result = await manager.generateDiff(schema as unknown as SurrealDBSchema);

      expect(result.up).toContain('DEFINE FIELD role ON TABLE user TYPE string DEFAULT "user";');
    });

    it('should not quote SurrealQL function expressions', async () => {
      const schema = {
        tables: [
          defineSchema({
            table: 'user',
            fields: {
              id_uuid: string().default('rand::uuid::v7()'),
            },
          }),
        ],
        relations: [],
        comments: [],
      };

      await manager.initialize();
      const result = await manager.generateDiff(schema as unknown as SurrealDBSchema);

      expect(result.up).toContain(
        'DEFINE FIELD id_uuid ON TABLE user TYPE string DEFAULT rand::uuid::v7();',
      );
    });

    it('should not quote SurrealQL variable expressions', async () => {
      const schema = {
        tables: [
          defineSchema({
            table: 'user',
            fields: {
              creator: string().default('$auth.id'),
            },
          }),
        ],
        relations: [],
        comments: [],
      };

      await manager.initialize();
      const result = await manager.generateDiff(schema as unknown as SurrealDBSchema);

      expect(result.up).toContain(
        'DEFINE FIELD creator ON TABLE user TYPE string DEFAULT $auth.id;',
      );
    });

    it('should not quote SurrealQL namespace expressions', async () => {
      const schema = {
        tables: [
          defineSchema({
            table: 'post',
            fields: {
              created_at: string().default('time::now()'),
            },
          }),
        ],
        relations: [],
        comments: [],
      };

      await manager.initialize();
      const result = await manager.generateDiff(schema as unknown as SurrealDBSchema);

      expect(result.up).toContain(
        'DEFINE FIELD created_at ON TABLE post TYPE string DEFAULT time::now();',
      );
    });
  });

  describe('Number Defaults', () => {
    it('should handle integer defaults', async () => {
      const schema = {
        tables: [
          defineSchema({
            table: 'user',
            fields: {
              age: int().default(0),
            },
          }),
        ],
        relations: [],
        comments: [],
      };

      await manager.initialize();
      const result = await manager.generateDiff(schema as unknown as SurrealDBSchema);

      expect(result.up).toContain('DEFINE FIELD age ON TABLE user TYPE int DEFAULT 0;');
    });

    it('should handle float defaults', async () => {
      const schema = {
        tables: [
          defineSchema({
            table: 'product',
            fields: {
              price: int().default(9.99),
            },
          }),
        ],
        relations: [],
        comments: [],
      };

      await manager.initialize();
      const result = await manager.generateDiff(schema as unknown as SurrealDBSchema);

      expect(result.up).toContain('DEFINE FIELD price ON TABLE product TYPE int DEFAULT 9.99;');
    });

    it('should handle negative number defaults', async () => {
      const schema = {
        tables: [
          defineSchema({
            table: 'transaction',
            fields: {
              balance: int().default(-100),
            },
          }),
        ],
        relations: [],
        comments: [],
      };

      await manager.initialize();
      const result = await manager.generateDiff(schema as unknown as SurrealDBSchema);

      expect(result.up).toContain(
        'DEFINE FIELD balance ON TABLE transaction TYPE int DEFAULT -100;',
      );
    });
  });

  describe('Boolean Defaults', () => {
    it('should handle true default', async () => {
      const schema = {
        tables: [
          defineSchema({
            table: 'user',
            fields: {
              active: bool().default(true),
            },
          }),
        ],
        relations: [],
        comments: [],
      };

      await manager.initialize();
      const result = await manager.generateDiff(schema as unknown as SurrealDBSchema);

      expect(result.up).toContain('DEFINE FIELD active ON TABLE user TYPE bool DEFAULT true;');
    });

    it('should handle false default', async () => {
      const schema = {
        tables: [
          defineSchema({
            table: 'user',
            fields: {
              verified: bool().default(false),
            },
          }),
        ],
        relations: [],
        comments: [],
      };

      await manager.initialize();
      const result = await manager.generateDiff(schema as unknown as SurrealDBSchema);

      expect(result.up).toContain('DEFINE FIELD verified ON TABLE user TYPE bool DEFAULT false;');
    });
  });

  describe('Object Defaults', () => {
    it('should handle empty object default', async () => {
      const schema = {
        tables: [
          defineSchema({
            table: 'user',
            fields: {
              metadata: any().default({}),
            },
          }),
        ],
        relations: [],
        comments: [],
      };

      await manager.initialize();
      const result = await manager.generateDiff(schema as unknown as SurrealDBSchema);

      expect(result.up).toContain('DEFINE FIELD metadata ON TABLE user TYPE any DEFAULT {};');
    });

    it('should handle object with values', async () => {
      const schema = {
        tables: [
          defineSchema({
            table: 'user',
            fields: {
              settings: any().default({ theme: 'dark', notifications: true }),
            },
          }),
        ],
        relations: [],
        comments: [],
      };

      await manager.initialize();
      const result = await manager.generateDiff(schema as unknown as SurrealDBSchema);

      expect(result.up).toContain(
        'DEFINE FIELD settings ON TABLE user TYPE any DEFAULT {"theme":"dark","notifications":true};',
      );
    });
  });

  describe('No Default', () => {
    it('should not include DEFAULT clause when no default is set', async () => {
      const schema = {
        tables: [
          defineSchema({
            table: 'user',
            fields: {
              name: string(),
            },
          }),
        ],
        relations: [],
        comments: [],
      };

      await manager.initialize();
      const result = await manager.generateDiff(schema as unknown as SurrealDBSchema);

      expect(result.up).toContain('DEFINE FIELD name ON TABLE user TYPE string;');
      expect(result.up).not.toContain('DEFAULT');
    });
  });
});
