/**
 * @fileoverview SurrealDB database client wrapper for managing connections and executing queries.
 *
 * This module provides a high-level interface for interacting with SurrealDB databases,
 * specifically designed for schema migration operations. It handles connection management,
 * authentication, query execution, and schema introspection.
 */

import { RecordId, Surreal } from 'surrealdb';
import type { DatabaseConfig, Migration, MigrationStatus } from '../types/schema';

/**
 * High-level client wrapper for SurrealDB database operations.
 *
 * The SurrealClient provides a simplified interface for connecting to and interacting with
 * SurrealDB databases. It handles authentication, connection management, and provides
 * specialized methods for schema introspection and migration management.
 *
 * ## Features
 *
 * - **Connection management**: Automatic connection handling with authentication
 * - **Schema introspection**: Methods to query current database schema structure
 * - **Migration support**: Built-in support for migration tracking and execution
 * - **Error handling**: Comprehensive error handling with meaningful error messages
 *
 * @example
 * ```typescript
 * const client = new SurrealClient({
 *   url: 'ws://localhost:8000',
 *   namespace: 'test',
 *   database: 'test',
 *   username: 'root',
 *   password: 'root'
 * });
 *
 * await client.connect();
 * const schema = await client.getCurrentSchema();
 * await client.disconnect();
 * ```
 */
export class SurrealClient {
  /** The underlying SurrealDB client instance */
  private client: Surreal;
  /** Database connection configuration */
  private config: DatabaseConfig;
  /** Current connection status */
  private connected: boolean = false;

  /**
   * Creates a new SurrealClient instance.
   *
   * @param config - Database connection configuration including URL, namespace, database, and credentials
   *
   * @example
   * ```typescript
   * const client = new SurrealClient({
   *   url: 'ws://localhost:8000',
   *   namespace: 'production',
   *   database: 'app',
   *   username: 'admin',
   *   password: 'secure-password'
   * });
   * ```
   */
  constructor(config: DatabaseConfig) {
    this.config = config;
    this.client = new Surreal();
  }

  /**
   * Establishes a connection to the SurrealDB server.
   *
   * This method handles the complete connection process including server connection,
   * authentication (if credentials are provided), and database selection. Once connected,
   * the client is ready to execute queries against the specified namespace and database.
   *
   * @throws {Error} If connection fails, authentication fails, or database selection fails
   *
   * @example
   * ```typescript
   * try {
   *   await client.connect();
   *   console.log('Connected successfully');
   * } catch (error) {
   *   console.error('Connection failed:', error.message);
   * }
   * ```
   */
  async connect(): Promise<void> {
    try {
      await this.client.connect(this.config.url);

      if (this.config.username && this.config.password) {
        await this.client.signin({
          username: this.config.username,
          password: this.config.password,
        });
      }

      await this.client.use({
        namespace: this.config.namespace,
        database: this.config.database,
      });

      this.connected = true;
    } catch (error) {
      throw new Error(`Failed to connect to SurrealDB: ${error}`);
    }
  }

  /**
   * Closes the connection to the SurrealDB server.
   *
   * This method safely closes the database connection and updates the internal
   * connection status. It's safe to call this method multiple times.
   *
   * @example
   * ```typescript
   * await client.disconnect();
   * console.log('Disconnected from database');
   * ```
   */
  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.close();
      this.connected = false;
    }
  }

  /**
   * Executes a SurrealQL query against the database.
   *
   * This method provides a safe way to execute raw SurrealQL queries with proper
   * error handling and connection validation. It automatically handles query formatting
   * and result processing.
   *
   * @param query - The SurrealQL query string to execute
   * @returns The query result from SurrealDB
   * @throws {Error} If not connected or if query execution fails
   *
   * @example
   * ```typescript
   * const result = await client.executeQuery('SELECT * FROM user LIMIT 10');
   * console.log('Found users:', result);
   * ```
   */
  async executeQuery(query: string): Promise<unknown> {
    if (!this.connected) {
      throw new Error('Not connected to SurrealDB');
    }

    try {
      const result = await this.client.query(query);
      return result;
    } catch (error) {
      throw new Error(`Query execution failed: ${error}`);
    }
  }

  /**
   * Creates a new record in the specified table using the SurrealDB SDK.
   *
   * @param table - The table name
   * @param data - The data to insert
   * @returns The created record
   * @throws {Error} If creation fails or connection is not established
   */
  async create(table: string, data?: unknown): Promise<unknown> {
    if (!this.connected) {
      throw new Error('Not connected to SurrealDB');
    }

    try {
      return await this.client.create(table, data);
    } catch (error) {
      throw new Error(`Create operation failed: ${error}`);
    }
  }

  /**
   * Selects records from the specified table using the SurrealDB SDK.
   *
   * @param target - The table name or record ID
   * @returns The selected records
   * @throws {Error} If selection fails or connection is not established
   */
  async select(target: string): Promise<unknown> {
    if (!this.connected) {
      throw new Error('Not connected to SurrealDB');
    }

    try {
      return await this.client.select(target);
    } catch (error) {
      throw new Error(`Select operation failed: ${error}`);
    }
  }

  /**
   * Deletes records from the specified table using the SurrealDB SDK.
   *
   * @param target - The table name or record ID (format: "table:id" or just "table")
   * @returns The deleted records
   * @throws {Error} If deletion fails or connection is not established
   *
   * @example
   * ```typescript
   * // Delete all records from a table
   * await client.delete('user');
   *
   * // Delete a specific record using string format
   * await client.delete('user:12345');
   *
   * // Delete a specific record using RecordId (done automatically)
   * await client.delete('_migrations:rcbtaxf976y7kg819qws');
   * ```
   */
  async delete(target: string): Promise<unknown> {
    if (!this.connected) {
      throw new Error('Not connected to SurrealDB');
    }

    try {
      // If target contains a colon, it's a record ID that needs to be parsed
      if (target.includes(':')) {
        const [table, id] = target.split(':', 2);
        const recordId = new RecordId(table, id);
        return await this.client.delete(recordId);
      } else {
        // It's a table name, delete all records from the table
        return await this.client.delete(target);
      }
    } catch (error) {
      throw new Error(`Delete operation failed: ${error}`);
    }
  }

  /**
   * Retrieves the current database schema in a formatted string representation.
   * 
   * This method queries the SurrealDB information schema to get details about all
   * tables in the database (excluding the internal _migrations table). The result
   * is formatted as a human-readable schema definition.
   * 
   * @returns A formatted string representation of the current database schema
   * @throws {Error} If the schema query fails
   * 
   * @example
   * ```typescript
   * const schema = await client.getCurrentSchema();
   * console.log('Current schema:
', schema);
   * ```
   */
  async getCurrentSchema(): Promise<string> {
    const query = `
      SELECT
        name,
        schemafull,
        schemaless
      FROM information_schema.tables
      WHERE type = 'table' AND name != '_migrations'
      ORDER BY name;
    `;

    const result = await this.executeQuery(query);
    return this.formatSchemaQuery(result);
  }

  /**
   * Retrieves detailed field information for a specific table.
   *
   * This method queries the SurrealDB information schema to get comprehensive
   * details about all fields in the specified table, including their types,
   * constraints, defaults, and permissions.
   *
   * @param tableName - The name of the table to query fields for
   * @returns Array of field objects containing detailed field information
   *
   * @example
   * ```typescript
   * const fields = await client.getTableFields('user');
   * fields.forEach(field => {
   *   console.log(`${field.name}: ${field.type}`);
   * });
   * ```
   */
  async getTableFields(tableName: string): Promise<unknown[]> {
    const query = `
      SELECT
        name,
        type,
        optional,
        default_value,
        value,
        assert,
        permissions
      FROM information_schema.fields
      WHERE table = $table
      ORDER BY name;
    `;

    const result = await this.executeQuery(query.replace('$table', `'${tableName}'`));
    // biome-ignore lint/suspicious/noExplicitAny: Query results are dynamically typed from database
    return (result as any[])[0]?.result || [];
  }

  /**
   * Retrieves index information for a specific table.
   *
   * @param tableName - The name of the table to query indexes for
   * @returns Array of index objects containing index configuration details
   */
  async getTableIndexes(tableName: string): Promise<unknown[]> {
    const query = `
      SELECT
        name,
        columns,
        unique,
        type,
        analyzer,
        highlights
      FROM information_schema.indexes
      WHERE table = $table
      ORDER BY name;
    `;

    const result = await this.executeQuery(query.replace('$table', `'${tableName}'`));
    // biome-ignore lint/suspicious/noExplicitAny: Query results are dynamically typed from database
    return (result as any[])[0]?.result || [];
  }

  /**
   * Retrieves event information for a specific table.
   *
   * @param tableName - The name of the table to query events for
   * @returns Array of event objects containing event trigger and action details
   */
  async getTableEvents(tableName: string): Promise<unknown[]> {
    const query = `
      SELECT
        name,
        type,
        when_condition,
        then_action
      FROM information_schema.events
      WHERE table = $table
      ORDER BY name;
    `;

    const result = await this.executeQuery(query.replace('$table', `'${tableName}'`));
    // biome-ignore lint/suspicious/noExplicitAny: Query results are dynamically typed from database
    return (result as any[])[0]?.result || [];
  }

  /**
   * Retrieves the current migration status from the database.
   *
   * This method queries the `_migrations` table to get information about
   * applied migrations. If the migrations table doesn't exist, it returns
   * an empty status indicating no migrations have been applied.
   *
   * @returns Migration status object containing the most recent migration info
   *
   * @example
   * ```typescript
   * const status = await client.getMigrationStatus();
   * if (status.applied && status.migration) {
   *   console.log(`Last migration: ${status.migration.id}`);
   * } else {
   *   console.log('No migrations applied yet');
   * }
   * ```
   */
  async getMigrationStatus(): Promise<MigrationStatus> {
    try {
      const query = `
        SELECT
          id,
          applied_at,
          checksum,
          up_sql,
          down_sql
        FROM _migrations
        ORDER BY applied_at;
      `;

      const result = await this.executeQuery(query);
      // biome-ignore lint/suspicious/noExplicitAny: Query results are dynamically typed from database
      const migrations = (result as any[])[0]?.result || [];

      const migrationList = migrations.map((m: Record<string, unknown>) => ({
        id: m.id,
        appliedAt: new Date(m.applied_at as string | number | Date),
        checksum: m.checksum,
        up: m.up_sql,
        down: m.down_sql,
      }));

      return {
        applied: true,
        migration: migrationList.length > 0 ? migrationList[migrationList.length - 1] : undefined,
      };
    } catch (_error) {
      // If migrations table doesn't exist, return empty status
      return {
        applied: false,
        migration: undefined,
      };
    }
  }

  /**
   * Applies a migration to the database and records it in the migration history.
   *
   * This method executes the forward migration SQL and then records the migration
   * in the `_migrations` table for tracking purposes. The operation is performed
   * as a complete unit to maintain consistency.
   *
   * @param migration - The migration object containing SQL and metadata
   * @throws {Error} If migration execution or recording fails
   *
   * @example
   * ```typescript
   * const migration = {
   *   up: 'DEFINE TABLE user SCHEMAFULL;',
   *   down: 'REMOVE TABLE user;',
   *   checksum: 'sha256.abc123...',
   *   downChecksum: 'sha256.def456...',
   *   appliedAt: new Date()
   * };
   * // ID will be auto-generated by SurrealDB
   * await client.applyMigration(migration);
   * ```
   */
  async applyMigration(migration: Migration): Promise<void> {
    // Execute up migration
    await this.executeQuery(migration.up);

    // Record migration using SDK methods (ID auto-generated by SurrealDB)
    const migrationData = {
      appliedAt: new Date(),
      up: migration.up,
      down: migration.down,
      message: migration.message || undefined, // undefined -> NONE in SurrealDB
      checksum: migration.checksum,
      downChecksum: migration.downChecksum,
    };

    await this.create('_migrations', migrationData);
  }

  /**
   * Rolls back a migration and removes it from the migration history.
   *
   * This method executes the rollback migration SQL and then removes the migration
   * record from the `_migrations` table. This effectively undoes the migration
   * and its tracking.
   *
   * @param migration - The migration object to rollback
   * @throws {Error} If rollback execution or record removal fails
   */
  async rollbackMigration(migration: Migration): Promise<void> {
    // Execute down migration
    await this.executeQuery(migration.down);

    // Remove migration record using SDK method
    await this.delete(migration.id);
  }

  /**
   * Formats schema query results into a human-readable string representation.
   */
  private formatSchemaQuery(result: unknown): string {
    // biome-ignore lint/suspicious/noExplicitAny: Query results are dynamically typed from database
    const resultArray = result as any[];
    if (!result || !resultArray[0] || !resultArray[0].result) {
      return '';
    }

    const tables = resultArray[0].result;
    const tableGroups: string[] = [];

    for (const table of tables) {
      const lines = [
        `-- Table: ${table.name}`,
        `DEFINE TABLE ${table.name} ${table.schemafull ? 'SCHEMAFULL' : 'SCHEMALESS'};`,
      ];
      tableGroups.push(lines.join('\n'));
    }

    return tableGroups.join('\n\n');
  }

  /**
   * Performs a basic health check on the database connection.
   *
   * This method attempts to execute a simple query to verify that the database
   * connection is working properly and that the migrations table is accessible.
   *
   * @returns True if the connection is healthy, false otherwise
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.executeQuery('SELECT * FROM _migrations LIMIT 1;');
      return true;
    } catch (_error) {
      return false;
    }
  }
}
