/**
 * @fileoverview Core migration management system for SurrealDB schema evolution.
 *
 * This module contains the MigrationManager class, which is the central orchestrator
 * for all database schema migration operations. It handles schema comparison, migration
 * generation, application tracking, and rollback capabilities, providing a complete
 * solution for managing database schema evolution over time.
 */

import { createHash } from "node:crypto";
import * as path from "node:path";
import * as fs from "fs-extra";
import { SurrealClient } from "../database/surreal-client";
import type {
  DatabaseConfig,
  Migration,
  MigrationStatus,
  SurrealAnalyzer,
  SurrealDBSchema,
  SurrealFunction,
  SurrealScope,
} from "../types/schema";
import { debugLog, debugLogSchema } from "../utils/debug-logger";

/**
 * Main class for managing SurrealDB database migrations.
 *
 * The MigrationManager handles the complete migration lifecycle:
 * - Schema comparison between current database and desired schema
 * - Automatic generation of migration scripts
 * - Application of migrations to the database
 * - Tracking of applied migrations
 * - Rollback capabilities
 *
 * ## Usage
 *
 * ```typescript
 * import { MigrationManager } from 'smig';
 *
 * const manager = new MigrationManager({
 *   url: 'ws://localhost:8000',
 *   namespace: 'test',
 *   database: 'test',
 *   username: 'root',
 *   password: 'root'
 * });
 *
 * await manager.initialize();
 * await manager.migrate(schema, 'add-user-table');
 * ```
 *
 * ## Features
 *
 * - **Schema comparison**: Compares TypeScript schema definitions with current database state
 * - **Automatic diff generation**: Generates only the necessary SurrealQL changes
 * - **Migration tracking**: Maintains a `_migrations` table to track applied migrations
 * - **Rollback support**: Can rollback migrations to previous states
 * - **Field modification detection**: Detects changes in field properties (type, constraints, defaults)
 * - **Relation table handling**: Properly handles SurrealDB relation tables
 *
 * @example
 * ```typescript
 * // Initialize and run a migration
 * const manager = new MigrationManager(config);
 * await manager.initialize();
 *
 * // Apply a migration
 * await manager.migrate(userSchema, 'create-users');
 *
 * // Check migration status
 * const status = await manager.status();
 *
 * // Rollback last migration
 * await manager.rollback();
 * ```
 */
export class MigrationManager {
  private client: SurrealClient;

  /**
   * Creates a new MigrationManager instance.
   *
   * @param config - Database connection configuration
   * @param client - Optional SurrealClient instance (useful for testing)
   *
   * @example
   * ```typescript
   * const manager = new MigrationManager({
   *   url: 'ws://localhost:8000',
   *   namespace: 'test',
   *   database: 'test',
   *   username: 'root',
   *   password: 'root'
   * });
   * ```
   */
  constructor(config: DatabaseConfig, client?: SurrealClient) {
    this.client = client || new SurrealClient(config);
  }

  /**
   * Initializes the migration manager by connecting to the database and ensuring the migrations table exists.
   *
   * This method must be called before using any other migration methods.
   * It establishes the database connection and creates the `_migrations` table if it doesn't exist.
   *
   * @throws {Error} If connection fails or migrations table cannot be created
   *
   * @example
   * ```typescript
   * const manager = new MigrationManager(config);
   * await manager.initialize();
   * // Now ready to use migrate(), status(), etc.
   * ```
   */
  async initialize(): Promise<void> {
    // Connect the client if it's not already connected
    await this.client.connect();
    await this.createMigrationsTable();
  }

  /**
   * Creates the _migrations table if it doesn't already exist.
   *
   * This table tracks all applied migrations with their checksums, SQL content,
   * and timestamps. It's the foundation of the migration tracking system.
   *
   * The table includes:
   * - appliedAt: When the migration was applied
   * - up: Forward migration SQL
   * - down: Rollback migration SQL
   * - message: Optional description of the migration
   * - checksum: SHA256 hash of the up migration (for integrity verification)
   * - downChecksum: SHA256 hash of the down migration (for integrity verification)
   */
  private async createMigrationsTable(): Promise<void> {
    try {
      // Check if the table already exists by trying to query it
      await this.client.executeQuery("SELECT * FROM _migrations LIMIT 1");
      // If we get here, the table exists, so we don't need to create it
      return;
    } catch (_error) {
      // Table doesn't exist, so create it
      const createTableQuery = `
        DEFINE TABLE _migrations SCHEMAFULL;
        DEFINE FIELD appliedAt ON TABLE _migrations TYPE datetime;
        DEFINE FIELD up ON TABLE _migrations TYPE string;
        DEFINE FIELD down ON TABLE _migrations TYPE string;
        DEFINE FIELD message ON TABLE _migrations TYPE option<string>;
        DEFINE FIELD checksum ON TABLE _migrations TYPE string;
        DEFINE FIELD downChecksum ON TABLE _migrations TYPE string;
      `;

      await this.client.executeQuery(createTableQuery);
    }
  }

  /**
   * Applies a migration to bring the database schema in line with the provided schema definition.
   *
   * This method compares the current database schema with the provided schema and generates
   * only the necessary changes. It then applies those changes and records the migration
   * in the `_migrations` table for tracking purposes.
   *
   * @param schema - The desired schema definition
   *
   * @throws {Error} If the migration cannot be applied
   *
   * @example
   * ```typescript
   * const userSchema = defineSchema({
   *   table: 'user',
   *   fields: {
   *     id: uuid().default('rand::uuid::v4()'),
   *     name: string().required(),
   *     email: string().unique()
   *   }
   * });
   *
   * await manager.migrate(userSchema);
   * ```
   */
  async migrate(
    schema: SurrealDBSchema,
    upMigration?: string,
    downMigration?: string,
    message?: string,
  ): Promise<void> {
    const migrationId = `${Date.now()}_migration`;

    // Generate migration diff if not provided
    let up: string;
    let down: string;

    if (upMigration && downMigration) {
      // Manual migrations provided - use them directly
      up = upMigration.trim();
      down = downMigration.trim();
    } else {
      // Auto-generate migration - check for changes first
      const hasSchemaChanges = await this.hasChanges(schema);

      if (!hasSchemaChanges) {
        debugLog("No changes detected - skipping migration");
        throw new Error("No changes detected. Database schema is already up to date.");
      }

      const diff = await this.generateDiff(schema);
      up = diff.up;
      down = diff.down;
    }

    const checksum = this.calculateChecksum(up);
    const downChecksum = this.calculateChecksum(down);

    // Apply migration to database
    await this.client.executeQuery(up);

    // Record migration
    const recordId = await this.recordMigration({
      id: migrationId, // This is now just for logging/reference, actual ID comes from SurrealDB
      appliedAt: new Date(),
      up,
      down,
      message,
      checksum,
      downChecksum,
    });

    debugLog(`Migration completed with record ID: ${recordId}`);
  }

  /**
   * Rolls back a specific migration or the most recent migration.
   *
   * This method executes the rollback SQL for the specified migration and removes
   * the migration record from the tracking table. If no migration ID is provided,
   * it rolls back the most recently applied migration.
   *
   * ## Security Features
   *
   * - **Integrity verification**: Verifies both up and down migration checksums before rollback
   * - **Corruption detection**: Ensures the stored migration data hasn't been tampered with
   * - **Safe rollback**: Only executes rollback if all integrity checks pass
   *
   * @param migrationId - Optional ID of the specific migration to rollback
   * @throws {Error} If no migrations exist, migration not found, or integrity verification fails
   *
   * @example
   * ```typescript
   * // Rollback the last migration
   * await manager.rollback();
   *
   * // Rollback a specific migration
   * await manager.rollback('20231201_add_users');
   * ```
   */
  async rollback(migrationId?: string): Promise<void> {
    debugLog(`Starting rollback process. Migration ID: ${migrationId || "latest"}`);
    const migrations = await this.getAppliedMigrations();
    debugLog(`Found ${migrations.length} applied migrations for rollback`);

    if (migrations.length === 0) {
      throw new Error("No migrations to rollback");
    }

    debugLog(`Available migration IDs: ${migrations.map((m) => m.id).join(", ")}`);

    const migrationToRollback = migrationId
      ? migrations.find((m) => String(m.id) === String(migrationId))
      : migrations[migrations.length - 1];

    if (!migrationToRollback) {
      debugLog(
        `Migration not found. Requested: ${migrationId}, Available: [${migrations.map((m) => m.id).join(", ")}]`,
      );
      throw new Error(
        `Migration ${migrationId} not found. Available migrations: ${migrations.map((m) => m.id).join(", ")}`,
      );
    }

    debugLog(`Selected migration for rollback: ${migrationToRollback.id}`);

    // Verify migration integrity before rollback
    debugLog(`Verifying integrity of migration ${migrationToRollback.id} before rollback`);

    if (!this.verifyChecksum(migrationToRollback.up, migrationToRollback.checksum)) {
      throw new Error(
        `Migration integrity check failed: up migration checksum mismatch for ${migrationToRollback.id}. ` +
          `Expected: ${migrationToRollback.checksum}, Got: ${this.calculateChecksum(migrationToRollback.up, this.parseChecksum(migrationToRollback.checksum).algorithm)}. ` +
          `The migration data may have been corrupted or tampered with.`,
      );
    }

    if (!this.verifyChecksum(migrationToRollback.down, migrationToRollback.downChecksum)) {
      throw new Error(
        `Migration integrity check failed: down migration checksum mismatch for ${migrationToRollback.id}. ` +
          `Expected: ${migrationToRollback.downChecksum}, Got: ${this.calculateChecksum(migrationToRollback.down, this.parseChecksum(migrationToRollback.downChecksum).algorithm)}. ` +
          `The rollback data may have been corrupted or tampered with.`,
      );
    }

    debugLog(`Integrity verification passed for migration ${migrationToRollback.id}`);

    // Execute rollback
    debugLog(`Executing rollback for migration ${migrationToRollback.id}`);
    debugLog(`Down migration SQL:`, migrationToRollback.down);

    if (!migrationToRollback.down || migrationToRollback.down.trim().length === 0) {
      throw new Error(`Down migration for ${migrationToRollback.id} is empty. Cannot rollback.`);
    }

    try {
      const result = await this.client.executeQuery(migrationToRollback.down);
      debugLog(`Rollback SQL execution result:`, result);
    } catch (error) {
      debugLog(`Rollback SQL execution failed:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to execute rollback SQL: ${errorMessage}`);
    }

    // Remove migration record
    await this.removeMigration(migrationToRollback.id);
    debugLog(`Successfully rolled back migration ${migrationToRollback.id}`);
  }

  /**
   * Retrieves the current migration status for the database.
   *
   * This method returns an array of migration status objects, one for each
   * migration that has been applied to the database. Each status object
   * contains information about when the migration was applied and its content.
   *
   * @returns Array of migration status objects showing all applied migrations
   *
   * @example
   * ```typescript
   * const status = await manager.status();
   * console.log(`Applied ${status.length} migrations`);
   *
   * status.forEach(s => {
   *   if (s.migration) {
   *     console.log(`${s.migration.id} - ${s.migration.appliedAt}`);
   *   }
   * });
   * ```
   */
  async status(): Promise<MigrationStatus[]> {
    debugLog("Getting migration status...");
    const appliedMigrations = await this.getAppliedMigrations();
    debugLog(`Status: Found ${appliedMigrations.length} applied migrations`);

    const status = appliedMigrations.map((migration) => ({
      applied: true,
      migration,
    }));

    debugLog("Migration status result:", status);
    return status;
  }

  /**
   * Checks if there are pending changes between the current database schema and the provided schema.
   *
   * This method performs a comprehensive comparison between the current database state
   * and the desired schema definition. It analyzes tables, fields, indexes, events,
   * and relations to determine if any changes would be generated by a migration.
   *
   * @param schema - The desired schema definition to compare against
   * @returns True if changes would be applied, false if schemas are identical
   *
   * @example
   * ```typescript
   * const hasChanges = await manager.hasChanges(newSchema);
   * if (hasChanges) {
   *   console.log('Changes detected - migration needed');
   *   await manager.migrate(newSchema);
   * } else {
   *   console.log('No changes - database is up to date');
   * }
   * ```
   */
  async hasChanges(schema: SurrealDBSchema): Promise<boolean> {
    // Get current database schema (virtualized to match TypeScript format)
    const currentSchema = await this.getCurrentDatabaseSchema();

    // Log schema representations for debugging
    debugLogSchema("Current Database Schema", currentSchema);
    debugLogSchema("New Schema Definition", schema);

    debugLog(
      "Current schema tables:",
      currentSchema.tables.map((t) => t.name),
    );
    debugLog(
      "New schema tables:",
      schema.tables.map((t) => t.name),
    );

    // Check for new tables
    for (const newTable of schema.tables) {
      const currentTable = currentSchema.tables.find((t) => t.name === newTable.name);

      debugLog(`Comparing table ${newTable.name}:`, {
        exists: !!currentTable,
        newFields: newTable.fields.map((f) => f.name),
        currentFields: currentTable?.fields.map((f) => f.name) || [],
      });

      if (!currentTable) {
        return true; // New table found
      }

      // Check for field changes
      const fieldChanges = await this.compareTableFields(newTable, currentTable);
      if (fieldChanges.length > 0) {
        return true; // Field changes found
      }

      // Check for index changes
      const indexChanges = this.compareTableIndexes(newTable, currentTable);
      if (indexChanges.length > 0) {
        return true; // Index changes found
      }

      // Check for event changes
      const eventChanges = this.compareTableEvents(newTable, currentTable);
      if (eventChanges.length > 0) {
        return true; // Event changes found
      }
    }

    // Check for removed tables
    for (const currentTable of currentSchema.tables) {
      const stillExists = schema.tables.find((t) => t.name === currentTable.name);
      if (!stillExists) {
        return true; // Removed table found
      }
    }

    // Check for relation changes
    for (const newRelation of schema.relations) {
      const currentRelation = currentSchema.relations.find((t) => t.name === newRelation.name);

      if (!currentRelation) {
        return true; // New relation found
      }

      // Check for relation property changes (from/to)
      if (this.hasRelationPropertiesChanged(newRelation, currentRelation)) {
        return true; // Relation properties changed
      }

      // Check for relation field changes
      const fieldChanges = await this.compareTableFields(newRelation, currentRelation);
      if (fieldChanges.length > 0) {
        return true; // Relation field changes found
      }

      // Check for relation index changes
      const indexChanges = this.compareTableIndexes(newRelation, currentRelation);
      if (indexChanges.length > 0) {
        return true; // Relation index changes found
      }

      // Check for relation event changes
      const eventChanges = this.compareTableEvents(newRelation, currentRelation);
      if (eventChanges.length > 0) {
        return true; // Relation event changes found
      }
    }

    // Check for removed relations
    for (const currentRelation of currentSchema.relations) {
      const stillExists = schema.relations.find((t) => t.name === currentRelation.name);
      if (!stillExists) {
        return true; // Removed relation found
      }
    }

    // Check for function changes
    for (const newFunction of schema.functions || []) {
      const currentFunction = (currentSchema.functions || []).find(
        (f) => f.name === newFunction.name,
      );

      if (!currentFunction) {
        return true; // New function found
      }

      // Check if function has been modified
      if (this.isFunctionModified(currentFunction, newFunction)) {
        return true; // Function modified
      }
    }

    // Check for removed functions
    for (const currentFunction of currentSchema.functions || []) {
      const stillExists = (schema.functions || []).find((f) => f.name === currentFunction.name);
      if (!stillExists) {
        return true; // Removed function found
      }
    }

    // Check for scope changes
    for (const newScope of schema.scopes || []) {
      const currentScope = (currentSchema.scopes || []).find((s) => s.name === newScope.name);

      if (!currentScope) {
        return true; // New scope found
      }

      // Check if scope has been modified
      if (this.isScopeModified(currentScope, newScope)) {
        return true; // Scope modified
      }
    }

    // Check for removed scopes
    for (const currentScope of currentSchema.scopes || []) {
      const stillExists = (schema.scopes || []).find((s) => s.name === currentScope.name);
      if (!stillExists) {
        return true; // Removed scope found
      }
    }

    // Check for analyzer changes
    for (const newAnalyzer of schema.analyzers || []) {
      const currentAnalyzer = (currentSchema.analyzers || []).find(
        (a) => a.name === newAnalyzer.name,
      );

      if (!currentAnalyzer) {
        return true; // New analyzer found
      }

      // Check if analyzer has been modified
      if (this.isAnalyzerModified(currentAnalyzer, newAnalyzer)) {
        return true; // Analyzer modified
      }
    }

    // Check for removed analyzers
    for (const currentAnalyzer of currentSchema.analyzers || []) {
      const stillExists = (schema.analyzers || []).find((a) => a.name === currentAnalyzer.name);
      if (!stillExists) {
        return true; // Removed analyzer found
      }
    }

    return false; // No changes detected
  }

  /**
   * Generates comprehensive forward and backward migration scripts for schema changes.
   *
   * This method performs an intelligent comparison between the current database schema
   * and the provided schema definition, generating both forward (up) and backward (down)
   * migration scripts. The system analyzes all schema elements including tables, fields,
   * indexes, events, and relations to create precise migration operations.
   *
   * ## Advanced Features
   *
   * - **Bi-directional migrations**: Generates both up and down scripts for complete rollback support
   * - **Field modification detection**: Detects changes in field types, constraints, defaults, and permissions
   * - **Relation handling**: Properly manages SurrealDB graph relations with automatic in/out fields
   * - **Index management**: Tracks index additions, removals, and modifications across all types
   * - **Event tracking**: Manages database triggers and their lifecycle
   * - **Change logging**: Maintains detailed logs for rollback script generation
   * - **Schema introspection**: Uses SurrealDB's native INFO commands for accurate schema reading
   *
   * ## Migration Types Handled
   *
   * - **Tables**: Creation, removal, and schema enforcement changes
   * - **Fields**: Addition, removal, type changes, constraint modifications
   * - **Indexes**: All index types (BTREE, HASH, SEARCH, MTREE) with their specific properties
   * - **Events**: CREATE, UPDATE, DELETE triggers with conditional logic
   * - **Relations**: Graph edge tables with proper field inheritance
   *
   * @param schema - The desired schema definition to migrate towards
   * @returns An object containing both forward (up) and backward (down) migration scripts
   *
   * @example
   * ```typescript
   * const { up, down } = await manager.generateDiff(newSchema);
   *
   * console.log('Forward migration:');
   * console.log(up);
   * // Output:
   * // -- Migration diff for 2023-12-01T10:30:00.000Z
   * //
   * // -- New table: user
   * // DEFINE TABLE user SCHEMAFULL;
   * // DEFINE FIELD id ON TABLE user TYPE uuid DEFAULT rand::uuid::v4();
   * // DEFINE FIELD name ON TABLE user TYPE string ASSERT $value != NONE;
   *
   * console.log('Rollback migration:');
   * console.log(down);
   * // Output:
   * // -- Rollback migration
   * //
   * // -- Remove table user
   * // REMOVE TABLE user;
   * ```
   */
  async generateDiff(schema: SurrealDBSchema): Promise<{ up: string; down: string }> {
    const upChanges: string[] = [];
    const downChanges: string[] = [];
    const changeLog: Array<{
      type: string;
      table: string;
      operation: string;
      // biome-ignore lint/suspicious/noExplicitAny: Dynamic schema introspection requires flexible types
      details: any;
    }> = [];

    upChanges.push(`-- Migration diff for ${new Date().toISOString()}`);
    upChanges.push("");

    // Get current database schema (virtualized to match TypeScript format)
    const currentSchema = await this.getCurrentDatabaseSchema();

    // Compare tables
    for (const newTable of schema.tables) {
      const currentTable = currentSchema.tables.find((t) => t.name === newTable.name);

      debugLog(`Comparing table ${newTable.name}:`, {
        exists: !!currentTable,
        newFields: newTable.fields.map((f) => f.name),
        currentFields: currentTable?.fields.map((f) => f.name) || [],
      });

      if (!currentTable) {
        // New table
        upChanges.push(`-- New table: ${newTable.name}`);
        const schemaMode = newTable.schemafull === false ? "SCHEMALESS" : "SCHEMAFULL";
        upChanges.push(`DEFINE TABLE ${newTable.name} ${schemaMode};`);

        // Add fields
        for (const field of newTable.fields) {
          upChanges.push(this.generateFieldDefinition(newTable.name, field));
        }

        // Add indexes
        for (const index of newTable.indexes) {
          upChanges.push(this.generateIndexDefinition(newTable.name, index));
        }

        // Add events
        for (const event of newTable.events) {
          upChanges.push(this.generateEventDefinition(newTable.name, event));
        }
        upChanges.push("");

        // Track for rollback
        changeLog.push({
          type: "table",
          table: newTable.name,
          operation: "create",
          details: {
            fields: newTable.fields,
            indexes: newTable.indexes,
            events: newTable.events,
          },
        });
      } else {
        // Existing table - check for field changes
        const fieldChanges = await this.compareTableFields(newTable, currentTable);
        debugLog(`Field changes for ${newTable.name}:`, fieldChanges);
        upChanges.push(...fieldChanges);

        // Check for index changes
        const indexChanges = this.compareTableIndexes(newTable, currentTable);
        debugLog(`Index changes for ${newTable.name}:`, indexChanges);
        upChanges.push(...indexChanges);

        // Check for event changes
        const eventChanges = this.compareTableEvents(newTable, currentTable);
        debugLog(`Event changes for ${newTable.name}:`, eventChanges);
        upChanges.push(...eventChanges);

        // Track changes for rollback
        if (fieldChanges.length > 0 || indexChanges.length > 0 || eventChanges.length > 0) {
          changeLog.push({
            type: "table",
            table: newTable.name,
            operation: "modify",
            details: { fieldChanges, indexChanges, eventChanges, currentTable },
          });
        }
      }
    }

    // Check for removed tables
    for (const currentTable of currentSchema.tables) {
      const stillExists = schema.tables.find((t) => t.name === currentTable.name);
      if (!stillExists) {
        upChanges.push(`-- Removed table: ${currentTable.name}`);
        upChanges.push(`REMOVE TABLE ${currentTable.name};`);
        upChanges.push("");

        // Track for rollback
        changeLog.push({
          type: "table",
          table: currentTable.name,
          operation: "remove",
          details: { currentTable },
        });
      }
    }

    // Handle relations
    for (const newRelation of schema.relations) {
      const currentRelation = currentSchema.relations.find((t) => t.name === newRelation.name);

      if (!currentRelation) {
        // New relation
        upChanges.push(`-- New relation: ${newRelation.name}`);
        const schemaMode = newRelation.schemafull === false ? "SCHEMALESS" : "SCHEMAFULL";
        upChanges.push(`DEFINE TABLE ${newRelation.name} ${schemaMode};`);

        // Add fields
        for (const field of newRelation.fields) {
          upChanges.push(this.generateFieldDefinition(newRelation.name, field));
        }

        // Add indexes
        for (const index of newRelation.indexes) {
          upChanges.push(this.generateIndexDefinition(newRelation.name, index));
        }

        // Add events
        for (const event of newRelation.events) {
          upChanges.push(this.generateEventDefinition(newRelation.name, event));
        }
        upChanges.push("");

        // Track for rollback
        changeLog.push({
          type: "relation",
          table: newRelation.name,
          operation: "create",
          details: {
            fields: newRelation.fields,
            indexes: newRelation.indexes,
            events: newRelation.events,
          },
        });
      } else {
        // Existing relation - check for changes

        // Check if fundamental relation properties changed (from/to)
        const relationPropertiesChanged = this.hasRelationPropertiesChanged(
          newRelation,
          currentRelation,
        );

        if (relationPropertiesChanged) {
          // If from/to changed, we need to recreate the relation entirely
          upChanges.push(`-- Recreating relation: ${newRelation.name} (from/to changed)`);
          upChanges.push(`REMOVE TABLE ${newRelation.name};`);
          const schemaMode = newRelation.schemafull === false ? "SCHEMALESS" : "SCHEMAFULL";
          upChanges.push(`DEFINE TABLE ${newRelation.name} ${schemaMode};`);

          // Add all fields
          for (const field of newRelation.fields) {
            upChanges.push(this.generateFieldDefinition(newRelation.name, field));
          }

          // Add all indexes
          for (const index of newRelation.indexes) {
            upChanges.push(this.generateIndexDefinition(newRelation.name, index));
          }

          // Add all events
          for (const event of newRelation.events) {
            upChanges.push(this.generateEventDefinition(newRelation.name, event));
          }
          upChanges.push("");

          // Track for rollback - recreation means we need to restore the old relation
          changeLog.push({
            type: "relation",
            table: newRelation.name,
            operation: "recreate",
            details: {
              oldRelation: currentRelation,
              newRelation: newRelation,
            },
          });
        } else {
          // No fundamental changes, check for field/index/event modifications
          const fieldChanges = await this.compareTableFields(newRelation, currentRelation);
          upChanges.push(...fieldChanges);

          const indexChanges = this.compareTableIndexes(newRelation, currentRelation);
          upChanges.push(...indexChanges);

          const eventChanges = this.compareTableEvents(newRelation, currentRelation);
          upChanges.push(...eventChanges);

          // Track changes for rollback
          if (fieldChanges.length > 0 || indexChanges.length > 0 || eventChanges.length > 0) {
            changeLog.push({
              type: "relation",
              table: newRelation.name,
              operation: "modify",
              details: {
                fieldChanges,
                indexChanges,
                eventChanges,
                currentRelation,
              },
            });
          }
        }
      }
    }

    // Check for removed relations
    for (const currentRelation of currentSchema.relations) {
      const stillExists = schema.relations.find((r) => r.name === currentRelation.name);
      if (!stillExists) {
        upChanges.push(`-- Removed relation: ${currentRelation.name}`);
        upChanges.push(`REMOVE TABLE ${currentRelation.name};`);
        upChanges.push("");

        // Track for rollback
        changeLog.push({
          type: "relation",
          table: currentRelation.name,
          operation: "remove",
          details: { currentRelation },
        });
      }
    }

    // Handle functions
    for (const newFunction of schema.functions || []) {
      const currentFunction = (currentSchema.functions || []).find(
        (f) => f.name === newFunction.name,
      );

      if (!currentFunction) {
        // New function
        upChanges.push(`-- New function: ${newFunction.name}`);
        upChanges.push(this.generateFunctionDefinition(newFunction));
        upChanges.push("");

        // Track for rollback
        changeLog.push({
          type: "function",
          table: newFunction.name,
          operation: "create",
          details: { func: newFunction },
        });
      } else {
        // Check if function has been modified
        const funcModified = this.isFunctionModified(currentFunction, newFunction);
        if (funcModified) {
          upChanges.push(`-- Modified function: ${newFunction.name}`);
          upChanges.push(this.generateFunctionDefinition(newFunction, true)); // true = use OVERWRITE
          upChanges.push("");

          // Track for rollback
          changeLog.push({
            type: "function",
            table: newFunction.name,
            operation: "modify",
            details: { currentFunction, newFunction },
          });
        }
      }
    }

    // Check for removed functions
    for (const currentFunction of currentSchema.functions || []) {
      const stillExists = (schema.functions || []).find((f) => f.name === currentFunction.name);
      if (!stillExists) {
        upChanges.push(`-- Removed function: ${currentFunction.name}`);
        upChanges.push(`REMOVE FUNCTION ${currentFunction.name};`);
        upChanges.push("");

        // Track for rollback
        changeLog.push({
          type: "function",
          table: currentFunction.name,
          operation: "remove",
          details: { currentFunction },
        });
      }
    }

    // Handle scopes
    for (const newScope of schema.scopes || []) {
      const currentScope = (currentSchema.scopes || []).find((s) => s.name === newScope.name);

      if (!currentScope) {
        // New scope
        upChanges.push(`-- New scope: ${newScope.name}`);
        upChanges.push(this.generateScopeDefinition(newScope));
        upChanges.push("");

        // Track for rollback
        changeLog.push({
          type: "scope",
          table: newScope.name,
          operation: "create",
          details: { scope: newScope },
        });
      } else {
        // Check if scope has been modified
        const scopeModified = this.isScopeModified(currentScope, newScope);
        if (scopeModified) {
          upChanges.push(`-- Modified scope: ${newScope.name}`);
          upChanges.push(this.generateScopeDefinition(newScope, true)); // true = use OVERWRITE
          upChanges.push("");

          // Track for rollback
          changeLog.push({
            type: "scope",
            table: newScope.name,
            operation: "modify",
            details: { currentScope, newScope },
          });
        }
      }
    }

    // Check for removed scopes
    for (const currentScope of currentSchema.scopes || []) {
      const stillExists = (schema.scopes || []).find((s) => s.name === currentScope.name);
      if (!stillExists) {
        upChanges.push(`-- Removed scope: ${currentScope.name}`);
        upChanges.push(`REMOVE ACCESS ${currentScope.name} ON DATABASE;`);
        upChanges.push("");

        // Track for rollback
        changeLog.push({
          type: "scope",
          table: currentScope.name,
          operation: "remove",
          details: { currentScope },
        });
      }
    }

    // Handle analyzers
    for (const newAnalyzer of schema.analyzers || []) {
      const currentAnalyzer = (currentSchema.analyzers || []).find(
        (a) => a.name === newAnalyzer.name,
      );

      if (!currentAnalyzer) {
        // New analyzer
        upChanges.push(`-- New analyzer: ${newAnalyzer.name}`);
        upChanges.push(this.generateAnalyzerDefinition(newAnalyzer));
        upChanges.push("");

        // Track for rollback
        changeLog.push({
          type: "analyzer",
          table: newAnalyzer.name,
          operation: "create",
          details: { analyzer: newAnalyzer },
        });
      } else {
        // Check if analyzer has been modified
        const analyzerModified = this.isAnalyzerModified(currentAnalyzer, newAnalyzer);
        if (analyzerModified) {
          upChanges.push(`-- Modified analyzer: ${newAnalyzer.name}`);
          upChanges.push(this.generateAnalyzerDefinition(newAnalyzer, true)); // true = use OVERWRITE
          upChanges.push("");

          // Track for rollback
          changeLog.push({
            type: "analyzer",
            table: newAnalyzer.name,
            operation: "modify",
            details: { currentAnalyzer, newAnalyzer },
          });
        }
      }
    }

    // Check for removed analyzers
    for (const currentAnalyzer of currentSchema.analyzers || []) {
      const stillExists = (schema.analyzers || []).find((a) => a.name === currentAnalyzer.name);
      if (!stillExists) {
        upChanges.push(`-- Removed analyzer: ${currentAnalyzer.name}`);
        upChanges.push(`REMOVE ANALYZER ${currentAnalyzer.name};`);
        upChanges.push("");

        // Track for rollback
        changeLog.push({
          type: "analyzer",
          table: currentAnalyzer.name,
          operation: "remove",
          details: { currentAnalyzer },
        });
      }
    }

    // Generate rollback migration (reverse order of changes)
    downChanges.push("-- Rollback migration");
    downChanges.push("");

    // Process changes in reverse order for rollback
    for (let i = changeLog.length - 1; i >= 0; i--) {
      const change = changeLog[i];

      switch (change.operation) {
        case "create":
          // Rollback create = remove
          if (change.type === "table" || change.type === "relation") {
            downChanges.push(`-- Rollback: Remove ${change.type} ${change.table}`);
            downChanges.push(`REMOVE TABLE ${change.table};`);
            downChanges.push("");
          } else if (change.type === "function") {
            downChanges.push(`-- Rollback: Remove function ${change.table}`);
            downChanges.push(`REMOVE FUNCTION ${change.table};`);
            downChanges.push("");
          } else if (change.type === "scope") {
            downChanges.push(`-- Rollback: Remove scope ${change.table}`);
            downChanges.push(`REMOVE ACCESS ${change.table} ON DATABASE;`);
            downChanges.push("");
          } else if (change.type === "analyzer") {
            downChanges.push(`-- Rollback: Remove analyzer ${change.table}`);
            downChanges.push(`REMOVE ANALYZER ${change.table};`);
            downChanges.push("");
          }
          break;

        case "remove":
          // Rollback remove = recreate
          if (change.type === "table" || change.type === "relation") {
            const currentTable = change.details.currentTable;

            // Check if currentTable exists before proceeding
            if (!currentTable) {
              debugLog(
                `Warning: Cannot generate rollback for removed ${change.table} - original table state not found`,
              );
              break;
            }

            downChanges.push(`-- Rollback: Recreate ${change.type} ${change.table}`);
            const schemaMode = currentTable.schemafull === false ? "SCHEMALESS" : "SCHEMAFULL";
            downChanges.push(`DEFINE TABLE ${change.table} ${schemaMode};`);

            // Recreate fields
            if (currentTable.fields) {
              for (const field of currentTable.fields) {
                downChanges.push(this.generateFieldDefinition(change.table, field));
              }
            }

            // Recreate indexes
            if (currentTable.indexes) {
              for (const index of currentTable.indexes) {
                downChanges.push(this.generateIndexDefinition(change.table, index));
              }
            }

            // Recreate events
            if (currentTable.events) {
              for (const event of currentTable.events) {
                downChanges.push(this.generateEventDefinition(change.table, event));
              }
            }
            downChanges.push("");
          } else if (change.type === "function") {
            const func = change.details.currentFunction;
            if (func) {
              downChanges.push(`-- Rollback: Recreate function ${change.table}`);
              downChanges.push(this.generateFunctionDefinition(func));
              downChanges.push("");
            }
          } else if (change.type === "scope") {
            const scope = change.details.currentScope;
            if (scope) {
              downChanges.push(`-- Rollback: Recreate scope ${change.table}`);
              downChanges.push(this.generateScopeDefinition(scope));
              downChanges.push("");
            }
          } else if (change.type === "analyzer") {
            const analyzer = change.details.currentAnalyzer;
            if (analyzer) {
              downChanges.push(`-- Rollback: Recreate analyzer ${change.table}`);
              downChanges.push(this.generateAnalyzerDefinition(analyzer));
              downChanges.push("");
            }
          }
          break;

        case "modify":
          // Rollback modifications - restore original state
          if (change.type === "table" || change.type === "relation") {
            const currentTable = change.details.currentTable || change.details.currentRelation;

            // Check if currentTable exists before proceeding
            if (!currentTable) {
              debugLog(
                `Warning: Cannot generate rollback for ${change.table} - original table/relation state not found`,
              );
              break;
            }

            downChanges.push(
              `-- Rollback: Restore ${change.type} ${change.table} to original state`,
            );

            // Rollback field changes
            for (const changeLine of change.details.fieldChanges) {
              if (changeLine.includes("DEFINE FIELD OVERWRITE")) {
                // Extract field name and restore original definition
                // Updated regex to support field names with dots (e.g., "emails.address")
                const fieldMatch = changeLine.match(/DEFINE FIELD OVERWRITE ([^\s]+) ON TABLE/);
                if (fieldMatch) {
                  const fieldName = fieldMatch[1];
                  const originalField = currentTable.fields?.find(
                    (f: Record<string, unknown>) => f.name === fieldName,
                  );
                  if (originalField) {
                    downChanges.push(`-- Restore field ${fieldName} to original state`);
                    downChanges.push(this.generateFieldDefinition(change.table, originalField));
                  }
                }
              } else if (changeLine.includes("DEFINE FIELD")) {
                // New field added - remove it
                // Updated regex to support field names with dots (e.g., "emails.address")
                const fieldMatch = changeLine.match(/DEFINE FIELD ([^\s]+) ON TABLE/);
                if (fieldMatch) {
                  const fieldName = fieldMatch[1];
                  downChanges.push(`-- Remove field ${fieldName}`);
                  downChanges.push(`REMOVE FIELD ${fieldName} ON TABLE ${change.table};`);
                }
              } else if (changeLine.includes("REMOVE FIELD")) {
                // Field removed - restore it
                // Updated regex to support field names with dots (e.g., "emails.address")
                const fieldMatch = changeLine.match(/REMOVE FIELD ([^\s]+) ON TABLE/);
                if (fieldMatch) {
                  const fieldName = fieldMatch[1];
                  const originalField = currentTable.fields?.find(
                    (f: Record<string, unknown>) => f.name === fieldName,
                  );
                  if (originalField) {
                    downChanges.push(`-- Restore removed field ${fieldName}`);
                    downChanges.push(this.generateFieldDefinition(change.table, originalField));
                  }
                }
              }
            }

            // Rollback index changes
            for (const changeLine of change.details.indexChanges) {
              if (changeLine.includes("DEFINE INDEX")) {
                // New index added - remove it
                const indexMatch = changeLine.match(/DEFINE INDEX (\w+) ON TABLE/);
                if (indexMatch) {
                  const indexName = indexMatch[1];
                  downChanges.push(`-- Remove index ${indexName}`);
                  downChanges.push(`REMOVE INDEX ${indexName} ON TABLE ${change.table};`);
                }
              } else if (changeLine.includes("REMOVE INDEX")) {
                // Index removed - restore it
                const indexMatch = changeLine.match(/REMOVE INDEX (\w+) ON TABLE/);
                if (indexMatch) {
                  const indexName = indexMatch[1];
                  const originalIndex = currentTable.indexes?.find(
                    (i: Record<string, unknown>) => i.name === indexName,
                  );
                  if (originalIndex) {
                    downChanges.push(`-- Restore removed index ${indexName}`);
                    downChanges.push(this.generateIndexDefinition(change.table, originalIndex));
                  }
                }
              }
            }

            // Rollback event changes
            for (const changeLine of change.details.eventChanges) {
              if (changeLine.includes("DEFINE EVENT")) {
                // New event added - remove it
                const eventMatch = changeLine.match(/DEFINE EVENT (\w+) ON TABLE/);
                if (eventMatch) {
                  const eventName = eventMatch[1];
                  downChanges.push(`-- Remove event ${eventName}`);
                  downChanges.push(`REMOVE EVENT ${eventName} ON TABLE ${change.table};`);
                }
              } else if (changeLine.includes("REMOVE EVENT")) {
                // Event removed - restore it
                const eventMatch = changeLine.match(/REMOVE EVENT (\w+) ON TABLE/);
                if (eventMatch) {
                  const eventName = eventMatch[1];
                  const originalEvent = currentTable.events?.find(
                    (e: Record<string, unknown>) => e.name === eventName,
                  );
                  if (originalEvent) {
                    downChanges.push(`-- Restore removed event ${eventName}`);
                    downChanges.push(this.generateEventDefinition(change.table, originalEvent));
                  }
                }
              }
            }
            downChanges.push("");
          } else if (change.type === "function") {
            // Rollback function modification - restore original function
            const currentFunction = change.details.currentFunction;
            if (currentFunction) {
              downChanges.push(`-- Rollback: Restore function ${change.table} to original state`);
              downChanges.push(this.generateFunctionDefinition(currentFunction));
              downChanges.push("");
            }
          } else if (change.type === "scope") {
            // Rollback scope modification - restore original scope
            const currentScope = change.details.currentScope;
            if (currentScope) {
              downChanges.push(`-- Rollback: Restore scope ${change.table} to original state`);
              downChanges.push(this.generateScopeDefinition(currentScope));
              downChanges.push("");
            }
          } else if (change.type === "analyzer") {
            // Rollback analyzer modification - restore original analyzer
            const currentAnalyzer = change.details.currentAnalyzer;
            if (currentAnalyzer) {
              downChanges.push(`-- Rollback: Restore analyzer ${change.table} to original state`);
              downChanges.push(this.generateAnalyzerDefinition(currentAnalyzer));
              downChanges.push("");
            }
          }
          break;

        case "recreate":
          // Rollback recreation - restore the original relation
          if (change.type === "relation") {
            const oldRelation = change.details.oldRelation;
            downChanges.push(`-- Rollback: Restore original ${change.type} ${change.table}`);
            downChanges.push(`REMOVE TABLE ${change.table};`);
            const schemaMode = oldRelation.schemafull === false ? "SCHEMALESS" : "SCHEMAFULL";
            downChanges.push(`DEFINE TABLE ${change.table} ${schemaMode};`);

            // Restore original fields
            for (const field of oldRelation.fields) {
              downChanges.push(this.generateFieldDefinition(change.table, field));
            }

            // Restore original indexes
            for (const index of oldRelation.indexes) {
              downChanges.push(this.generateIndexDefinition(change.table, index));
            }

            // Restore original events
            for (const event of oldRelation.events) {
              downChanges.push(this.generateEventDefinition(change.table, event));
            }
            downChanges.push("");
          }
          break;
      }
    }

    return {
      up: upChanges.join("\n").trim(),
      down: downChanges.join("\n").trim(),
    };
  }

  /**
   * Retrieves all applied migrations from the database, sorted by application time.
   *
   * This method queries the _migrations table and returns a complete list of all
   * migrations that have been applied, ordered from oldest to newest.
   *
   * @returns Array of migration objects sorted by appliedAt timestamp (ascending)
   */
  private async getAppliedMigrations(): Promise<Migration[]> {
    debugLog("Querying _migrations table using SDK...");
    const migrationsResult = await this.client.select("_migrations");
    debugLog("Raw migration query result:", migrationsResult);

    // Type assertion for database results
    const migrations = migrationsResult as Record<string, unknown>[];

    if (!migrations || migrations.length === 0) {
      debugLog("No migrations found");
      return [];
    }

    debugLog(
      "Found migrations:",
      migrations.map((m: Record<string, unknown>) => ({
        id: m.id,
        appliedAt: m.appliedAt,
        message: m.message,
      })),
    );

    // Map database fields to Migration type
    const processedMigrations = migrations
      .map((m: Record<string, unknown>) => ({
        id: String(m.id), // Ensure ID is always a string
        appliedAt: new Date(m.appliedAt as string | number | Date),
        up: m.up as string,
        down: m.down as string,
        message: (m.message as string) || undefined,
        checksum: m.checksum as string,
        downChecksum: m.downChecksum as string,
      }))
      .sort((a: Migration, b: Migration) => a.appliedAt.getTime() - b.appliedAt.getTime()); // Sort by appliedAt ASC

    debugLog(
      `Found ${processedMigrations.length} migrations:`,
      processedMigrations.map((m: Migration) => ({
        id: m.id,
        appliedAt: m.appliedAt,
        message: m.message,
      })),
    );
    return processedMigrations;
  }

  /**
   * Records a completed migration in the _migrations table.
   *
   * This method creates a permanent record of the migration with all its metadata,
   * including the SQL content and checksums for integrity verification. The record
   * ID is auto-generated by SurrealDB.
   *
   * @param migration - The migration object to record
   * @returns The SurrealDB-generated record ID
   */
  private async recordMigration(migration: Migration): Promise<string> {
    debugLog(`Recording migration with message: ${migration.message || "No message"}`);

    const migrationData = {
      appliedAt: new Date(),
      up: migration.up,
      down: migration.down,
      message: migration.message || undefined, // undefined -> NONE in SurrealDB
      checksum: migration.checksum,
      downChecksum: migration.downChecksum,
    };

    const resultRaw = await this.client.create("_migrations", migrationData);

    // Type assertion for database results
    const result = resultRaw as Record<string, unknown> | Record<string, unknown>[];

    // Return the generated record ID for tracking
    const recordId = (Array.isArray(result) ? result[0]?.id : result?.id) as string;
    debugLog(`Migration recorded with ID: ${recordId}`);
    return recordId;
  }

  /**
   * Retrieves and parses the current database schema using SurrealDB's INFO commands.
   *
   * This method queries the database's information schema to build a complete representation
   * of all tables, fields, indexes, and events. It automatically distinguishes between
   * regular tables and relation tables, organizing them appropriately in the returned schema.
   *
   * The _migrations table is automatically excluded from the schema representation.
   *
   * @returns A complete SurrealDBSchema object representing the current database state
   */
  private async getCurrentDatabaseSchema(): Promise<SurrealDBSchema> {
    debugLog("Using SurrealDB native schema queries...");

    // Use SurrealDB's INFO command to get database information
    debugLog("Getting database info...");
    const infoQuery = "INFO FOR DB;";
    const infoResultRaw = await this.client.executeQuery(infoQuery);
    debugLog("Database info result:", infoResultRaw);

    // Type assertion for database query results
    const infoResult = infoResultRaw as Record<string, unknown>[];

    // Extract table names from the database info
    const tableNames: string[] = [];
    if (infoResult && infoResult.length > 0 && infoResult[0].tables) {
      tableNames.push(...Object.keys(infoResult[0].tables as Record<string, unknown>));
    }

    debugLog("Found tables in database:", tableNames);

    const virtualizedTables = [];
    const virtualizedRelations = [];

    for (const tableName of tableNames) {
      // Skip the migrations table
      if (tableName === "_migrations") {
        debugLog("Skipping _migrations table");
        continue;
      }

      try {
        debugLog(`Getting info for table: ${tableName}`);
        const infoQuery = `INFO FOR TABLE ${tableName};`;
        const infoResultRaw = await this.client.executeQuery(infoQuery);
        debugLog(`Info result for ${tableName}:`, infoResultRaw);

        // Type assertion for database query results
        const infoResult = infoResultRaw as unknown[];

        if (infoResult && infoResult.length > 0) {
          // Parse the INFO result to extract schema information
          const tableInfo = this.parseInfoResult(tableName, infoResult[0]);

          // Debug: Show parsed fields for this table
          debugLog(`Parsed fields for table ${tableName}:`, tableInfo.fields);
          debugLog(`Parsed indexes for table ${tableName}:`, tableInfo.indexes);
          debugLog(`Parsed events for table ${tableName}:`, tableInfo.events);

          // Determine if this is a relation table based on schema analysis
          const isRelation = this.isRelationTable(tableName, tableInfo);
          debugLog(`Table ${tableName} is relation: ${isRelation}`);

          if (isRelation) {
            // Extract from/to from the in/out field types
            const relationInfo = this.extractRelationInfo(tableInfo);
            const virtualizedRelation = {
              ...tableInfo,
              from: relationInfo.from,
              to: relationInfo.to,
            };
            virtualizedRelations.push(virtualizedRelation);
          } else {
            virtualizedTables.push(tableInfo);
          }
        }
      } catch (error) {
        debugLog(`Could not get info for table ${tableName}:`, error);
      }
    }

    debugLog(
      "Virtualized tables:",
      virtualizedTables.map((t) => (t as Record<string, unknown>).name),
    );
    debugLog(
      "Virtualized relations:",
      virtualizedRelations.map((r) => (r as Record<string, unknown>).name),
    );

    // Parse functions from database info
    const virtualizedFunctions = [];
    if (infoResult && infoResult.length > 0 && infoResult[0].functions) {
      const functionsObj = infoResult[0].functions as Record<string, unknown>;
      for (const [funcName, funcDef] of Object.entries(functionsObj)) {
        try {
          const parsedFunction = this.parseFunctionDefinition(funcName, funcDef as string);
          virtualizedFunctions.push(parsedFunction);
          debugLog(`Parsed function ${funcName}:`, parsedFunction);
        } catch (error) {
          debugLog(`Could not parse function ${funcName}:`, error);
        }
      }
    }

    // Parse scopes from database info
    // Note: In SurrealDB 2.3+, scopes are stored as 'accesses' (DEFINE ACCESS syntax)
    // but we maintain 'scope' terminology in our API for conceptual clarity
    const virtualizedScopes = [];
    if (infoResult && infoResult.length > 0) {
      const scopesObj = (infoResult[0]?.scopes || infoResult[0]?.accesses) as
        | Record<string, unknown>
        | undefined;
      if (scopesObj) {
        for (const [scopeName, scopeDef] of Object.entries(scopesObj)) {
          try {
            const parsedScope = this.parseScopeDefinition(scopeName, scopeDef as string);
            virtualizedScopes.push(parsedScope);
            debugLog(`Parsed scope ${scopeName}:`, parsedScope);
          } catch (error) {
            debugLog(`Could not parse scope ${scopeName}:`, error);
          }
        }
      }
    }

    // Parse analyzers from database info
    const virtualizedAnalyzers = [];
    if (infoResult && infoResult.length > 0 && infoResult[0].analyzers) {
      const analyzersObj = infoResult[0].analyzers as Record<string, unknown>;
      for (const [analyzerName, analyzerDef] of Object.entries(analyzersObj)) {
        try {
          const parsedAnalyzer = this.parseAnalyzerDefinition(analyzerName, analyzerDef as string);
          virtualizedAnalyzers.push(parsedAnalyzer);
          debugLog(`Parsed analyzer ${analyzerName}:`, parsedAnalyzer);
        } catch (error) {
          debugLog(`Could not parse analyzer ${analyzerName}:`, error);
        }
      }
    }

    debugLog(`Parsed ${virtualizedFunctions.length} functions`);
    debugLog(`Parsed ${virtualizedScopes.length} scopes`);
    debugLog(`Parsed ${virtualizedAnalyzers.length} analyzers`);

    return {
      tables: virtualizedTables,
      relations: virtualizedRelations,
      functions: virtualizedFunctions,
      scopes: virtualizedScopes,
      analyzers: virtualizedAnalyzers,
      comments: [],
    } as unknown as SurrealDBSchema;
  }

  /**
   * Parses the result of a SurrealDB INFO FOR TABLE command into a structured format.
   *
   * This method extracts all schema information from the raw INFO result, including:
   * - Field definitions with types, modifiers, and constraints
   * - Index definitions with columns and uniqueness settings
   * - Event definitions with triggers and actions
   *
   * @param tableName - The name of the table being parsed
   * @param infoResult - The raw result object from INFO FOR TABLE command
   * @returns Structured table schema object ready for comparison
   */
  private parseInfoResult(tableName: string, infoResultRaw: unknown): Record<string, unknown> {
    // Type assertion for database introspection results
    const infoResult = infoResultRaw as Record<string, unknown>;
    // Parse the INFO FOR TABLE result to extract schema information
    debugLog(`Parsing info result for ${tableName}:`, infoResult);

    const fields = [];
    const indexes = [];
    const events = [];

    // Parse fields from the info result
    if (infoResult.fields) {
      for (const [fieldName, fieldDef] of Object.entries(
        infoResult.fields as Record<string, unknown>,
      )) {
        // Skip array wildcard fields (e.g., followers[*]) - these are auto-generated by SurrealDB
        if (fieldName.includes("[*]")) {
          continue;
        }

        // Include all fields, including 'in' and 'out' fields for relation tables
        // These are important for schema comparison

        const parsedField = {
          name: fieldName,
          type: this.extractFieldType(fieldDef as string),
          optional: this.isFieldOptional(fieldDef as string),
          readonly: this.isFieldReadonly(fieldDef as string),
          flexible: this.isFieldFlexible(fieldDef as string),
          ifNotExists: this.hasIfNotExists(fieldDef as string),
          overwrite: this.hasOverwrite(fieldDef as string),
          default: this.extractFieldDefault(fieldDef as string),
          value: this.extractFieldValue(fieldDef as string),
          assert: this.extractFieldAssert(fieldDef as string),
          permissions: this.extractFieldPermissions(fieldDef as string),
          comment: this.extractFieldComment(fieldDef as string),
        };

        debugLog(`Parsed field ${fieldName} in table ${tableName}:`, {
          name: parsedField.name,
          type: parsedField.type,
          optional: parsedField.optional,
          readonly: parsedField.readonly,
          flexible: parsedField.flexible,
          ifNotExists: parsedField.ifNotExists,
          overwrite: parsedField.overwrite,
          default: parsedField.default,
          value: parsedField.value,
          assert: parsedField.assert,
          permissions: parsedField.permissions,
          comment: parsedField.comment,
        });

        fields.push(parsedField);
      }
    }

    // Parse indexes from the info result
    if (infoResult.indexes) {
      for (const [indexName, indexDef] of Object.entries(
        infoResult.indexes as Record<string, unknown>,
      )) {
        indexes.push({
          name: indexName,
          columns: this.extractIndexColumns(indexDef as string),
          unique: this.isIndexUnique(indexDef as string),
        });
      }
    }

    // Parse events from the info result
    if (infoResult.events) {
      for (const [eventName, eventDef] of Object.entries(
        infoResult.events as Record<string, unknown>,
      )) {
        events.push({
          name: eventName,
          when: this.extractEventWhen(eventDef as string),
          thenStatement: this.extractEventThen(eventDef as string),
        });
      }
    }

    return {
      name: tableName,
      schemafull: true,
      comments: [],
      fields,
      indexes,
      events,
    };
  }

  /**
   * Regular expression patterns for parsing SurrealDB field definitions.
   *
   * These patterns are designed to extract field properties from the INFO FOR TABLE
   * results, which return field definitions in SurrealQL syntax. The patterns use
   * lookahead to match properties without consuming the following keywords.
   *
   * Each pattern is carefully crafted to:
   * - Match the property value (in capture group 1)
   * - Stop at the next keyword or end of string
   * - Handle optional spacing and multiple property combinations
   */
  private static readonly FIELD_PATTERNS = {
    // Field modifiers
    ifNotExists: /IF\s+NOT\s+EXISTS/,
    overwrite: /OVERWRITE/,
    flexible: /FLEX(?:IBLE)?/,
    readonly: /READONLY/,
    optional: /OPTIONAL/,

    // Field properties
    type: /TYPE\s+([^;]+?)(?:\s+(?:READONLY|VALUE|ASSERT|DEFAULT|PERMISSIONS|COMMENT|FLEX(?:IBLE)?|$))/,
    value: /VALUE\s+([^;]+?)(?:\s+(?:ASSERT|DEFAULT|PERMISSIONS|COMMENT|FLEX(?:IBLE)?|$))/,
    assert: /ASSERT\s+([^;]+?)(?:\s+(?:DEFAULT|PERMISSIONS|COMMENT|FLEX(?:IBLE)?|$))/,
    default: /DEFAULT\s+([^;]+?)(?:\s+(?:ASSERT|PERMISSIONS|COMMENT|FLEX(?:IBLE)?|$))/,
    permissions: /PERMISSIONS\s+([^;]+?)(?:\s+COMMENT|$)/,
    comment: /COMMENT\s+([^;]+?)(?:\s+FLEX(?:IBLE)?|$)/,
  } as const;

  private extractFieldType(fieldDef: string): string {
    const typeMatch = fieldDef.match(MigrationManager.FIELD_PATTERNS.type);
    return typeMatch ? typeMatch[1].trim() : "string";
  }

  private isFieldOptional(fieldDef: string): boolean {
    return MigrationManager.FIELD_PATTERNS.optional.test(fieldDef);
  }

  private isFieldReadonly(fieldDef: string): boolean {
    return MigrationManager.FIELD_PATTERNS.readonly.test(fieldDef);
  }

  private isFieldFlexible(fieldDef: string): boolean {
    return MigrationManager.FIELD_PATTERNS.flexible.test(fieldDef);
  }

  private hasIfNotExists(fieldDef: string): boolean {
    return MigrationManager.FIELD_PATTERNS.ifNotExists.test(fieldDef);
  }

  private hasOverwrite(fieldDef: string): boolean {
    return MigrationManager.FIELD_PATTERNS.overwrite.test(fieldDef);
  }

  private extractFieldDefault(fieldDef: string): string | null {
    const defaultMatch = fieldDef.match(MigrationManager.FIELD_PATTERNS.default);
    return defaultMatch ? defaultMatch[1].trim() : null;
  }

  private extractFieldValue(fieldDef: string): string | null {
    // Check if there's a VALUE clause
    const valueIndex = fieldDef.indexOf("VALUE ");
    if (valueIndex === -1) return null;

    // Start after "VALUE "
    const start = valueIndex + 6;
    let value = "";
    let braceDepth = 0;
    let inFuture = false;

    // Scan through the string character by character
    for (let i = start; i < fieldDef.length; i++) {
      const char = fieldDef[i];

      // Check if we're starting a <future> block
      if (!inFuture && fieldDef.substring(i, i + 8) === "<future>") {
        inFuture = true;
      }

      // Track brace depth
      if (char === "{") {
        braceDepth++;
      } else if (char === "}") {
        braceDepth--;
        // If we close all braces in a future block, we're done with the value
        if (inFuture && braceDepth === 0) {
          value += char;
          break;
        }
      }

      // If not in a future block and we hit a keyword, stop
      if (braceDepth === 0 && !inFuture) {
        const remaining = fieldDef.substring(i);
        if (/^\s+(ASSERT|DEFAULT|PERMISSIONS|COMMENT|FLEX(?:IBLE)?)\s/.test(remaining)) {
          break;
        }
      }

      value += char;
    }

    return value.trim() || null;
  }

  private extractFieldAssert(fieldDef: string): string | null {
    const assertMatch = fieldDef.match(MigrationManager.FIELD_PATTERNS.assert);
    return assertMatch ? assertMatch[1].trim() : null;
  }

  private extractFieldPermissions(fieldDef: string): string | null {
    const permissionsMatch = fieldDef.match(MigrationManager.FIELD_PATTERNS.permissions);
    return permissionsMatch ? permissionsMatch[1].trim() : null;
  }

  private extractFieldComment(fieldDef: string): string | null {
    const commentMatch = fieldDef.match(MigrationManager.FIELD_PATTERNS.comment);
    return commentMatch ? commentMatch[1].trim() : null;
  }

  private extractIndexColumns(indexDef: string): string[] {
    // SurrealDB uses FIELDS instead of COLUMNS in index definitions
    // Match FIELDS followed by column names, stopping before UNIQUE or other keywords
    const fieldsMatch = indexDef.match(/FIELDS\s+([^;]+?)(?:\s+(?:UNIQUE|$))/);
    if (!fieldsMatch) {
      // Fallback: try to match everything after FIELDS until semicolon
      const fallbackMatch = indexDef.match(/FIELDS\s+([^;]+)/);
      if (!fallbackMatch) {
        return [];
      }
      // Remove UNIQUE and other keywords that might be at the end
      const columnsStr = fallbackMatch[1].replace(/\s+UNIQUE\s*$/, "").trim();
      return columnsStr
        .split(",")
        .map((col) => col.trim())
        .filter((col) => col.length > 0);
    }
    return fieldsMatch[1]
      .split(",")
      .map((col) => col.trim())
      .filter((col) => col.length > 0);
  }

  private isIndexUnique(indexDef: string): boolean {
    return indexDef.includes("UNIQUE");
  }

  private extractEventWhen(eventDef: string): string {
    const whenMatch = eventDef.match(/WHEN\s+([^;]+)/);
    return whenMatch ? whenMatch[1].trim() : "";
  }

  private extractEventThen(eventDef: string): string {
    const thenMatch = eventDef.match(/THEN\s+([^;]+)/);
    return thenMatch ? thenMatch[1].trim() : "";
  }

  /**
   * Parses a function definition from INFO FOR DB result.
   *
   * Extracts function parameters, return type, and body from the definition string.
   *
   * @param funcName - The name of the function
   * @param funcDef - The function definition string from INFO FOR DB
   * @returns Parsed function object
   */
  private parseFunctionDefinition(funcName: string, funcDef: string): Record<string, unknown> {
    debugLog(`Parsing function definition for ${funcName}:`, funcDef);

    // Extract the full function name from the definition (e.g., fn::days_since)
    const nameMatch = funcDef.match(/FUNCTION\s+(fn::\w+)/);
    const fullName = nameMatch ? nameMatch[1] : `fn::${funcName}`;

    // Parse parameters from function signature
    // Format: FUNCTION fn::name($param1: type1, $param2: type2) -> returnType { body }
    const parameters: Array<{ name: string; type: string }> = [];
    const paramMatch = funcDef.match(/\((.*?)\)/);
    if (paramMatch?.[1].trim()) {
      const paramStr = paramMatch[1];
      const paramParts = paramStr.split(",");
      for (const part of paramParts) {
        const trimmed = part.trim();
        if (trimmed) {
          // Format: $name: type
          const colonIndex = trimmed.indexOf(":");
          if (colonIndex > 0) {
            const paramName = trimmed.substring(0, colonIndex).trim().replace("$", "");
            const paramType = trimmed.substring(colonIndex + 1).trim();
            parameters.push({ name: paramName, type: paramType });
          }
        }
      }
    }

    // Parse return type
    let returnType: string | null = null;
    const returnMatch = funcDef.match(/\)\s*->\s*([^\s{]+)/);
    if (returnMatch) {
      returnType = returnMatch[1].trim();
    }

    // Parse body - everything between { and }
    let body = "";
    const bodyMatch = funcDef.match(/\{(.*)\}/s);
    if (bodyMatch) {
      body = bodyMatch[1].trim();
    }

    return {
      name: fullName,
      parameters,
      returnType,
      body,
      comments: [],
    };
  }

  /**
   * Parses a scope definition from INFO FOR DB result.
   *
   * Note: In SurrealDB 2.3+, scopes are returned as DEFINE ACCESS statements.
   * Extracts session duration, SIGNUP query, and SIGNIN query from the definition string.
   *
   * @param scopeName - The name of the scope
   * @param scopeDef - The scope definition string from INFO FOR DB (DEFINE ACCESS format)
   * @returns Parsed scope object
   */
  private parseScopeDefinition(scopeName: string, scopeDef: string): Record<string, unknown> {
    debugLog(`Parsing scope definition for ${scopeName}:`, scopeDef);

    // Parse session duration - look for "FOR SESSION" (may be after "DURATION FOR TOKEN")
    let session: string | null = null;
    const sessionMatch = scopeDef.match(/FOR\s+SESSION\s+(\w+)/);
    if (sessionMatch) {
      session = sessionMatch[1];
    }

    // Parse SIGNUP query - everything between SIGNUP ( and ) before SIGNIN
    let signup: string | null = null;
    const signupMatch = scopeDef.match(/SIGNUP\s+\((.*?)\)\s*SIGNIN/s);
    if (signupMatch) {
      signup = signupMatch[1].trim();
    }

    // Parse SIGNIN query - everything between SIGNIN ( and ) before WITH JWT
    let signin: string | null = null;
    const signinMatch = scopeDef.match(/SIGNIN\s+\((.*?)\)\s*(?:WITH\s+JWT|DURATION|$)/s);
    if (signinMatch) {
      signin = signinMatch[1].trim();
    }

    return {
      name: scopeName,
      session,
      signup,
      signin,
      comments: [],
    };
  }

  /**
   * Parses an analyzer definition from INFO FOR DB result.
   *
   * Extracts tokenizers and filters from the definition string.
   *
   * @param analyzerName - The name of the analyzer
   * @param analyzerDef - The analyzer definition string from INFO FOR DB
   * @returns Parsed analyzer object
   */
  private parseAnalyzerDefinition(
    analyzerName: string,
    analyzerDef: string,
  ): Record<string, unknown> {
    debugLog(`Parsing analyzer definition for ${analyzerName}:`, analyzerDef);

    // Parse tokenizers
    const tokenizers: string[] = [];
    const tokenizerMatch = analyzerDef.match(/TOKENIZERS\s+([^F]+?)(?:\s+FILTERS|$)/);
    if (tokenizerMatch) {
      const tokenizerStr = tokenizerMatch[1].trim();
      tokenizers.push(...tokenizerStr.split(",").map((t) => t.trim()));
    }

    // Parse filters
    const filters: string[] = [];
    const filterMatch = analyzerDef.match(/FILTERS\s+(.+?)$/);
    if (filterMatch) {
      const filterStr = filterMatch[1].trim();
      filters.push(...filterStr.split(",").map((f) => f.trim()));
    }

    return {
      name: analyzerName,
      tokenizers,
      filters,
      comments: [],
    };
  }

  /**
   * Compares two functions to detect modifications.
   *
   * @param currentFunc - The current function in the database
   * @param newFunc - The new function from the schema
   * @returns True if the function has been modified
   */
  private isFunctionModified(currentFunc: SurrealFunction, newFunc: SurrealFunction): boolean {
    // Compare parameters
    if (JSON.stringify(currentFunc.parameters) !== JSON.stringify(newFunc.parameters)) {
      return true;
    }

    // Compare return type
    if (currentFunc.returnType !== newFunc.returnType) {
      return true;
    }

    // Compare body (normalize whitespace for comparison)
    const normalizeBody = (body: string) => body?.replace(/\s+/g, " ").trim() || "";
    if (normalizeBody(currentFunc.body) !== normalizeBody(newFunc.body)) {
      return true;
    }

    return false;
  }

  /**
   * Compares two scopes to detect modifications.
   *
   * @param currentScope - The current scope in the database
   * @param newScope - The new scope from the schema
   * @returns True if the scope has been modified
   */
  private isScopeModified(currentScope: SurrealScope, newScope: SurrealScope): boolean {
    // Normalize duration to days for comparison (SurrealDB may convert 7d to 1w, etc.)
    const normalizeDuration = (duration: string | null): number | null => {
      if (!duration) return null;
      const match = duration.match(/^(\d+)([smhdwy])$/);
      if (!match) return null;
      const [, value, unit] = match;
      const num = Number.parseInt(value, 10);
      // Convert to days
      switch (unit) {
        case "s":
          return num / 86400; // seconds to days
        case "m":
          return num / 1440; // minutes to days
        case "h":
          return num / 24; // hours to days
        case "d":
          return num; // days
        case "w":
          return num * 7; // weeks to days
        case "y":
          return num * 365; // years to days
        default:
          return null;
      }
    };

    // Compare session duration
    const currentDays = normalizeDuration(currentScope.session);
    const newDays = normalizeDuration(newScope.session);
    if (currentDays !== newDays) {
      return true;
    }

    // Compare SIGNUP query (normalize whitespace for comparison)
    const normalizeQuery = (query: string | null) => query?.replace(/\s+/g, " ").trim() || null;
    if (normalizeQuery(currentScope.signup) !== normalizeQuery(newScope.signup)) {
      return true;
    }

    // Compare SIGNIN query
    if (normalizeQuery(currentScope.signin) !== normalizeQuery(newScope.signin)) {
      return true;
    }

    return false;
  }

  /**
   * Compares two analyzers to detect modifications.
   *
   * @param currentAnalyzer - The current analyzer in the database
   * @param newAnalyzer - The new analyzer from the schema
   * @returns True if the analyzer has been modified
   */
  private isAnalyzerModified(
    currentAnalyzer: SurrealAnalyzer,
    newAnalyzer: SurrealAnalyzer,
  ): boolean {
    // Normalize case for comparison (SurrealDB stores tokenizers/filters in uppercase)
    const normalizeCase = (arr: string[]) => arr.map((s) => s.toUpperCase()).sort();

    // Compare tokenizers
    const sortedCurrentTokenizers = normalizeCase(currentAnalyzer.tokenizers || []);
    const sortedNewTokenizers = normalizeCase(newAnalyzer.tokenizers || []);
    if (JSON.stringify(sortedCurrentTokenizers) !== JSON.stringify(sortedNewTokenizers)) {
      return true;
    }

    // Compare filters
    const sortedCurrentFilters = normalizeCase(currentAnalyzer.filters || []);
    const sortedNewFilters = normalizeCase(newAnalyzer.filters || []);
    if (JSON.stringify(sortedCurrentFilters) !== JSON.stringify(sortedNewFilters)) {
      return true;
    }

    return false;
  }

  /**
   * Determines whether a table is a relation (graph edge) table.
   *
   * This method uses multiple heuristics to identify relation tables:
   * 1. Primary check: Presence of both 'in' and 'out' fields (SurrealDB's standard relation fields)
   * 2. Fallback heuristic: Table name patterns common to relation tables
   *
   * @param tableName - The name of the table to check
   * @param tableInfo - The parsed table information
   * @returns True if the table is identified as a relation table
   */
  private isRelationTable(
    tableName: string,
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic schema introspection requires flexible types
    tableInfo: any,
  ): boolean {
    // First check if the table has the standard relation fields
    const hasInField = tableInfo.fields?.some((f: Record<string, unknown>) => f.name === "in");
    const hasOutField = tableInfo.fields?.some((f: Record<string, unknown>) => f.name === "out");

    // If it has both 'in' and 'out' fields, it's likely a relation
    if (hasInField && hasOutField) {
      debugLog(`Table ${tableName} identified as relation (has 'in' and 'out' fields)`);
      return true;
    }

    // Fallback to heuristic for edge cases
    const heuristicMatch =
      tableName.includes("_") ||
      tableName === "like" ||
      tableName === "follow" ||
      tableName === "bookmark";

    if (heuristicMatch) {
      debugLog(`Table ${tableName} identified as relation (heuristic match)`);
    }

    return heuristicMatch;
  }

  /**
   * Extracts the from/to table names from a relation table's in/out field types.
   *
   * @param tableInfo - The table info object containing field definitions
   * @returns Object with from and to table names
   */
  // biome-ignore lint/suspicious/noExplicitAny: Dynamic schema introspection requires flexible types
  private extractRelationInfo(tableInfo: any): {
    from: string;
    to: string;
  } {
    const inField = tableInfo.fields?.find((f: Record<string, unknown>) => f.name === "in");
    const outField = tableInfo.fields?.find((f: Record<string, unknown>) => f.name === "out");

    // Extract table names from record types (e.g., "record<user>" -> "user")
    const extractTableFromRecordType = (fieldType: string): string | null => {
      const match = fieldType.match(/record<(\w+)>/);
      return match ? match[1] : null;
    };

    const fromTable = inField ? extractTableFromRecordType(inField.type) : null;
    const toTable = outField ? extractTableFromRecordType(outField.type) : null;

    debugLog(`Extracted relation info:`, {
      tableName: tableInfo.name,
      from: fromTable,
      to: toTable,
      inFieldType: inField?.type,
      outFieldType: outField?.type,
    });

    return {
      from: fromTable || "unknown",
      to: toTable || "unknown",
    };
  }

  /**
   * Generates a SurrealQL DEFINE FIELD statement from a field definition.
   *
   * This method constructs the complete field definition including type, value,
   * assertions, and default values in the correct SurrealQL syntax.
   *
   * @param tableName - The name of the table the field belongs to
   * @param field - The field definition object
   * @returns Complete DEFINE FIELD statement
   */
  /**
   * Serializes a default value for use in a DEFINE FIELD statement.
   * Handles arrays, objects, strings, numbers, booleans, and null values.
   */
  private serializeDefaultValue(value: unknown): string {
    if (Array.isArray(value)) {
      return JSON.stringify(value);
    }
    if (typeof value === "object" && value !== null) {
      return JSON.stringify(value);
    }
    if (typeof value === "string") {
      // Check if it's already a SurrealQL expression (contains functions, variables, etc.)
      if (value.includes("(") || value.startsWith("$") || value.includes("::")) {
        return value;
      }
      // Otherwise, it's a literal string that needs quotes
      return `"${value}"`;
    }
    // Numbers, booleans, null
    return String(value);
  }

  private generateFieldDefinition(
    tableName: string,
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic field definitions from schema introspection
    field: any,
  ): string {
    let definition = `DEFINE FIELD ${field.name} ON TABLE ${tableName} TYPE ${field.type}`;

    if (field.value) {
      definition += ` VALUE ${field.value}`;
    }

    if (field.assert) {
      definition += ` ASSERT ${field.assert}`;
    }

    if (field.default !== undefined && field.default !== null) {
      definition += ` DEFAULT ${this.serializeDefaultValue(field.default)}`;
    }

    definition += ";";
    return definition;
  }

  /**
   * Generates a SurrealQL DEFINE INDEX statement from an index definition.
   *
   * This method constructs the complete index definition including column list
   * and uniqueness constraint in the correct SurrealQL syntax.
   *
   * @param tableName - The name of the table the index belongs to
   * @param index - The index definition object
   * @returns Complete DEFINE INDEX statement
   */
  private generateIndexDefinition(
    tableName: string,
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic index definitions from schema introspection
    index: any,
  ): string {
    const indexName = index.name || `${tableName}_${index.columns.join("_")}`;
    let definition = `DEFINE INDEX ${indexName} ON TABLE ${tableName} COLUMNS ${index.columns.join(", ")}`;

    if (index.unique) {
      definition += " UNIQUE";
    }

    definition += ";";
    return definition;
  }

  /**
   * Generates a SurrealQL DEFINE EVENT statement from an event definition.
   *
   * This method constructs the complete event definition including trigger type,
   * condition, and action. It automatically handles single vs. multi-statement
   * actions for proper SurrealQL syntax.
   *
   * @param tableName - The name of the table the event belongs to
   * @param event - The event definition object
   * @returns Complete DEFINE EVENT statement
   */
  private generateEventDefinition(
    tableName: string,
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic event definitions from schema introspection
    event: any,
  ): string {
    // Check if the then action contains multiple statements or control flow (FOR, IF, etc.)
    const hasMultipleStatements = event.thenStatement.includes(";");
    const hasControlFlow = /\b(FOR|IF|LET)\b/.test(event.thenStatement);

    if (hasMultipleStatements || hasControlFlow) {
      // Wrap multiple statements or control flow in a block with braces
      return `DEFINE EVENT ${event.name} ON TABLE ${tableName} WHEN ${event.when} THEN {\n${event.thenStatement}\n};`;
    } else {
      // Single statement, no need for block
      return `DEFINE EVENT ${event.name} ON TABLE ${tableName} WHEN ${event.when} THEN ${event.thenStatement};`;
    }
  }

  /**
   * Generates a SurrealQL DEFINE FUNCTION statement from a function definition.
   *
   * This method constructs the complete function definition including parameters,
   * return type, and body. Parameters are properly formatted with types, and the
   * function body is wrapped in a code block.
   *
   * @param func - The function definition object
   * @returns Complete DEFINE FUNCTION statement
   */
  private generateFunctionDefinition(
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic function definitions from schema
    func: any,
    overwrite = false,
  ): string {
    let definition = `DEFINE FUNCTION ${overwrite ? "OVERWRITE " : ""}${func.name}`;

    // Add parameters
    if (func.parameters && func.parameters.length > 0) {
      const params = func.parameters
        .map((p: { name: string; type: string }) => `$${p.name}: ${p.type}`)
        .join(", ");
      definition += `(${params})`;
    } else {
      definition += "()";
    }

    // Add return type if specified
    if (func.returnType) {
      definition += ` -> ${func.returnType}`;
    }

    // Add body (wrapped in code block)
    definition += ` { ${func.body} }`;

    return `${definition};`;
  }

  /**
   * Generates a SurrealQL DEFINE ACCESS statement from a scope definition.
   *
   * Note: In SurrealDB 2.3+, scopes use DEFINE ACCESS syntax instead of DEFINE SCOPE.
   * This method constructs the complete access definition including session duration,
   * SIGNUP logic, and SIGNIN logic for authentication.
   *
   * @param scope - The scope definition object
   * @param overwrite - Whether to include OVERWRITE keyword for modifications
   * @returns Complete DEFINE ACCESS statement
   */
  private generateScopeDefinition(
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic scope definitions from schema
    scope: any,
    overwrite = false,
  ): string {
    let definition = `DEFINE ACCESS ${overwrite ? "OVERWRITE " : ""}${scope.name} ON DATABASE TYPE RECORD`;

    // Add SIGNUP logic
    if (scope.signup) {
      definition += ` SIGNUP (${scope.signup})`;
    }

    // Add SIGNIN logic
    if (scope.signin) {
      definition += ` SIGNIN (${scope.signin})`;
    }

    // Add session duration
    if (scope.session) {
      definition += ` DURATION FOR SESSION ${scope.session}`;
    }

    return `${definition};`;
  }

  /**
   * Generates a SurrealQL DEFINE ANALYZER statement from an analyzer definition.
   *
   * This method constructs the complete analyzer definition including tokenizers
   * and filters for full-text search.
   *
   * @param analyzer - The analyzer definition object
   * @returns Complete DEFINE ANALYZER statement
   */
  private generateAnalyzerDefinition(
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic analyzer definitions from schema
    analyzer: any,
    overwrite = false,
  ): string {
    let definition = `DEFINE ANALYZER ${overwrite ? "OVERWRITE " : ""}${analyzer.name}`;

    // Add tokenizers
    if (analyzer.tokenizers && analyzer.tokenizers.length > 0) {
      definition += ` TOKENIZERS ${analyzer.tokenizers.join(", ")}`;
    }

    // Add filters
    if (analyzer.filters && analyzer.filters.length > 0) {
      definition += ` FILTERS ${analyzer.filters.join(", ")}`;
    }

    return `${definition};`;
  }

  /**
   * Compares field definitions between a new schema and current database state.
   *
   * This method performs a comprehensive field-by-field comparison, detecting:
   * - New fields that need to be added
   * - Removed fields that need to be deleted
   * - Modified fields that need to be updated (type, constraints, defaults, etc.)
   *
   * For relation tables, the 'in' and 'out' fields are automatically filtered out
   * as they are managed by SurrealDB.
   *
   * @param newTable - The desired table schema from TypeScript definition
   * @param currentTable - The current table schema from the database
   * @returns Array of SurrealQL statements needed to synchronize fields
   */
  private async compareTableFields(
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic table schema comparison requires flexible types
    newTable: { name: string; fields: any[]; [key: string]: any },
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic table schema comparison requires flexible types
    currentTable: { name: string; fields: any[]; [key: string]: any },
  ): Promise<string[]> {
    const changes: string[] = [];

    // Ensure we have valid field arrays
    const newFields = newTable.fields || [];
    const currentFields = currentTable?.fields || [];

    // Filter out auto-generated relation fields for relation tables
    const filteredNewFields = this.isRelationTable(newTable.name, newTable)
      ? newFields.filter(
          (f: Record<string, unknown>) => f?.name && f.name !== "in" && f.name !== "out",
        )
      : newFields;

    const filteredCurrentFields =
      currentTable && this.isRelationTable(currentTable.name, currentTable)
        ? currentFields.filter(
            (f: Record<string, unknown>) => f?.name && f.name !== "in" && f.name !== "out",
          )
        : currentFields;

    // Check for new fields and field modifications
    for (const newField of filteredNewFields) {
      if (!newField || !newField.name) continue;
      const currentField = filteredCurrentFields.find(
        (f: Record<string, unknown>) => f && f.name === newField.name,
      );

      // Debug: Log TypeScript schema field definition
      debugLog(`TypeScript schema field ${newField.name} in table ${newTable.name}:`, {
        name: newField.name,
        type: newField.type,
        optional: newField.optional,
        readonly: newField.readonly,
        flexible: newField.flexible,
        ifNotExists: newField.ifNotExists,
        overwrite: newField.overwrite,
        default: newField.default,
        value: newField.value,
        assert: newField.assert,
        permissions: newField.permissions,
        comment: newField.comment,
      });

      if (!currentField) {
        // New field
        changes.push(`-- New field: ${newField.name} on table ${newTable.name}`);
        changes.push(this.generateFieldDefinition(newTable.name, newField));
      } else {
        // Check for field modifications
        const fieldChanges = this.compareFieldProperties(newTable.name, newField, currentField);
        changes.push(...fieldChanges);
      }
    }

    // Check for removed fields
    for (const currentField of filteredCurrentFields) {
      if (!currentField || !currentField.name) continue;
      const stillExists = filteredNewFields.find(
        (f: Record<string, unknown>) => f && f.name === currentField.name,
      );
      if (!stillExists) {
        changes.push(`-- Removed field: ${currentField.name} from table ${newTable.name}`);
        changes.push(`REMOVE FIELD ${currentField.name} ON TABLE ${newTable.name};`);
      }
    }

    return changes;
  }

  /**
   * Compares individual field properties to detect modifications.
   *
   * This method performs a detailed comparison of all field properties including:
   * - Type (string, int, bool, etc.)
   * - Modifiers (readonly, flexible, optional)
   * - Constraints (assert conditions)
   * - Values and defaults
   * - Permissions
   * - Comments
   *
   * When changes are detected, it generates a DEFINE FIELD OVERWRITE statement
   * with all field properties to ensure complete synchronization.
   *
   * @param tableName - The name of the table the field belongs to
   * @param newField - The desired field definition
   * @param currentField - The current field definition from database
   * @returns Array of SurrealQL statements (empty if no changes, one OVERWRITE statement if changed)
   */
  private compareFieldProperties(
    tableName: string,
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic field comparison requires flexible types
    newField: any,
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic field comparison requires flexible types
    currentField: any,
  ): string[] {
    const changes: string[] = [];

    // Compare field properties to detect actual changes
    // Handle permissions: null/undefined in TypeScript schema means "FULL" (default)
    const newPermissions =
      newField.permissions === null || newField.permissions === undefined
        ? "FULL"
        : newField.permissions;
    const currentPermissions =
      currentField.permissions === null || currentField.permissions === undefined
        ? "FULL"
        : currentField.permissions;

    // Normalize default values for comparison
    // The database returns defaults as strings, but our schema may have arrays, objects, etc.
    const normalizeDefault = (value: unknown): string => {
      if (value === null || value === undefined) return "";
      if (typeof value === "string") return value;
      if (Array.isArray(value)) return JSON.stringify(value);
      if (typeof value === "object") return JSON.stringify(value);
      return String(value);
    };

    const newDefault = normalizeDefault(newField.default);
    const currentDefault = normalizeDefault(currentField.default);

    // Normalize boolean flags (undefined should be treated as false)
    const newReadonly = newField.readonly || false;
    const currentReadonly = currentField.readonly || false;
    const newFlexible = newField.flexible || false;
    const currentFlexible = currentField.flexible || false;
    const newIfNotExists = newField.ifNotExists || false;
    const currentIfNotExists = currentField.ifNotExists || false;
    const newOverwrite = newField.overwrite || false;
    const currentOverwrite = currentField.overwrite || false;

    // Normalize comment (null, undefined, and "null" should all be treated as no comment)
    const normalizeComment = (comment: unknown): string | null => {
      if (
        comment === null ||
        comment === undefined ||
        comment === "null" ||
        comment === "undefined"
      ) {
        return null;
      }
      return String(comment);
    };
    const newComment = normalizeComment(newField.comment);
    const currentComment = normalizeComment(currentField.comment);

    // Normalize value and assert (whitespace differences shouldn't trigger changes)
    const normalizeWhitespace = (value: unknown): string => {
      if (value === null || value === undefined) return "";
      let normalized = String(value).replace(/\s+/g, " ").trim();
      // Remove parentheses around SELECT statements that SurrealDB adds automatically
      // e.g., "RETURN (SELECT ...)" -> "RETURN SELECT ..."
      normalized = normalized.replace(/RETURN\s+\(\s*SELECT\s+/g, "RETURN SELECT ");
      normalized = normalized.replace(/\)\s*;?\s*\}/g, " }");
      // Remove trailing semicolons before closing braces (SurrealDB may omit them)
      normalized = normalized.replace(/;\s*\}/g, " }");
      return normalized.trim();
    };
    const newValue = normalizeWhitespace(newField.value);
    const currentValue = normalizeWhitespace(currentField.value);
    const newAssert = normalizeWhitespace(newField.assert);
    const currentAssert = normalizeWhitespace(currentField.assert);

    const hasChanges =
      newField.type !== currentField.type ||
      newReadonly !== currentReadonly ||
      newFlexible !== currentFlexible ||
      newIfNotExists !== currentIfNotExists ||
      newOverwrite !== currentOverwrite ||
      newAssert !== currentAssert ||
      newValue !== currentValue ||
      newDefault !== currentDefault ||
      newField.optional !== currentField.optional ||
      newPermissions !== currentPermissions ||
      newComment !== currentComment;

    if (hasChanges) {
      // Debug: Show what changed
      debugLog(`Field ${newField.name} in table ${tableName} has changes:`);
      debugLog(`  Comparison details:`);
      debugLog(
        `    type: "${currentField.type}" vs "${newField.type}" = ${newField.type !== currentField.type}`,
      );
      debugLog(
        `    readonly: ${currentReadonly} vs ${newReadonly} = ${newReadonly !== currentReadonly}`,
      );
      debugLog(
        `    flexible: ${currentFlexible} vs ${newFlexible} = ${newFlexible !== currentFlexible}`,
      );
      debugLog(
        `    ifNotExists: ${currentIfNotExists} vs ${newIfNotExists} = ${newIfNotExists !== currentIfNotExists}`,
      );
      debugLog(
        `    overwrite: ${currentOverwrite} vs ${newOverwrite} = ${newOverwrite !== currentOverwrite}`,
      );
      debugLog(
        `    optional: ${currentField.optional} vs ${newField.optional} = ${newField.optional !== currentField.optional}`,
      );
      debugLog(
        `    permissions: "${currentPermissions}" vs "${newPermissions}" = ${newPermissions !== currentPermissions}`,
      );
      debugLog(
        `    default (normalized): "${currentDefault}" vs "${newDefault}" = ${newDefault !== currentDefault}`,
      );
      debugLog(
        `    assert (normalized): "${currentAssert}" vs "${newAssert}" = ${newAssert !== currentAssert}`,
      );
      debugLog(
        `    value (normalized): "${currentValue}" vs "${newValue}" = ${newValue !== currentValue}`,
      );
      debugLog(
        `    comment: "${currentComment}" vs "${newComment}" = ${newComment !== currentComment}`,
      );
      if (newField.type !== currentField.type) {
        debugLog(`  - type: "${currentField.type}" -> "${newField.type}"`);
      }
      if (newField.assert !== currentField.assert) {
        debugLog(`  - assert: "${currentField.assert}" -> "${newField.assert}"`);
      }
      if (newField.value !== currentField.value) {
        debugLog(`  - value: "${currentField.value}" -> "${newField.value}"`);
      }
      if (newDefault !== currentDefault) {
        debugLog(`  - default (raw): "${currentField.default}" -> "${newField.default}"`);
        debugLog(`  - default (normalized): "${currentDefault}" -> "${newDefault}"`);
      }
      if (newField.optional !== currentField.optional) {
        debugLog(`  - optional: ${currentField.optional} -> ${newField.optional}`);
      }
      if (newPermissions !== currentPermissions) {
        debugLog(`  - permissions: "${currentPermissions}" -> "${newPermissions}"`);
      }

      // For field modifications, we need to use OVERWRITE clause
      let fieldDefinition = `DEFINE FIELD OVERWRITE ${newField.name} ON TABLE ${tableName}`;

      // Add type
      if (newField.type) {
        fieldDefinition += ` TYPE ${newField.type}`;
      }

      // Add value
      if (newField.value) {
        fieldDefinition += ` VALUE ${newField.value}`;
      }

      // Add assertion
      if (newField.assert) {
        fieldDefinition += ` ASSERT ${newField.assert}`;
      }

      // Add default
      if (newField.default !== undefined && newField.default !== null) {
        fieldDefinition += ` DEFAULT ${this.serializeDefaultValue(newField.default)}`;
      }

      // Add optional
      if (newField.optional) {
        fieldDefinition += ` OPTIONAL`;
      }

      // Add modifiers
      if (newField.readonly) {
        fieldDefinition += ` READONLY`;
      }
      if (newField.flexible) {
        fieldDefinition += ` FLEXIBLE`;
      }

      // Add permissions (null/undefined means use default "FULL")
      if (newField.permissions !== null && newField.permissions !== undefined) {
        fieldDefinition += ` PERMISSIONS ${newField.permissions}`;
      }

      // Add comment
      if (newField.comment) {
        fieldDefinition += ` COMMENT ${newField.comment}`;
      }

      changes.push(`-- Modify field: ${newField.name} on table ${tableName}`);
      changes.push(`${fieldDefinition};`);
    }

    return changes;
  }

  /**
   * Compares index definitions between a new schema and current database state.
   *
   * This method detects:
   * - New indexes that need to be created
   * - Removed indexes that need to be dropped
   *
   * Note: Index modifications are not detected - an index must be dropped and
   * recreated to change its properties.
   *
   * @param newTable - The desired table schema
   * @param currentTable - The current table schema from database
   * @returns Array of SurrealQL statements for index changes
   */
  private compareTableIndexes(
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic table schema comparison requires flexible types
    newTable: { name: string; indexes: any[]; [key: string]: any },
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic table schema comparison requires flexible types
    currentTable: { indexes: any[]; [key: string]: any },
  ): string[] {
    const changes: string[] = [];

    // Ensure we have valid index arrays
    const newIndexes = newTable.indexes || [];
    const currentIndexes = currentTable.indexes || [];

    // Check for new indexes
    for (const newIndex of newIndexes) {
      if (!newIndex || !newIndex.columns) continue;
      const currentIndex = currentIndexes.find(
        (i: Record<string, unknown>) => i && i.name === newIndex.name,
      );
      if (!currentIndex) {
        changes.push(
          `-- New index: ${newIndex.name || newIndex.columns.join("_")} on table ${newTable.name}`,
        );
        changes.push(this.generateIndexDefinition(newTable.name, newIndex));
      }
    }

    // Check for removed indexes
    for (const currentIndex of currentIndexes) {
      if (!currentIndex || !currentIndex.name) continue;
      const stillExists = newIndexes.find(
        (i: Record<string, unknown>) => i && i.name === currentIndex.name,
      );
      if (!stillExists) {
        changes.push(`-- Removed index: ${currentIndex.name} from table ${newTable.name}`);
        changes.push(`REMOVE INDEX ${currentIndex.name} ON TABLE ${newTable.name};`);
      }
    }

    return changes;
  }

  /**
   * Compares event definitions between a new schema and current database state.
   *
   * This method detects:
   * - New events that need to be created
   * - Removed events that need to be dropped
   *
   * Note: Event modifications are not detected - an event must be dropped and
   * recreated to change its trigger conditions or actions.
   *
   * @param newTable - The desired table schema
   * @param currentTable - The current table schema from database
   * @returns Array of SurrealQL statements for event changes
   */
  private compareTableEvents(
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic table schema comparison requires flexible types
    newTable: { name: string; events: any[]; [key: string]: any },
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic table schema comparison requires flexible types
    currentTable: { events: any[]; [key: string]: any },
  ): string[] {
    const changes: string[] = [];

    // Ensure we have valid event arrays
    const newEvents = newTable.events || [];
    const currentEvents = currentTable.events || [];

    // Check for new events
    for (const newEvent of newEvents) {
      if (!newEvent || !newEvent.name) continue;
      const currentEvent = currentEvents.find(
        (e: Record<string, unknown>) => e && e.name === newEvent.name,
      );
      if (!currentEvent) {
        changes.push(`-- New event: ${newEvent.name} on table ${newTable.name}`);
        changes.push(this.generateEventDefinition(newTable.name, newEvent));
      }
    }

    // Check for removed events
    for (const currentEvent of currentEvents) {
      if (!currentEvent || !currentEvent.name) continue;
      const stillExists = newEvents.find(
        (e: Record<string, unknown>) => e && e.name === currentEvent.name,
      );
      if (!stillExists) {
        changes.push(`-- Removed event: ${currentEvent.name} from table ${newTable.name}`);
        changes.push(`REMOVE EVENT ${currentEvent.name} ON TABLE ${newTable.name};`);
      }
    }

    return changes;
  }

  /**
   * Compares relation-specific properties (from/to) to detect fundamental relation changes.
   *
   * @param newRelation - The new relation definition
   * @param currentRelation - The current relation definition from the database
   * @returns True if the relation properties have changed, false otherwise
   */
  private hasRelationPropertiesChanged(
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic relation comparison requires flexible types
    newRelation: { from: string; to: string; [key: string]: any },
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic relation comparison requires flexible types
    currentRelation: { from: string; to: string; [key: string]: any },
  ): boolean {
    // Check if from or to properties have changed
    return newRelation.from !== currentRelation.from || newRelation.to !== currentRelation.to;
  }

  /**
   * Removes a migration record from the database.
   *
   * @param id - The migration record ID to delete
   */
  private async removeMigration(id: string): Promise<void> {
    debugLog(`Removing migration with ID: ${id}`);
    await this.client.delete(id);
  }

  /**
   * Calculates a cryptographic checksum for migration content.
   *
   * Checksums are used to verify migration integrity and detect tampering.
   * The checksum includes the algorithm name as a prefix (e.g., "sha256.abc123...")
   * to support future algorithm changes.
   *
   * @param content - The migration SQL content to hash
   * @param algorithm - The hash algorithm to use (default: "sha256")
   * @returns Checksum string in format "algorithm.hash"
   */
  private calculateChecksum(content: string, algorithm: string = "sha256"): string {
    const hash = createHash(algorithm).update(content).digest("hex");
    return `${algorithm}.${hash}`;
  }

  /**
   * Parses a checksum string into its algorithm and hash components.
   *
   * Checksums are stored in the format "algorithm.hash" (e.g., "sha256.abc123...").
   * This format allows for future support of different hash algorithms without
   * breaking existing migrations.
   *
   * @param checksum - The checksum string to parse
   * @returns Object containing the algorithm name and hash value
   * @throws {Error} If the checksum format is invalid
   */
  private parseChecksum(checksum: string): { algorithm: string; hash: string } {
    const parts = checksum.split(".");
    if (parts.length !== 2) {
      throw new Error(`Invalid checksum format: ${checksum}. Expected format: algorithm.hash`);
    }
    return { algorithm: parts[0], hash: parts[1] };
  }

  /**
   * Verifies that content matches an expected checksum.
   *
   * This method recalculates the checksum of the provided content using the same
   * algorithm as the expected checksum, then compares the results. This ensures
   * that migration content hasn't been modified or corrupted.
   *
   * @param content - The content to verify
   * @param expectedChecksum - The expected checksum in "algorithm.hash" format
   * @returns True if the content matches the expected checksum
   */
  private verifyChecksum(content: string, expectedChecksum: string): boolean {
    const { algorithm } = this.parseChecksum(expectedChecksum);
    const calculatedChecksum = this.calculateChecksum(content, algorithm);
    return calculatedChecksum === expectedChecksum;
  }

  /**
   * Closes the database connection and cleans up resources.
   *
   * This method should be called when you're finished with the migration manager
   * to ensure proper cleanup of database connections and resources.
   *
   * @example
   * ```typescript
   * const manager = new MigrationManager(config);
   * try {
   *   await manager.initialize();
   *   await manager.migrate(schema);
   * } finally {
   *   await manager.close();
   * }
   * ```
   */
  async close(): Promise<void> {
    await this.client.disconnect();
  }
}

/**
 * Utility function to load a schema definition from a JavaScript file.
 *
 * This function dynamically imports a JavaScript file containing a schema definition
 * and returns the schema object. It supports multiple export patterns for flexibility
 * and provides clear error messages for common issues.
 *
 * ## Supported Export Patterns
 *
 * The function looks for schema exports in the following order:
 * 1. `export default schema` - Default export
 * 2. `export const schema = ...` - Named export "schema"
 * 3. `export const fullSchema = ...` - Named export "fullSchema"
 *
 * @param filePath - Path to the JavaScript file containing the schema definition
 * @returns The loaded schema object ready for migration
 * @throws {Error} If file doesn't exist, has wrong extension, or no valid schema export is found
 *
 * @example
 * ```typescript
 * // Load schema from file
 * const schema = await loadSchemaFromFile('./schema.js');
 *
 * // Use with migration manager
 * const manager = new MigrationManager(config);
 * await manager.migrate(schema);
 * ```
 *
 * ## Example Schema File
 *
 * ```javascript
 * // schema.js
 * import { defineSchema, composeSchema, string, int } from 'smig';
 *
 * const userSchema = defineSchema({
 *   table: 'user',
 *   fields: {
 *     id: uuid().default('rand::uuid::v4()'),
 *     name: string().required()
 *   }
 * });
 *
 * export default composeSchema({
 *   models: { user: userSchema }
 * });
 * ```
 */
export async function loadSchemaFromFile(filePath: string): Promise<SurrealDBSchema> {
  // Debug: filePath
  if (!(await fs.pathExists(filePath))) {
    throw new Error(`smig: ${filePath}`);
  }

  const ext = path.extname(filePath);
  if (ext !== ".js") {
    throw new Error(`Unsupported file type: ${ext}. Only .js files are supported.`);
  }

  try {
    // Dynamic import of the schema file
    const module = await import(path.resolve(filePath));

    // Look for default export or named exports
    const schema = module.default || module.schema || module.fullSchema;

    if (!schema) {
      throw new Error(
        'No schema export found. Please export your schema as default or named export "schema" or "fullSchema".',
      );
    }

    return schema;
  } catch (error) {
    throw new Error(`Failed to load schema from ${filePath}: ${error}`);
  }
}
