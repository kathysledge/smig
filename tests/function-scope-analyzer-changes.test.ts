/**
 * Tests for detecting changes in functions, scopes (access), and analyzers.
 *
 * These tests verify the fix for the bug where `hasChanges()` was not detecting
 * changes when only functions, scopes, or analyzers were modified.
 *
 * Bug Report: When only functions are changed, `migrate()` did not detect any changes.
 * The `generateDiff()` worked correctly, but `hasChanges()` returned false.
 *
 * Fix: Added checks for functions, scopes, and analyzers in the `hasChanges()` method.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MigrationManager } from '../src/migrator/migration-manager';
import type { SurrealDBSchema } from '../src/types/schema';

// Mock dependencies
// biome-ignore lint/suspicious/noExplicitAny: Mock client needs flexible typing for tests
let mockClient: any;
// biome-ignore lint/suspicious/noExplicitAny: Mock logger needs flexible typing for tests
let mockLogger: any;

vi.mock('../src/database/surreal-client', () => {
  return {
    SurrealClient: class {
      constructor() {
        // biome-ignore lint/correctness/noConstructorReturn: Mock pattern requires returning mock object
        return mockClient;
      }
    },
  };
});

vi.mock('../src/utils/debug-logger', () => {
  return {
    DebugLogger: class {
      constructor() {
        // biome-ignore lint/correctness/noConstructorReturn: Mock pattern requires returning mock object
        return mockLogger;
      }
    },
    debugLog: vi.fn(),
    debugLogSchema: vi.fn(),
    setDebugLogger: vi.fn(),
    getDebugLogger: vi.fn(),
  };
});

describe('Function, Scope, and Analyzer Change Detection', () => {
  let migrationManager: MigrationManager;

  beforeEach(() => {
    mockClient = {
      connect: vi.fn(),
      close: vi.fn(),
      createMigrationsTable: vi.fn(),
      getCurrentDatabaseSchema: vi.fn(),
      executeQuery: vi.fn(),
      create: vi.fn(),
      select: vi.fn(),
      delete: vi.fn(),
    };

    mockLogger = {
      debug: vi.fn(),
      writeToFile: vi.fn(),
    };

    migrationManager = new MigrationManager({
      url: 'ws://localhost:8000',
      namespace: 'test',
      database: 'test',
      username: 'root',
      password: 'root',
      schema: './schema.js',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Function Changes (Bug Fix)', () => {
    it('should detect new function', async () => {
      const schema: SurrealDBSchema = {
        tables: [],
        relations: [],
        functions: [
          {
            name: 'fn::greet',
            parameters: [],
            returnType: 'string',
            body: "RETURN 'Hello';",
          },
        ],
        scopes: [],
        analyzers: [],
        comments: [],
      };

      mockClient.getCurrentDatabaseSchema.mockResolvedValue({
        tables: [],
        relations: [],
        functions: [],
        scopes: [],
        analyzers: [],
      });

      const hasChanges = await migrationManager.hasChanges(schema);
      expect(hasChanges).toBe(true);
    });

    it('should detect modified function', async () => {
      const schema: SurrealDBSchema = {
        tables: [],
        relations: [],
        functions: [
          {
            name: 'fn::greet',
            parameters: [],
            returnType: 'string',
            body: "RETURN 'Hello World';", // Modified body
          },
        ],
        scopes: [],
        analyzers: [],
        comments: [],
      };

      mockClient.getCurrentDatabaseSchema.mockResolvedValue({
        tables: [],
        relations: [],
        functions: [
          {
            name: 'fn::greet',
            parameters: [],
            returnType: 'string',
            body: "RETURN 'Hello';", // Different
          },
        ],
        scopes: [],
        analyzers: [],
      });

      const hasChanges = await migrationManager.hasChanges(schema);
      expect(hasChanges).toBe(true);
    });
  });

  describe('Scope (ACCESS) Changes (Bug Fix)', () => {
    it('should detect new scope', async () => {
      const schema: SurrealDBSchema = {
        tables: [],
        relations: [],
        functions: [],
        scopes: [
          {
            name: 'user_scope',
            session: '7d',
            signup: null,
            signin: 'SELECT * FROM user',
          },
        ],
        analyzers: [],
        comments: [],
      };

      mockClient.getCurrentDatabaseSchema.mockResolvedValue({
        tables: [],
        relations: [],
        functions: [],
        scopes: [],
        analyzers: [],
      });

      const hasChanges = await migrationManager.hasChanges(schema);
      expect(hasChanges).toBe(true);
    });

    it('should detect modified scope', async () => {
      const schema: SurrealDBSchema = {
        tables: [],
        relations: [],
        functions: [],
        scopes: [
          {
            name: 'user_scope',
            session: '14d', // Modified
            signup: null,
            signin: 'SELECT * FROM user',
          },
        ],
        analyzers: [],
        comments: [],
      };

      mockClient.getCurrentDatabaseSchema.mockResolvedValue({
        tables: [],
        relations: [],
        functions: [],
        scopes: [
          {
            name: 'user_scope',
            session: '7d', // Different
            signup: null,
            signin: 'SELECT * FROM user',
          },
        ],
        analyzers: [],
      });

      const hasChanges = await migrationManager.hasChanges(schema);
      expect(hasChanges).toBe(true);
    });
  });

  describe('Analyzer Changes (Bug Fix)', () => {
    it('should detect new analyzer', async () => {
      const schema: SurrealDBSchema = {
        tables: [],
        relations: [],
        functions: [],
        scopes: [],
        analyzers: [
          {
            name: 'test_analyzer',
            tokenizers: ['blank'],
            filters: [],
          },
        ],
        comments: [],
      };

      mockClient.getCurrentDatabaseSchema.mockResolvedValue({
        tables: [],
        relations: [],
        functions: [],
        scopes: [],
        analyzers: [],
      });

      const hasChanges = await migrationManager.hasChanges(schema);
      expect(hasChanges).toBe(true);
    });

    it('should detect modified analyzer', async () => {
      const schema: SurrealDBSchema = {
        tables: [],
        relations: [],
        functions: [],
        scopes: [],
        analyzers: [
          {
            name: 'test_analyzer',
            tokenizers: ['camel'], // Modified
            filters: [],
          },
        ],
        comments: [],
      };

      mockClient.getCurrentDatabaseSchema.mockResolvedValue({
        tables: [],
        relations: [],
        functions: [],
        scopes: [],
        analyzers: [
          {
            name: 'test_analyzer',
            tokenizers: ['blank'], // Different
            filters: [],
          },
        ],
      });

      const hasChanges = await migrationManager.hasChanges(schema);
      expect(hasChanges).toBe(true);
    });
  });

  describe('Combined Changes', () => {
    it('should detect changes when multiple object types are modified together', async () => {
      const schema: SurrealDBSchema = {
        tables: [],
        relations: [],
        functions: [
          {
            name: 'fn::test',
            parameters: [],
            returnType: 'string',
            body: "RETURN 'test';",
          },
        ],
        scopes: [
          {
            name: 'test_scope',
            session: '7d',
            signup: null,
            signin: 'SELECT * FROM user',
          },
        ],
        analyzers: [
          {
            name: 'test_analyzer',
            tokenizers: ['blank'],
            filters: [],
          },
        ],
        comments: [],
      };

      mockClient.getCurrentDatabaseSchema.mockResolvedValue({
        tables: [],
        relations: [],
        functions: [],
        scopes: [],
        analyzers: [],
      });

      const hasChanges = await migrationManager.hasChanges(schema);
      expect(hasChanges).toBe(true);
    });
  });
});
