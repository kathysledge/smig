/**
 * @fileoverview TypeScript declarations for the SurrealDB JavaScript client.
 *
 * This module provides TypeScript type definitions for the SurrealDB client library,
 * enabling type-safe interaction with SurrealDB from TypeScript code. These declarations
 * cover the core functionality needed for database connections, authentication, and query execution.
 *
 * Note: This is a minimal declaration file that covers the methods used by smig.
 * For full SurrealDB client functionality, refer to the official SurrealDB TypeScript client.
 */

declare module 'surrealdb' {
  /**
   * Represents a SurrealDB record identifier.
   *
   * @example
   * ```typescript
   * const recordId = new RecordId('user', '12345');
   * await db.delete(recordId);
   * ```
   */
  export class RecordId {
    constructor(table: string, id: string);
  }

  /**
   * Main SurrealDB client class for database connections and operations.
   *
   * The Surreal class provides the primary interface for connecting to and
   * interacting with SurrealDB databases. It handles connection management,
   * authentication, and query execution.
   *
   * @example
   * ```typescript
   * import { Surreal } from 'surrealdb';
   *
   * const db = new Surreal();
   * await db.connect('ws://localhost:8000');
   * await db.signin({ username: 'root', password: 'root' });
   * await db.use({ namespace: 'test', database: 'test' });
   * const result = await db.query('SELECT * FROM user');
   * await db.close();
   * ```
   */
  export class Surreal {
    /**
     * Establishes a connection to the SurrealDB server.
     *
     * @param url - The WebSocket URL of the SurrealDB server
     * @throws {Error} If connection fails
     */
    connect(url: string): Promise<void>;

    /**
     * Authenticates using a JWT token.
     *
     * @param token - The JWT authentication token
     * @throws {Error} If authentication fails
     */
    authenticate(token: string): Promise<void>;

    /**
     * Signs in with username and password credentials.
     *
     * @param credentials - Object containing username and password
     * @throws {Error} If authentication fails
     */
    signin(credentials: { username: string; password: string }): Promise<void>;

    /**
     * Selects the namespace and database to use for subsequent operations.
     *
     * @param config - Object containing namespace and database names
     * @throws {Error} If namespace or database selection fails
     */
    use(config: { namespace: string; database: string }): Promise<void>;

    /**
     * Executes a SurrealQL query against the database.
     *
     * @param query - The SurrealQL query string to execute
     * @returns The query result data
     * @throws {Error} If query execution fails
     */
    query(query: string): Promise<unknown>;

    /**
     * Creates a new record in the specified table.
     *
     * @param table - The table name or record ID
     * @param data - The data to insert
     * @returns The created record
     * @throws {Error} If creation fails
     */
    create(table: string, data?: unknown): Promise<unknown>;

    /**
     * Selects records from the specified table or record ID.
     *
     * @param target - The table name or record ID
     * @returns The selected records
     * @throws {Error} If selection fails
     */
    select(target: string): Promise<unknown>;

    /**
     * Updates records in the specified table.
     *
     * @param target - The table name or record ID
     * @param data - The data to update
     * @returns The updated records
     * @throws {Error} If update fails
     */
    update(target: string, data: unknown): Promise<unknown>;

    /**
     * Deletes records from the specified table.
     *
     * @param target - The table name, record ID string, or RecordId object
     * @returns The deleted records
     * @throws {Error} If deletion fails
     */
    delete(target: string | RecordId): Promise<unknown>;

    /**
     * Closes the connection to the SurrealDB server.
     *
     * @throws {Error} If closing the connection fails
     */
    close(): Promise<void>;
  }
}
