import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SurrealClient } from "../src/database/surreal-client";
import type { Migration } from "../src/types/schema";

// Mock the surrealdb module
const mockSurrealDB = {
  connect: vi.fn(),
  close: vi.fn(),
  query: vi.fn(),
  create: vi.fn(),
  select: vi.fn(),
  delete: vi.fn(),
  signin: vi.fn(),
  use: vi.fn(),
};

vi.mock("surrealdb", () => {
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

describe("SurrealClient", () => {
  let client: SurrealClient;

  beforeEach(() => {
    vi.clearAllMocks();

    client = new SurrealClient({
      url: "ws://localhost:8000",
      namespace: "test",
      database: "test",
      username: "root",
      password: "root",
      schema: "./schema.js",
    });

    // Set connected state for tests that need it
    // biome-ignore lint/suspicious/noExplicitAny: Accessing private property for test setup
    (client as any).connected = true;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Connection Management", () => {
    it("should connect to SurrealDB successfully", async () => {
      mockSurrealDB.connect.mockResolvedValue(undefined);
      mockSurrealDB.signin.mockResolvedValue(undefined);
      mockSurrealDB.use.mockResolvedValue(undefined);

      await client.connect();

      expect(mockSurrealDB.connect).toHaveBeenCalledWith("ws://localhost:8000");
      expect(mockSurrealDB.signin).toHaveBeenCalledWith({
        username: "root",
        password: "root",
      });
      expect(mockSurrealDB.use).toHaveBeenCalledWith({
        namespace: "test",
        database: "test",
      });
    });

    it("should close connection", async () => {
      mockSurrealDB.close.mockResolvedValue(undefined);

      await client.disconnect();

      expect(mockSurrealDB.close).toHaveBeenCalled();
    });

    it("should handle connection errors", async () => {
      mockSurrealDB.connect.mockRejectedValue(new Error("Connection failed"));

      await expect(client.connect()).rejects.toThrow("Connection failed");
    });
  });

  describe("Query Execution", () => {
    it("should execute SQL queries", async () => {
      const mockResult = [{ success: true }];
      mockSurrealDB.query.mockResolvedValue(mockResult);

      const result = await client.executeQuery("SELECT * FROM user");

      expect(mockSurrealDB.query).toHaveBeenCalledWith("SELECT * FROM user");
      expect(result).toEqual(mockResult);
    });

    it("should handle query errors", async () => {
      mockSurrealDB.query.mockRejectedValue(new Error("Query failed"));

      await expect(client.executeQuery("INVALID SQL")).rejects.toThrow("Query failed");
    });

    // Note: Query logging is handled at a higher level in MigrationManager, not in SurrealClient
  });

  describe("Schema Information", () => {
    it("should get current schema string", async () => {
      const mockSchemaString = "DEFINE TABLE user SCHEMAFULL;";
      mockSurrealDB.query.mockResolvedValue(mockSchemaString);

      const schema = await client.getCurrentSchema();

      expect(typeof schema).toBe("string");
    });
  });

  describe("SDK Methods", () => {
    it("should create records using SDK", async () => {
      const mockRecord = { id: "user:123", name: "John" };
      mockSurrealDB.create.mockResolvedValue(mockRecord);

      const data = { name: "John", email: "john@example.com" };
      const result = await client.create("user", data);

      expect(mockSurrealDB.create).toHaveBeenCalledWith("user", data);
      expect(result).toEqual(mockRecord);
    });

    it("should select records using SDK", async () => {
      const mockRecords = [
        { id: "user:1", name: "John" },
        { id: "user:2", name: "Jane" },
      ];
      mockSurrealDB.select.mockResolvedValue(mockRecords);

      const result = await client.select("user");

      expect(mockSurrealDB.select).toHaveBeenCalledWith("user");
      expect(result).toEqual(mockRecords);
    });

    it("should delete records by string ID using SDK", async () => {
      const { RecordId } = await import("surrealdb");
      mockSurrealDB.delete.mockResolvedValue(true);

      await client.delete("_migrations:abc123");

      expect(RecordId).toHaveBeenCalledWith("_migrations", "abc123");
      expect(mockSurrealDB.delete).toHaveBeenCalled();
    });

    it("should handle malformed record IDs", async () => {
      // This test verifies that delete works even with simple table names
      mockSurrealDB.delete.mockResolvedValue(true);

      const result = await client.delete("invalid_id");
      expect(result).toBe(true);
      expect(mockSurrealDB.delete).toHaveBeenCalledWith("invalid_id");
    });
  });

  describe("Health Check", () => {
    it("should perform health check", async () => {
      mockSurrealDB.query.mockResolvedValue([{ status: "OK" }]);

      const isHealthy = await client.healthCheck();

      expect(typeof isHealthy).toBe("boolean");
    });
  });

  describe("Migration Operations", () => {
    it("should apply migration", async () => {
      const migration: Migration = {
        id: "test-migration",
        appliedAt: new Date(),
        up: "CREATE TABLE test",
        down: "DROP TABLE test",
        checksum: "sha256.abc123",
        downChecksum: "sha256.def456",
        message: "Test migration",
      };

      mockSurrealDB.query.mockResolvedValue([]);

      await client.applyMigration(migration);

      expect(mockSurrealDB.query).toHaveBeenCalledWith(migration.up);
      // Note: Migration logging is handled at a higher level, not in SurrealClient
    });

    it("should rollback migration", async () => {
      const migration: Migration = {
        id: "test-migration",
        appliedAt: new Date(),
        up: "CREATE TABLE test",
        down: "DROP TABLE test",
        checksum: "sha256.abc123",
        downChecksum: "sha256.def456",
      };

      mockSurrealDB.query.mockResolvedValue([]);

      await client.rollbackMigration(migration);

      expect(mockSurrealDB.query).toHaveBeenCalledWith(migration.down);
      // Note: Migration logging is handled at a higher level, not in SurrealClient
    });
  });
});
