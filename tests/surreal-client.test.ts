import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SurrealClient } from '../src/database/surreal-client';
import type { Migration } from '../src/types/schema';

// Mock the surrealdb module
// For SDK v2, query() returns a Query object with .collect() method
const createMockQuery = (result: unknown) => ({
  collect: vi.fn().mockResolvedValue(result),
});

const mockSurrealDB = {
  connect: vi.fn(),
  close: vi.fn(),
  // Return object with collect method instead of direct result
  query: vi.fn((_q: string) => createMockQuery([])),
  create: vi.fn(),
  select: vi.fn(),
  delete: vi.fn(),
  signin: vi.fn(),
  use: vi.fn(),
};

vi.mock('surrealdb', () => {
  // biome-ignore lint/suspicious/noExplicitAny: Mock RecordId needs flexible typing for tests
  const MockRecordIdFn = vi.fn(function (this: any, table: string, id: string) {
    this.table = table;
    this.id = id;
    return this;
  });

  return {
    Surreal: class {
      constructor() {
        // biome-ignore lint/correctness/noConstructorReturn: Mock pattern requires returning mock object
        return mockSurrealDB;
      }
    },
    RecordId: MockRecordIdFn,
  };
});

describe('SurrealClient', () => {
  let client: SurrealClient;

  beforeEach(() => {
    vi.clearAllMocks();

    client = new SurrealClient({
      url: 'ws://localhost:8000',
      namespace: 'test',
      database: 'test',
      username: 'root',
      password: 'root',
      schema: './schema.js',
    });

    // Set connected state for tests that need it
    // biome-ignore lint/suspicious/noExplicitAny: Accessing private property for test setup
    (client as any).connected = true;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Connection Management', () => {
    it('should connect to SurrealDB successfully', async () => {
      mockSurrealDB.connect.mockResolvedValue(undefined);
      mockSurrealDB.signin.mockResolvedValue(undefined);
      mockSurrealDB.use.mockResolvedValue(undefined);

      await client.connect();

      expect(mockSurrealDB.connect).toHaveBeenCalledWith('ws://localhost:8000');
      expect(mockSurrealDB.signin).toHaveBeenCalledWith({
        username: 'root',
        password: 'root',
      });
      expect(mockSurrealDB.use).toHaveBeenCalledWith({
        namespace: 'test',
        database: 'test',
      });
    });

    it('should close connection', async () => {
      mockSurrealDB.close.mockResolvedValue(undefined);

      await client.disconnect();

      expect(mockSurrealDB.close).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      mockSurrealDB.connect.mockRejectedValue(new Error('Connection failed'));

      await expect(client.connect()).rejects.toThrow('Connection failed');
    });
  });

  describe('Query Execution', () => {
    it('should execute SQL queries', async () => {
      const mockResult = [{ success: true }];
      // SDK v2: query() returns Query object with .collect() method
      mockSurrealDB.query.mockReturnValue(createMockQuery(mockResult));

      const result = await client.executeQuery('SELECT * FROM user');

      expect(mockSurrealDB.query).toHaveBeenCalledWith('SELECT * FROM user');
      expect(result).toEqual(mockResult);
    });

    it('should handle query errors', async () => {
      // SDK v2: Query object's collect() method can reject
      mockSurrealDB.query.mockReturnValue({
        collect: vi.fn().mockRejectedValue(new Error('Query failed')),
      });

      await expect(client.executeQuery('INVALID SQL')).rejects.toThrow('Query failed');
    });

    // Note: Query logging is handled at a higher level in MigrationManager, not in SurrealClient
  });

  describe('Schema Information', () => {
    it('should get current schema string', async () => {
      const mockSchemaString = 'DEFINE TABLE user SCHEMAFULL;';
      // SDK v2: query() returns Query object with .collect() method
      mockSurrealDB.query.mockReturnValue(createMockQuery(mockSchemaString));

      const schema = await client.getCurrentSchema();

      expect(typeof schema).toBe('string');
    });
  });

  describe('SDK Methods', () => {
    it('should create records using INSERT query', async () => {
      const mockRecord = { id: 'user:123', name: 'John', email: 'john@example.com' };
      // SDK v2: create uses INSERT query with .collect()
      mockSurrealDB.query.mockReturnValue(createMockQuery([[mockRecord]]));

      const data = { name: 'John', email: 'john@example.com' };
      const result = await client.create('user', data);

      expect(mockSurrealDB.query).toHaveBeenCalled();
      expect(result).toEqual(mockRecord);
    });

    it('should select records using SELECT query', async () => {
      const mockRecords = [
        { id: 'user:1', name: 'John' },
        { id: 'user:2', name: 'Jane' },
      ];
      // SDK v2: select uses SELECT query with .collect()
      mockSurrealDB.query.mockReturnValue(createMockQuery([mockRecords]));

      const result = await client.select('user');

      expect(mockSurrealDB.query).toHaveBeenCalled();
      expect(result).toEqual(mockRecords);
    });

    it('should delete records using DELETE query', async () => {
      const mockDeletedRecords = [{ id: '_migrations:abc123' }];
      // SDK v2: delete uses DELETE query with .collect()
      mockSurrealDB.query.mockReturnValue(createMockQuery([mockDeletedRecords]));

      await client.delete('_migrations:abc123');

      expect(mockSurrealDB.query).toHaveBeenCalled();
    });

    it('should handle table name delete', async () => {
      // This test verifies that delete works with simple table names
      mockSurrealDB.query.mockReturnValue(createMockQuery([[]]));

      const result = await client.delete('invalid_id');
      expect(result).toEqual([]);
    });
  });

  describe('Health Check', () => {
    it('should perform health check', async () => {
      // SDK v2: query() returns Query object with .collect() method
      mockSurrealDB.query.mockReturnValue(createMockQuery([{ status: 'OK' }]));

      const isHealthy = await client.healthCheck();

      expect(typeof isHealthy).toBe('boolean');
    });
  });

  describe('Migration Operations', () => {
    it('should apply migration', async () => {
      const migration: Migration = {
        id: 'test-migration',
        appliedAt: new Date(),
        up: 'CREATE TABLE test',
        down: 'DROP TABLE test',
        checksum: 'sha256.abc123',
        downChecksum: 'sha256.def456',
        message: 'Test migration',
      };

      // SDK v2: query() returns Query object with .collect() method
      mockSurrealDB.query.mockReturnValue(createMockQuery([[]]));

      await client.applyMigration(migration);

      expect(mockSurrealDB.query).toHaveBeenCalledWith(migration.up);
      // Note: Migration logging is handled at a higher level, not in SurrealClient
    });

    it('should rollback migration', async () => {
      const migration: Migration = {
        id: 'test-migration',
        appliedAt: new Date(),
        up: 'CREATE TABLE test',
        down: 'DROP TABLE test',
        checksum: 'sha256.abc123',
        downChecksum: 'sha256.def456',
      };

      // SDK v2: query() returns Query object with .collect() method
      mockSurrealDB.query.mockReturnValue(createMockQuery([[]]));

      await client.rollbackMigration(migration);

      expect(mockSurrealDB.query).toHaveBeenCalledWith(migration.down);
      // Note: Migration logging is handled at a higher level, not in SurrealClient
    });
  });
});
