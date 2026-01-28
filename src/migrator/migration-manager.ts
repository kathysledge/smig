/**
 * @fileoverview Core migration management system for SurrealDB schema evolution.
 *
 * This module contains the MigrationManager class, which is the central orchestrator
 * for all database schema migration operations. It handles schema comparison, migration
 * generation, application tracking, and rollback capabilities, providing a complete
 * solution for managing database schema evolution over time.
 */

import { createHash } from 'node:crypto';
import * as path from 'node:path';
import * as fs from 'fs-extra';
import { SurrealClient } from '../database/surreal-client';
// SQL generators
import { generateIndexDefinition as generateIndexSQL } from '../generators/index-gen';
import type {
  DatabaseConfig,
  IntrospectedAnalyzer,
  IntrospectedEvent,
  IntrospectedField,
  IntrospectedFunction,
  IntrospectedIndex,
  IntrospectedRelation,
  IntrospectedScope,
  IntrospectedTable,
  Migration,
  MigrationChange,
  MigrationStatus,
  SurrealAnalyzer,
  SurrealDBSchema,
  SurrealFunction,
  SurrealScope,
} from '../types/schema';
import { debugLog, debugLogSchema } from '../utils/debug-logger';
// Introspection parsers
import { parseTableInfo } from './introspection';

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
   * - checksum: SHA256 hash of the up migration (for integrity verification)
   * - downChecksum: SHA256 hash of the down migration (for integrity verification)
   */
  private async createMigrationsTable(): Promise<void> {
    try {
      // Check if the table already exists by trying to query it
      await this.client.executeQuery('SELECT * FROM _migrations LIMIT 1');
      // If we get here, the table exists, so we don't need to create it
      return;
    } catch (_error) {
      // Table doesn't exist, so create it
      const createTableQuery = `
        DEFINE TABLE _migrations SCHEMAFULL;
        DEFINE FIELD appliedAt ON TABLE _migrations TYPE datetime;
        DEFINE FIELD up ON TABLE _migrations TYPE string;
        DEFINE FIELD down ON TABLE _migrations TYPE string;
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
   *     id_uuid: uuid().default('rand::uuid::v7()'),
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
        debugLog('No changes detected - skipping migration');
        throw new Error('No changes detected. Database schema is already up to date.');
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
    debugLog(`Starting rollback process. Migration ID: ${migrationId || 'latest'}`);
    const migrations = await this.getAppliedMigrations();
    debugLog(`Found ${migrations.length} applied migrations for rollback`);

    if (migrations.length === 0) {
      throw new Error('No migrations to rollback');
    }

    debugLog(`Available migration IDs: ${migrations.map((m) => m.id).join(', ')}`);

    const migrationToRollback = migrationId
      ? migrations.find((m) => String(m.id) === String(migrationId))
      : migrations[migrations.length - 1];

    if (!migrationToRollback) {
      debugLog(
        `Migration not found. Requested: ${migrationId}, Available: [${migrations.map((m) => m.id).join(', ')}]`,
      );
      throw new Error(
        `Migration ${migrationId} not found. Available migrations: ${migrations.map((m) => m.id).join(', ')}`,
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
    debugLog('Getting migration status...');
    const appliedMigrations = await this.getAppliedMigrations();
    debugLog(`Status: Found ${appliedMigrations.length} applied migrations`);

    const status = appliedMigrations.map((migration) => ({
      applied: true,
      migration,
    }));

    debugLog('Migration status result:', status);
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
    debugLogSchema('Current Database Schema', currentSchema);
    debugLogSchema('New Schema Definition', schema);

    debugLog(
      'Current schema tables:',
      currentSchema.tables.map((t) => t.name),
    );
    debugLog(
      'New schema tables:',
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

    // Check for param changes
    for (const newParam of schema.params || []) {
      const currentParam = (currentSchema.params || []).find((p) => p.name === newParam.name);

      if (!currentParam) {
        return true; // New param found
      }

      // Check if param value has changed
      if (currentParam.value !== newParam.value) {
        return true; // Param modified
      }
    }

    // Check for removed params
    for (const currentParam of currentSchema.params || []) {
      const stillExists = (schema.params || []).find((p) => p.name === currentParam.name);
      if (!stillExists) {
        return true; // Removed param found
      }
    }

    // Check for sequence changes
    for (const newSequence of schema.sequences || []) {
      const currentSequence = (currentSchema.sequences || []).find(
        (s) => s.name === newSequence.name,
      );

      if (!currentSequence) {
        return true; // New sequence found
      }
    }

    // Check for removed sequences
    for (const currentSequence of currentSchema.sequences || []) {
      const stillExists = (schema.sequences || []).find((s) => s.name === currentSequence.name);
      if (!stillExists) {
        return true; // Removed sequence found
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
   * - **Schema introspection**: Uses SurrealDB’s native INFO commands for accurate schema reading
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
   * // DEFINE FIELD id_uuid ON TABLE user TYPE uuid DEFAULT rand::uuid::v7();
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
    const changeLog: MigrationChange[] = [];

    upChanges.push(`-- Migration diff for ${new Date().toISOString()}`);
    upChanges.push('');

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
        const schemaMode = newTable.schemafull === false ? 'SCHEMALESS' : 'SCHEMAFULL';
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
        upChanges.push('');

        // Track for rollback
        changeLog.push({
          type: 'table',
          table: newTable.name,
          operation: 'create',
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
            type: 'table',
            table: newTable.name,
            operation: 'modify',
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
        upChanges.push('');

        // Track for rollback
        changeLog.push({
          type: 'table',
          table: currentTable.name,
          operation: 'remove',
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
        const schemaMode = newRelation.schemafull === false ? 'SCHEMALESS' : 'SCHEMAFULL';
        const enforced = newRelation.enforced ? ' ENFORCED' : '';
        upChanges.push(
          `DEFINE TABLE ${newRelation.name} TYPE RELATION IN ${newRelation.from} OUT ${newRelation.to}${enforced} ${schemaMode};`,
        );

        // Add fields (skip 'in' and 'out' as they are auto-created by TYPE RELATION)
        for (const field of newRelation.fields) {
          if (field.name === 'in' || field.name === 'out') continue;
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
        upChanges.push('');

        // Track for rollback
        changeLog.push({
          type: 'relation',
          table: newRelation.name,
          operation: 'create',
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
          const schemaMode = newRelation.schemafull === false ? 'SCHEMALESS' : 'SCHEMAFULL';
          const enforced = newRelation.enforced ? ' ENFORCED' : '';
          upChanges.push(
            `DEFINE TABLE ${newRelation.name} TYPE RELATION IN ${newRelation.from} OUT ${newRelation.to}${enforced} ${schemaMode};`,
          );

          // Add all fields (skip 'in' and 'out' as they are auto-created by TYPE RELATION)
          for (const field of newRelation.fields) {
            if (field.name === 'in' || field.name === 'out') continue;
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
          upChanges.push('');

          // Track for rollback - recreation means we need to restore the old relation
          changeLog.push({
            type: 'relation',
            table: newRelation.name,
            operation: 'recreate',
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
              type: 'relation',
              table: newRelation.name,
              operation: 'modify',
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
        upChanges.push('');

        // Track for rollback
        changeLog.push({
          type: 'relation',
          table: currentRelation.name,
          operation: 'remove',
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
        upChanges.push('');

        // Track for rollback
        changeLog.push({
          type: 'function',
          table: newFunction.name,
          operation: 'create',
          details: { func: newFunction },
        });
      } else {
        // Check if function has been modified
        const funcModified = this.isFunctionModified(currentFunction, newFunction);
        if (funcModified) {
          upChanges.push(`-- Modified function: ${newFunction.name}`);
          upChanges.push(this.generateFunctionDefinition(newFunction, true)); // true = use OVERWRITE
          upChanges.push('');

          // Track for rollback
          changeLog.push({
            type: 'function',
            table: newFunction.name,
            operation: 'modify',
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
        upChanges.push('');

        // Track for rollback
        changeLog.push({
          type: 'function',
          table: currentFunction.name,
          operation: 'remove',
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
        upChanges.push('');

        // Track for rollback
        changeLog.push({
          type: 'scope',
          table: newScope.name,
          operation: 'create',
          details: { scope: newScope },
        });
      } else {
        // Check if scope has been modified
        const scopeModified = this.isScopeModified(currentScope, newScope);
        if (scopeModified) {
          upChanges.push(`-- Modified scope: ${newScope.name}`);
          upChanges.push(this.generateScopeDefinition(newScope, true)); // true = use OVERWRITE
          upChanges.push('');

          // Track for rollback
          changeLog.push({
            type: 'scope',
            table: newScope.name,
            operation: 'modify',
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
        upChanges.push('');

        // Track for rollback
        changeLog.push({
          type: 'scope',
          table: currentScope.name,
          operation: 'remove',
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
        upChanges.push('');

        // Track for rollback
        changeLog.push({
          type: 'analyzer',
          table: newAnalyzer.name,
          operation: 'create',
          details: { analyzer: newAnalyzer },
        });
      } else {
        // Check if analyzer has been modified
        const analyzerModified = this.isAnalyzerModified(currentAnalyzer, newAnalyzer);
        if (analyzerModified) {
          upChanges.push(`-- Modified analyzer: ${newAnalyzer.name}`);
          upChanges.push(this.generateAnalyzerDefinition(newAnalyzer, true)); // true = use OVERWRITE
          upChanges.push('');

          // Track for rollback
          changeLog.push({
            type: 'analyzer',
            table: newAnalyzer.name,
            operation: 'modify',
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
        upChanges.push('');

        // Track for rollback
        changeLog.push({
          type: 'analyzer',
          table: currentAnalyzer.name,
          operation: 'remove',
          details: { currentAnalyzer },
        });
      }
    }

    // Handle params
    for (const newParam of schema.params || []) {
      const currentParam = (currentSchema.params || []).find((p) => p.name === newParam.name);

      if (!currentParam) {
        // New param
        upChanges.push(`-- New param: ${newParam.name}`);
        upChanges.push(`DEFINE PARAM $${newParam.name} VALUE ${newParam.value};`);
        upChanges.push('');

        changeLog.push({
          type: 'param',
          table: newParam.name,
          operation: 'create',
          details: { newParam },
        });
      } else if (currentParam.value !== newParam.value) {
        // Modified param value
        upChanges.push(`-- Modified param: ${newParam.name}`);
        upChanges.push(`ALTER PARAM $${newParam.name} VALUE ${newParam.value};`);
        upChanges.push('');

        changeLog.push({
          type: 'param',
          table: newParam.name,
          operation: 'modify',
          details: { oldValue: currentParam.value, newValue: newParam.value },
        });
      }
    }

    // Check for removed params
    for (const currentParam of currentSchema.params || []) {
      const stillExists = (schema.params || []).find((p) => p.name === currentParam.name);
      if (!stillExists) {
        upChanges.push(`-- Removed param: ${currentParam.name}`);
        upChanges.push(`REMOVE PARAM $${currentParam.name};`);
        upChanges.push('');

        changeLog.push({
          type: 'param',
          table: currentParam.name,
          operation: 'remove',
          details: { currentParam },
        });
      }
    }

    // Handle sequences
    for (const newSequence of schema.sequences || []) {
      const currentSequence = (currentSchema.sequences || []).find(
        (s) => s.name === newSequence.name,
      );

      if (!currentSequence) {
        // New sequence
        upChanges.push(`-- New sequence: ${newSequence.name}`);
        let seqDef = `DEFINE SEQUENCE ${newSequence.name}`;
        // SurrealDB 3.x only supports START for sequences
        if (newSequence.start !== undefined) seqDef += ` START ${newSequence.start}`;
        upChanges.push(`${seqDef};`);
        upChanges.push('');

        changeLog.push({
          type: 'sequence',
          table: newSequence.name,
          operation: 'create',
          details: { newSequence },
        });
      }
    }

    // Check for removed sequences
    for (const currentSequence of currentSchema.sequences || []) {
      const stillExists = (schema.sequences || []).find((s) => s.name === currentSequence.name);
      if (!stillExists) {
        upChanges.push(`-- Removed sequence: ${currentSequence.name}`);
        upChanges.push(`REMOVE SEQUENCE ${currentSequence.name};`);
        upChanges.push('');

        changeLog.push({
          type: 'sequence',
          table: currentSequence.name,
          operation: 'remove',
          details: { currentSequence },
        });
      }
    }

    // Generate rollback migration (reverse order of changes)
    downChanges.push('-- Rollback migration');
    downChanges.push('');

    // Process changes in reverse order for rollback
    for (let i = changeLog.length - 1; i >= 0; i--) {
      const change = changeLog[i];

      switch (change.operation) {
        case 'create':
          // Rollback create = remove
          if (change.type === 'table' || change.type === 'relation') {
            downChanges.push(`-- Rollback: Remove ${change.type} ${change.table}`);
            downChanges.push(`REMOVE TABLE ${change.table};`);
            downChanges.push('');
          } else if (change.type === 'function') {
            downChanges.push(`-- Rollback: Remove function ${change.table}`);
            downChanges.push(`REMOVE FUNCTION ${change.table};`);
            downChanges.push('');
          } else if (change.type === 'scope') {
            downChanges.push(`-- Rollback: Remove scope ${change.table}`);
            downChanges.push(`REMOVE ACCESS ${change.table} ON DATABASE;`);
            downChanges.push('');
          } else if (change.type === 'analyzer') {
            downChanges.push(`-- Rollback: Remove analyzer ${change.table}`);
            downChanges.push(`REMOVE ANALYZER ${change.table};`);
            downChanges.push('');
          } else if (change.type === 'param') {
            downChanges.push(`-- Rollback: Remove param ${change.table}`);
            downChanges.push(`REMOVE PARAM $${change.table};`);
            downChanges.push('');
          } else if (change.type === 'sequence') {
            downChanges.push(`-- Rollback: Remove sequence ${change.table}`);
            downChanges.push(`REMOVE SEQUENCE ${change.table};`);
            downChanges.push('');
          }
          break;

        case 'remove':
          // Rollback remove = recreate
          if (change.type === 'table' || change.type === 'relation') {
            const currentTable = change.details.currentTable as IntrospectedTable | undefined;

            // Check if currentTable exists before proceeding
            if (!currentTable) {
              debugLog(
                `Warning: Cannot generate rollback for removed ${change.table} - original table state not found`,
              );
              break;
            }

            downChanges.push(`-- Rollback: Recreate ${change.type} ${change.table}`);
            const schemaMode = currentTable.schemafull === false ? 'SCHEMALESS' : 'SCHEMAFULL';
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
            downChanges.push('');
          } else if (change.type === 'function') {
            const func = change.details.currentFunction as IntrospectedFunction | undefined;
            if (func) {
              downChanges.push(`-- Rollback: Recreate function ${change.table}`);
              downChanges.push(this.generateFunctionDefinition(func));
              downChanges.push('');
            }
          } else if (change.type === 'scope') {
            const scope = change.details.currentScope as IntrospectedScope | undefined;
            if (scope) {
              downChanges.push(`-- Rollback: Recreate scope ${change.table}`);
              downChanges.push(this.generateScopeDefinition(scope));
              downChanges.push('');
            }
          } else if (change.type === 'analyzer') {
            const analyzer = change.details.currentAnalyzer as IntrospectedAnalyzer | undefined;
            if (analyzer) {
              downChanges.push(`-- Rollback: Recreate analyzer ${change.table}`);
              downChanges.push(this.generateAnalyzerDefinition(analyzer));
              downChanges.push('');
            }
          } else if (change.type === 'param') {
            const param = change.details.currentParam as
              | { name: string; value: unknown }
              | undefined;
            if (param) {
              downChanges.push(`-- Rollback: Recreate param ${change.table}`);
              downChanges.push(`DEFINE PARAM $${param.name} VALUE ${param.value};`);
              downChanges.push('');
            }
          } else if (change.type === 'sequence') {
            const seq = change.details.currentSequence as
              | { name: string; start?: number }
              | undefined;
            if (seq) {
              downChanges.push(`-- Rollback: Recreate sequence ${change.table}`);
              let seqDef = `DEFINE SEQUENCE ${seq.name}`;
              // SurrealDB 3.x only supports START for sequences
              if (seq.start !== undefined) seqDef += ` START ${seq.start}`;
              downChanges.push(`${seqDef};`);
              downChanges.push('');
            }
          }
          break;

        case 'modify':
          // Rollback modifications - restore original state
          if (change.type === 'table' || change.type === 'relation') {
            const currentTable = (change.details.currentTable || change.details.currentRelation) as
              | IntrospectedTable
              | undefined;

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
            const fieldChanges = (change.details.fieldChanges || []) as string[];
            for (const changeLine of fieldChanges) {
              if (changeLine.includes('DEFINE FIELD OVERWRITE')) {
                // Extract field name and restore original definition
                // Updated regex to support field names with dots (e.g., "emails.address")
                const fieldMatch = changeLine.match(/DEFINE FIELD OVERWRITE ([^\s]+) ON TABLE/);
                if (fieldMatch) {
                  const fieldName = fieldMatch[1];
                  const originalField = currentTable.fields?.find((f) => f.name === fieldName);
                  if (originalField) {
                    downChanges.push(`-- Restore field ${fieldName} to original state`);
                    downChanges.push(this.generateFieldDefinition(change.table, originalField));
                  }
                }
              } else if (changeLine.includes('DEFINE FIELD')) {
                // New field added - remove it
                // Updated regex to support field names with dots (e.g., "emails.address")
                const fieldMatch = changeLine.match(/DEFINE FIELD ([^\s]+) ON TABLE/);
                if (fieldMatch) {
                  const fieldName = fieldMatch[1];
                  downChanges.push(`-- Remove field ${fieldName}`);
                  downChanges.push(`REMOVE FIELD ${fieldName} ON TABLE ${change.table};`);
                }
              } else if (changeLine.includes('REMOVE FIELD')) {
                // Field removed - restore it
                // Updated regex to support field names with dots (e.g., "emails.address")
                const fieldMatch = changeLine.match(/REMOVE FIELD ([^\s]+) ON TABLE/);
                if (fieldMatch) {
                  const fieldName = fieldMatch[1];
                  const originalField = currentTable.fields?.find((f) => f.name === fieldName);
                  if (originalField) {
                    downChanges.push(`-- Restore removed field ${fieldName}`);
                    downChanges.push(this.generateFieldDefinition(change.table, originalField));
                  }
                }
              }
            }

            // Rollback index changes
            const indexChanges = (change.details.indexChanges || []) as string[];
            for (const changeLine of indexChanges) {
              if (changeLine.includes('DEFINE INDEX')) {
                // New index added - remove it
                const indexMatch = changeLine.match(/DEFINE INDEX (\w+) ON TABLE/);
                if (indexMatch) {
                  const indexName = indexMatch[1];
                  downChanges.push(`-- Remove index ${indexName}`);
                  downChanges.push(`REMOVE INDEX ${indexName} ON TABLE ${change.table};`);
                }
              } else if (changeLine.includes('REMOVE INDEX')) {
                // Index removed - restore it
                const indexMatch = changeLine.match(/REMOVE INDEX (\w+) ON TABLE/);
                if (indexMatch) {
                  const indexName = indexMatch[1];
                  const originalIndex = currentTable.indexes?.find((i) => i.name === indexName);
                  if (originalIndex) {
                    downChanges.push(`-- Restore removed index ${indexName}`);
                    downChanges.push(this.generateIndexDefinition(change.table, originalIndex));
                  }
                }
              }
            }

            // Rollback event changes
            const eventChanges = (change.details.eventChanges || []) as string[];
            for (const changeLine of eventChanges) {
              if (changeLine.includes('DEFINE EVENT')) {
                // New event added - remove it
                const eventMatch = changeLine.match(/DEFINE EVENT (\w+) ON TABLE/);
                if (eventMatch) {
                  const eventName = eventMatch[1];
                  downChanges.push(`-- Remove event ${eventName}`);
                  downChanges.push(`REMOVE EVENT ${eventName} ON TABLE ${change.table};`);
                }
              } else if (changeLine.includes('REMOVE EVENT')) {
                // Event removed - restore it
                const eventMatch = changeLine.match(/REMOVE EVENT (\w+) ON TABLE/);
                if (eventMatch) {
                  const eventName = eventMatch[1];
                  const originalEvent = currentTable.events?.find((e) => e.name === eventName);
                  if (originalEvent) {
                    downChanges.push(`-- Restore removed event ${eventName}`);
                    downChanges.push(this.generateEventDefinition(change.table, originalEvent));
                  }
                }
              }
            }
            downChanges.push('');
          } else if (change.type === 'function') {
            // Rollback function modification - restore original function
            const currentFunction = change.details.currentFunction as
              | IntrospectedFunction
              | undefined;
            if (currentFunction) {
              downChanges.push(`-- Rollback: Restore function ${change.table} to original state`);
              downChanges.push(this.generateFunctionDefinition(currentFunction));
              downChanges.push('');
            }
          } else if (change.type === 'scope') {
            // Rollback scope modification - restore original scope
            const currentScope = change.details.currentScope as IntrospectedScope | undefined;
            if (currentScope) {
              downChanges.push(`-- Rollback: Restore scope ${change.table} to original state`);
              downChanges.push(this.generateScopeDefinition(currentScope));
              downChanges.push('');
            }
          } else if (change.type === 'analyzer') {
            // Rollback analyzer modification - restore original analyzer
            const currentAnalyzer = change.details.currentAnalyzer as
              | IntrospectedAnalyzer
              | undefined;
            if (currentAnalyzer) {
              downChanges.push(`-- Rollback: Restore analyzer ${change.table} to original state`);
              downChanges.push(this.generateAnalyzerDefinition(currentAnalyzer));
              downChanges.push('');
            }
          } else if (change.type === 'param') {
            // Rollback param modification - restore original value
            const oldValue = change.details.oldValue as string | undefined;
            if (oldValue) {
              downChanges.push(`-- Rollback: Restore param ${change.table} to original value`);
              downChanges.push(`ALTER PARAM $${change.table} VALUE ${oldValue};`);
              downChanges.push('');
            }
          }
          break;

        case 'recreate':
          // Rollback recreation - restore the original relation
          if (change.type === 'relation') {
            const oldRelation = change.details.oldRelation as IntrospectedRelation | undefined;
            if (!oldRelation) {
              debugLog(
                `Warning: Cannot rollback recreate for ${change.table} - original relation not found`,
              );
              break;
            }
            downChanges.push(`-- Rollback: Restore original ${change.type} ${change.table}`);
            downChanges.push(`REMOVE TABLE ${change.table};`);
            const schemaMode = oldRelation.schemafull === false ? 'SCHEMALESS' : 'SCHEMAFULL';
            downChanges.push(`DEFINE TABLE ${change.table} ${schemaMode};`);

            // Restore original fields
            for (const field of oldRelation.fields || []) {
              downChanges.push(this.generateFieldDefinition(change.table, field));
            }

            // Restore original indexes
            for (const index of oldRelation.indexes || []) {
              downChanges.push(this.generateIndexDefinition(change.table, index));
            }

            // Restore original events
            for (const event of oldRelation.events || []) {
              downChanges.push(this.generateEventDefinition(change.table, event));
            }
            downChanges.push('');
          }
          break;
      }
    }

    return {
      up: upChanges.join('\n').trim(),
      down: downChanges.join('\n').trim(),
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
    debugLog('Querying _migrations table using SDK...');
    const migrationsResult = await this.client.select('_migrations');
    debugLog('Raw migration query result:', migrationsResult);

    // Type assertion for database results
    const migrations = migrationsResult as Record<string, unknown>[];

    if (!migrations || migrations.length === 0) {
      debugLog('No migrations found');
      return [];
    }

    debugLog(
      'Found migrations:',
      migrations.map((m: Record<string, unknown>) => ({
        id: m.id,
        appliedAt: m.appliedAt,
      })),
    );

    // Map database fields to Migration type
    const processedMigrations = migrations
      .map((m: Record<string, unknown>) => ({
        id: String(m.id), // Ensure ID is always a string
        appliedAt: new Date(m.appliedAt as string | number | Date),
        up: m.up as string,
        down: m.down as string,
        checksum: m.checksum as string,
        downChecksum: m.downChecksum as string,
      }))
      .sort((a: Migration, b: Migration) => a.appliedAt.getTime() - b.appliedAt.getTime()); // Sort by appliedAt ASC

    debugLog(
      `Found ${processedMigrations.length} migrations:`,
      processedMigrations.map((m: Migration) => ({
        id: m.id,
        appliedAt: m.appliedAt,
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
    debugLog(`Recording migration: ${migration.id}`);

    const migrationData = {
      appliedAt: new Date(),
      up: migration.up,
      down: migration.down,
      checksum: migration.checksum,
      downChecksum: migration.downChecksum,
    };

    const resultRaw = await this.client.create('_migrations', migrationData);

    // Type assertion for database results
    const result = resultRaw as Record<string, unknown> | Record<string, unknown>[];

    // Return the generated record ID for tracking
    const recordId = (Array.isArray(result) ? result[0]?.id : result?.id) as string;
    debugLog(`Migration recorded with ID: ${recordId}`);
    return recordId;
  }

  /**
   * Retrieves and parses the current database schema using SurrealDB’s INFO commands.
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
    debugLog('Using SurrealDB native schema queries...');

    // Use SurrealDB’s INFO command to get database information
    debugLog('Getting database info...');
    const infoQuery = 'INFO FOR DB;';
    const infoResultRaw = await this.client.executeQuery(infoQuery);
    debugLog('Database info result:', infoResultRaw);

    // Type assertion for database query results
    const infoResult = infoResultRaw as Record<string, unknown>[];

    // Extract table names from the database info
    const tableNames: string[] = [];
    if (infoResult && infoResult.length > 0 && infoResult[0].tables) {
      tableNames.push(...Object.keys(infoResult[0].tables as Record<string, unknown>));
    }

    debugLog('Found tables in database:', tableNames);

    const virtualizedTables = [];
    const virtualizedRelations = [];

    for (const tableName of tableNames) {
      // Skip the migrations table
      if (tableName === '_migrations') {
        debugLog('Skipping _migrations table');
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
      'Virtualized tables:',
      virtualizedTables.map((t) => t.name),
    );
    debugLog(
      'Virtualized relations:',
      virtualizedRelations.map((r) => r.name),
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

    // Parse params from database info
    const virtualizedParams = [];
    if (infoResult && infoResult.length > 0 && infoResult[0].params) {
      const paramsObj = infoResult[0].params as Record<string, unknown>;
      for (const [paramName, paramDef] of Object.entries(paramsObj)) {
        try {
          // Parse param definition: "DEFINE PARAM $name VALUE expression"
          const paramDefStr = paramDef as string;
          const valueMatch = paramDefStr.match(/VALUE\s+(.+?)(?:\s+COMMENT|;|$)/i);
          const value = valueMatch ? valueMatch[1].trim() : '';
          virtualizedParams.push({
            name: paramName.startsWith('$') ? paramName.substring(1) : paramName,
            value: value,
          });
          debugLog(`Parsed param ${paramName}:`, { value });
        } catch (error) {
          debugLog(`Could not parse param ${paramName}:`, error);
        }
      }
    }

    // Parse sequences from database info
    const virtualizedSequences = [];
    if (infoResult && infoResult.length > 0 && infoResult[0].sequences) {
      const sequencesObj = infoResult[0].sequences as Record<string, unknown>;
      for (const [seqName, seqDef] of Object.entries(sequencesObj)) {
        try {
          // Parse sequence definition: "DEFINE SEQUENCE name START x STEP y"
          const seqDefStr = seqDef as string;
          const startMatch = seqDefStr.match(/START\s+(\d+)/i);
          const stepMatch = seqDefStr.match(/STEP\s+(\d+)/i);
          virtualizedSequences.push({
            name: seqName,
            start: startMatch ? parseInt(startMatch[1], 10) : undefined,
            step: stepMatch ? parseInt(stepMatch[1], 10) : undefined,
          });
          debugLog(`Parsed sequence ${seqName}:`, { start: startMatch?.[1], step: stepMatch?.[1] });
        } catch (error) {
          debugLog(`Could not parse sequence ${seqName}:`, error);
        }
      }
    }

    debugLog(`Parsed ${virtualizedFunctions.length} functions`);
    debugLog(`Parsed ${virtualizedScopes.length} scopes`);
    debugLog(`Parsed ${virtualizedAnalyzers.length} analyzers`);
    debugLog(`Parsed ${virtualizedParams.length} params`);
    debugLog(`Parsed ${virtualizedSequences.length} sequences`);

    return {
      tables: virtualizedTables,
      relations: virtualizedRelations,
      functions: virtualizedFunctions,
      scopes: virtualizedScopes,
      analyzers: virtualizedAnalyzers,
      params: virtualizedParams,
      sequences: virtualizedSequences,
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
  private parseInfoResult(tableName: string, infoResultRaw: unknown): IntrospectedTable {
    // Type assertion for database introspection results
    const infoResult = infoResultRaw as Record<string, unknown>;
    // Parse the INFO FOR TABLE result to extract schema information
    debugLog(`Parsing info result for ${tableName}:`, infoResult);

    // Use the modular introspection parser
    const rawTableInfo = parseTableInfo(tableName, infoResult);

    // Cast to typed structure
    const fields = (rawTableInfo.fields as IntrospectedField[]) || [];
    const indexes = (rawTableInfo.indexes as IntrospectedIndex[]) || [];
    const events = (rawTableInfo.events as IntrospectedEvent[]) || [];

    debugLog(`Parsed table ${tableName}:`, {
      fields: fields.length,
      indexes: indexes.length,
      events: events.length,
      isRelation: rawTableInfo.isRelation,
    });

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
      const paramParts = paramStr.split(',');
      for (const part of paramParts) {
        const trimmed = part.trim();
        if (trimmed) {
          // Format: $name: type
          const colonIndex = trimmed.indexOf(':');
          if (colonIndex > 0) {
            const paramName = trimmed.substring(0, colonIndex).trim().replace('$', '');
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
    let body = '';
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
      tokenizers.push(...tokenizerStr.split(',').map((t) => t.trim()));
    }

    // Parse filters
    const filters: string[] = [];
    const filterMatch = analyzerDef.match(/FILTERS\s+(.+?)$/);
    if (filterMatch) {
      const filterStr = filterMatch[1].trim();
      filters.push(...filterStr.split(',').map((f) => f.trim()));
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

    // Compare body (normalize whitespace and unnecessary parentheses for comparison)
    const normalizeBody = (body: string) => {
      if (!body) return '';
      let normalized = body.replace(/\s+/g, ' ').trim();
      // Remove trailing semicolons (SurrealDB may omit or add them)
      normalized = normalized.replace(/;\s*$/, '');
      // Normalize parentheses around arithmetic expressions like (time::now() - $time)
      // that SurrealDB may return without parens
      let prev = '';
      while (prev !== normalized) {
        prev = normalized;
        // Remove parens around function call minus variable: (func::call() - $var)
        normalized = normalized.replace(
          /\(([a-zA-Z_:]+\([^()]*\)\s*[-+*/]\s*\$[a-zA-Z_]+)\)/g,
          '$1',
        );
        // Remove parens around arithmetic with two function calls
        normalized = normalized.replace(
          /\(([a-zA-Z_:]+\([^()]*\)\s*[-+*/]\s*[a-zA-Z_:]+\([^()]*\))\)/g,
          '$1',
        );
      }
      return normalized;
    };
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
        case 's':
          return num / 86400; // seconds to days
        case 'm':
          return num / 1440; // minutes to days
        case 'h':
          return num / 24; // hours to days
        case 'd':
          return num; // days
        case 'w':
          return num * 7; // weeks to days
        case 'y':
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
    const normalizeQuery = (query: string | null) => query?.replace(/\s+/g, ' ').trim() || null;
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
   * 1. Primary check: Presence of both 'in' and 'out' fields (SurrealDB’s standard relation fields)
   * 2. Fallback heuristic: Table name patterns common to relation tables
   *
   * @param tableName - The name of the table to check
   * @param tableInfo - The parsed table information
   * @returns True if the table is identified as a relation table
   */
  private isRelationTable(tableName: string, tableInfo: IntrospectedTable): boolean {
    // First check if the table has the standard relation fields
    const hasInField = tableInfo.fields?.some((f) => f.name === 'in');
    const hasOutField = tableInfo.fields?.some((f) => f.name === 'out');

    // If it has both 'in' and 'out' fields, it's a relation
    // This is the only reliable way to detect relations - the 'in' and 'out' fields
    // are automatically created by SurrealDB for relation tables
    if (hasInField && hasOutField) {
      debugLog(`Table ${tableName} identified as relation (has 'in' and 'out' fields)`);
      return true;
    }

    // Don't use name-based heuristics as they cause false positives
    // (e.g., "simple_test" would match because it contains "_")
    return false;
  }

  /**
   * Extracts the from/to table names from a relation table's in/out field types.
   *
   * @param tableInfo - The table info object containing field definitions
   * @returns Object with from and to table names
   */
  private extractRelationInfo(tableInfo: IntrospectedTable): {
    from: string;
    to: string;
  } {
    const inField = tableInfo.fields?.find((f) => f.name === 'in');
    const outField = tableInfo.fields?.find((f) => f.name === 'out');

    // Extract table names from record types (e.g., "record<user>" -> "user")
    const extractTableFromRecordType = (fieldType: string): string | null => {
      const match = fieldType.match(/record<(\w+)>/);
      return match ? match[1] : null;
    };

    const fromTable = inField?.type ? extractTableFromRecordType(inField.type) : null;
    const toTable = outField?.type ? extractTableFromRecordType(outField.type) : null;

    debugLog(`Extracted relation info:`, {
      tableName: tableInfo.name,
      from: fromTable,
      to: toTable,
      inFieldType: inField?.type,
      outFieldType: outField?.type,
    });

    return {
      from: fromTable || 'unknown',
      to: toTable || 'unknown',
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
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }
    if (typeof value === 'string') {
      // Check if it's already a SurrealQL expression (contains functions, variables, etc.)
      if (value.includes('(') || value.startsWith('$') || value.includes('::')) {
        return value;
      }
      // Otherwise, it's a literal string that needs quotes
      return `"${value}"`;
    }
    // Numbers, booleans, null
    return String(value);
  }

  /**
   * Converts double quotes to single quotes in array literals to match SurrealDB output.
   * SurrealDB returns arrays with single-quoted strings: ['a', 'b'] not ["a", "b"]
   */
  private toSurrealQuotes(value: string): string {
    return value.replace(/\[([^\]]*)\]/g, (_match, contents) => {
      const normalized = contents.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, "'$1'");
      return `[${normalized}]`;
    });
  }

  private generateFieldDefinition(tableName: string, field: IntrospectedField): string {
    let definition = `DEFINE FIELD ${field.name} ON TABLE ${tableName} TYPE ${field.type}`;

    if (field.value) {
      definition += ` VALUE ${field.value}`;
    }

    if (field.assert) {
      definition += ` ASSERT ${this.toSurrealQuotes(field.assert)}`;
    }

    if (field.default !== undefined && field.default !== null) {
      definition += ` DEFAULT ${this.serializeDefaultValue(field.default)}`;
    }

    // Add permissions (null/undefined means use default "FULL")
    if (
      field.permissions !== null &&
      field.permissions !== undefined &&
      field.permissions !== 'FULL'
    ) {
      definition += ` PERMISSIONS ${field.permissions}`;
    }

    definition += ';';
    return definition;
  }

  /**
   * Generates a SurrealQL DEFINE INDEX statement from an index definition.
   *
   * This method constructs the complete index definition including column list,
   * uniqueness constraint, and advanced index types (HNSW, MTREE, SEARCH) in
   * the correct SurrealQL syntax.
   *
   * @param tableName - The name of the table the index belongs to
   * @param index - The index definition object
   * @returns Complete DEFINE INDEX statement
   */
  private generateIndexDefinition(tableName: string, index: IntrospectedIndex): string {
    const columns = index.columns || [];
    const indexName = index.name || `${tableName}_${columns.join('_')}`;

    // Cast type and dist to the expected types for the generator
    type IndexTypeVal = 'BTREE' | 'HASH' | 'SEARCH' | 'MTREE' | 'HNSW';
    type DistVal =
      | 'COSINE'
      | 'EUCLIDEAN'
      | 'MANHATTAN'
      | 'MINKOWSKI'
      | 'CHEBYSHEV'
      | 'HAMMING'
      | null;

    // Use the proper generator which supports all index types
    return generateIndexSQL(tableName, indexName, {
      columns,
      unique: index.unique || false,
      type: (index.type || 'BTREE') as IndexTypeVal,
      // Search options
      analyzer: index.analyzer || null,
      highlights: index.highlights || false,
      bm25: index.bm25 || null,
      docIdsCache: index.docIdsCache || null,
      docLengthsCache: index.docLengthsCache || null,
      postingsCache: index.postingsCache || null,
      termsCache: index.termsCache || null,
      // Vector options (MTREE/HNSW)
      dimension: index.dimension || null,
      dist: (index.dist || null) as DistVal,
      // MTREE-specific
      capacity: index.capacity || null,
      // HNSW-specific
      efc: index.efc || null,
      m: index.m || null,
      m0: index.m0 || null,
      lm: index.lm || null,
      // Metadata
      comments: index.comments || [],
      previousNames: index.previousNames || [],
      ifNotExists: index.ifNotExists || false,
      overwrite: index.overwrite || false,
      concurrently: index.concurrently || false,
    });
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
  private generateEventDefinition(tableName: string, event: IntrospectedEvent): string {
    const thenValue = event.thenStatement ?? '';
    const trimmedStatement = String(thenValue).trim();

    // If the statement is already wrapped in braces, don't wrap again
    const isAlreadyWrapped = trimmedStatement.startsWith('{') && trimmedStatement.endsWith('}');

    if (isAlreadyWrapped) {
      // User already provided braces, use as-is
      return `DEFINE EVENT ${event.name} ON TABLE ${tableName} WHEN ${event.when} THEN ${trimmedStatement};`;
    }

    // Check if the then action contains multiple statements or control flow (FOR, IF, etc.)
    const hasMultipleStatements = trimmedStatement.includes(';');
    const hasControlFlow = /\b(FOR|IF|LET)\b/.test(trimmedStatement);

    if (hasMultipleStatements || hasControlFlow) {
      // Wrap multiple statements or control flow in a block with braces
      return `DEFINE EVENT ${event.name} ON TABLE ${tableName} WHEN ${event.when} THEN {\n${trimmedStatement}\n};`;
    } else {
      // Single statement, no need for block
      return `DEFINE EVENT ${event.name} ON TABLE ${tableName} WHEN ${event.when} THEN ${trimmedStatement};`;
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
  private generateFunctionDefinition(func: IntrospectedFunction, overwrite = false): string {
    let definition = `DEFINE FUNCTION ${overwrite ? 'OVERWRITE ' : ''}${func.name}`;

    // Add parameters
    if (func.parameters && func.parameters.length > 0) {
      const params = func.parameters
        .map((p: { name: string; type: string }) => `$${p.name}: ${p.type}`)
        .join(', ');
      definition += `(${params})`;
    } else {
      definition += '()';
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
  private generateScopeDefinition(scope: IntrospectedScope, overwrite = false): string {
    let definition = `DEFINE ACCESS ${overwrite ? 'OVERWRITE ' : ''}${scope.name} ON DATABASE TYPE RECORD`;

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
  private generateAnalyzerDefinition(analyzer: IntrospectedAnalyzer, overwrite = false): string {
    let definition = `DEFINE ANALYZER ${overwrite ? 'OVERWRITE ' : ''}${analyzer.name}`;

    // Add tokenizers
    if (analyzer.tokenizers && analyzer.tokenizers.length > 0) {
      definition += ` TOKENIZERS ${analyzer.tokenizers.join(', ')}`;
    }

    // Add filters
    if (analyzer.filters && analyzer.filters.length > 0) {
      definition += ` FILTERS ${analyzer.filters.join(', ')}`;
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
    newTable: IntrospectedTable,
    currentTable: IntrospectedTable,
  ): Promise<string[]> {
    const changes: string[] = [];

    // Ensure we have valid field arrays
    const newFields = newTable.fields || [];
    const currentFields = currentTable?.fields || [];

    // Filter out auto-generated relation fields for relation tables
    const filteredNewFields = this.isRelationTable(newTable.name, newTable)
      ? newFields.filter((f) => f?.name && f.name !== 'in' && f.name !== 'out')
      : newFields;

    const filteredCurrentFields =
      currentTable && this.isRelationTable(currentTable.name, currentTable)
        ? currentFields.filter((f) => f?.name && f.name !== 'in' && f.name !== 'out')
        : currentFields;

    // Check for new fields and field modifications
    for (const newField of filteredNewFields) {
      if (!newField || !newField.name) continue;
      const currentField = filteredCurrentFields.find((f) => f && f.name === newField.name);

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

      // Skip auto-generated array element fields (e.g., tags.* for array field tags)
      // SurrealDB automatically creates these when you define an array<T> field
      const fieldName = String(currentField.name);
      if (fieldName.endsWith('.*')) {
        // Check if the parent field (e.g., "tags") exists in the schema as an array
        const parentFieldName = fieldName.slice(0, -2); // Remove ".*"
        const parentField = filteredNewFields.find((f) => f && f.name === parentFieldName);
        if (parentField && String(parentField.type || '').startsWith('array')) {
          // This is an auto-generated array element field, skip it
          continue;
        }
      }

      const stillExists = filteredNewFields.find((f) => f && f.name === currentField.name);
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
    newField: IntrospectedField,
    currentField: IntrospectedField,
  ): string[] {
    const changes: string[] = [];

    // Compare field properties to detect actual changes
    // Handle permissions: null/undefined in TypeScript schema means "FULL" (default)
    // Also normalize permission strings for comparison (whitespace, case, syntax differences)
    const normalizePermissions = (perm: unknown): string => {
      if (perm === null || perm === undefined || perm === '') return 'FULL';
      let normalized = String(perm).replace(/\s+/g, ' ').trim().toUpperCase();
      // FULL is the default - normalize to FULL
      if (normalized === 'FULL' || normalized === '' || normalized === 'NONE') return 'FULL';
      // SurrealDB drops DELETE from field permissions (deprecated)
      // Remove DELETE and surrounding commas from comparison
      // Handle: ", DELETE", "DELETE,", ", DELETE,", "DELETE WHERE", ", DELETE WHERE"
      normalized = normalized.replace(/,?\s*DELETE\s*,?/gi, ' ');
      // SurrealDB normalizes "FOR x FOR y" to "FOR x, FOR y" (adds commas between FOR clauses)
      // Replace space-separated FOR clauses with comma-separated ones
      normalized = normalized.replace(/(\S)\s+FOR\s+/g, '$1, FOR ');
      // Remove comma before WHERE (e.g., "UPDATE, WHERE" -> "UPDATE WHERE")
      normalized = normalized.replace(/,\s+WHERE\b/gi, ' WHERE');
      // Clean up: normalize spaces, remove double/trailing commas
      normalized = normalized.replace(/\s+/g, ' '); // Normalize all whitespace
      normalized = normalized.replace(/,\s*,+/g, ','); // Remove double commas
      normalized = normalized.replace(/\s*,\s*/g, ', '); // Normalize comma spacing
      normalized = normalized.replace(/^,\s*/, ''); // Remove leading comma
      normalized = normalized.replace(/,\s*$/, ''); // Remove trailing comma
      return normalized.trim();
    };
    const newPermissions = normalizePermissions(newField.permissions);
    const currentPermissions = normalizePermissions(currentField.permissions);

    // Normalize default values for comparison
    // The database returns defaults as strings, but our schema may have arrays, objects, etc.
    // Also handles cases where SurrealDB adds extra quotes around literal values
    // and normalizes quote styles (SurrealDB uses single quotes internally)
    const normalizeDefault = (value: unknown): string => {
      if (value === null || value === undefined) return '';
      if (typeof value === 'string') {
        let normalized = value;
        // Remove outer quotes that SurrealDB may add around literal values
        // e.g., "'0.00'" -> "0.00", "'active'" -> "active"
        if (
          (normalized.startsWith("'") && normalized.endsWith("'")) ||
          (normalized.startsWith('"') && normalized.endsWith('"'))
        ) {
          normalized = normalized.slice(1, -1);
        }
        // Remove backticks around function namespaces (SurrealDB v3 beta2+)
        // e.g., `rand`::uuid::v7() -> rand::uuid::v7()
        // e.g., `sequence`::nextval('order_number') -> sequence::nextval('order_number')
        normalized = normalized.replace(/`([a-z_][a-z0-9_]*)`(::)/gi, '$1$2');
        // Normalize internal quotes to single quotes for comparison
        // e.g., sequence::nextval("order_number") -> sequence::nextval('order_number')
        normalized = normalized.replace(/"([^"\\]*)"/g, "'$1'");
        return normalized;
      }
      if (Array.isArray(value)) return JSON.stringify(value);
      if (typeof value === 'object') return JSON.stringify(value);
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
        comment === 'null' ||
        comment === 'undefined'
      ) {
        return null;
      }
      return String(comment);
    };
    const newComment = normalizeComment(newField.comment);
    const currentComment = normalizeComment(currentField.comment);

    // Normalize value and assert (whitespace and quote differences shouldn't trigger changes)
    const normalizeWhitespace = (value: unknown): string => {
      if (value === null || value === undefined) return '';
      let normalized = String(value).replace(/\s+/g, ' ').trim();
      // Remove parentheses around SELECT statements that SurrealDB adds automatically
      // e.g., "RETURN (SELECT ...)" -> "RETURN SELECT ..."
      normalized = normalized.replace(/RETURN\s+\(\s*SELECT\s+/g, 'RETURN SELECT ');
      normalized = normalized.replace(/\)\s*;?\s*\}/g, ' }');
      // Remove trailing semicolons before closing braces (SurrealDB may omit them)
      normalized = normalized.replace(/;\s*\}/g, ' }');
      // Normalize quote styles in array literals - SurrealDB returns single quotes
      // Convert double quotes to single quotes to match SurrealDB output: ["a", "b"] -> ['a', 'b']
      normalized = normalized.replace(/\[([^\]]*)\]/g, (_match, contents) => {
        // Replace double-quoted strings with single-quoted strings inside arrays
        const normalizedContents = contents.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, "'$1'");
        return `[${normalizedContents}]`;
      });
      // Normalize duration values - SurrealDB normalizes 7d to 1w, etc.
      // Convert weeks to days for consistent comparison (1w = 7d)
      normalized = normalized.replace(/\b(\d+)w\b/g, (_, num) => `${parseInt(num, 10) * 7}d`);

      // Iteratively remove all unnecessary parentheses in assert/value expressions
      // Keep looping until no more changes are made
      let prevNormalized = '';
      while (prevNormalized !== normalized) {
        prevNormalized = normalized;

        // Remove parens around: ($value OPERATOR VALUE) followed by AND/OR
        // e.g., "($value != NONE) AND" -> "$value != NONE AND"
        normalized = normalized.replace(
          /\((\$[a-zA-Z_][a-zA-Z0-9_.]*\s*[!=<>]+\s*[A-Z0-9_]+)\)\s*(AND|OR)/gi,
          '$1 $2',
        );

        // Remove parens around: ($value OPERATOR VALUE) at end of expression (after AND/OR)
        // e.g., "AND ($value <= 100)" -> "AND $value <= 100"
        normalized = normalized.replace(
          /(AND|OR)\s+\((\$[a-zA-Z_][a-zA-Z0-9_.]*\s*[!=<>]+\s*[A-Z0-9_]+)\)$/gi,
          '$1 $2',
        );

        // Remove parens around ($value >= 0) or ($value <= 65536) standalone numeric comparisons
        normalized = normalized.replace(/\((\$[a-zA-Z_][a-zA-Z0-9_.]*\s*[<>=!]+\s*\d+)\)/gi, '$1');

        // Remove parens around function calls: (func::name($arg) OPERATOR VALUE)
        // e.g., "(string::len($value) >= 3)" -> "string::len($value) >= 3"
        normalized = normalized.replace(/\(([a-zA-Z_:]+\([^()]+\)\s*[!=<>]+\s*\d+)\)/g, '$1');

        // Remove parens around standalone function calls: (string::is_alphanum($value))
        normalized = normalized.replace(/\(([a-zA-Z_:]+\([^()]+\))\)/g, '$1');

        // Remove parens around type casts: (<type> expr) -> <type> expr
        // e.g., "(<float> array::len(x) / 2)" -> "<float> array::len(x) / 2"
        normalized = normalized.replace(/\((<[a-zA-Z]+>\s+[^()]+(?:\([^()]*\)[^()]*)*)\)/g, '$1');

        // Remove parens around expressions with AND/OR inside (handles nested function parens)
        // Match: (expr AND expr) where expr can have one level of nested parens
        normalized = normalized.replace(
          /\(([^()]*(?:\([^()]*\)[^()]*)*\s+(?:AND|OR)\s+[^()]*(?:\([^()]*\)[^()]*)*)\)/gi,
          '$1',
        );
      }

      return normalized.trim();
    };

    // Normalize type for comparison - SurrealDB returns `none | X` for option<X>
    const normalizeType = (type: unknown): string => {
      if (type === null || type === undefined) return '';
      let normalized = String(type).replace(/\s+/g, ' ').trim();
      // SurrealDB v3 returns "none | X" for option<X> - normalize to option<X>
      normalized = normalized.replace(/^none\s*\|\s*(.+)$/, 'option<$1>');
      // Also handle "X | none" format
      normalized = normalized.replace(/^(.+?)\s*\|\s*none$/, 'option<$1>');
      return normalized;
    };

    const newValue = normalizeWhitespace(newField.value);
    const currentValue = normalizeWhitespace(currentField.value);
    const newAssert = normalizeWhitespace(newField.assert);
    const currentAssert = normalizeWhitespace(currentField.assert);
    const newType = normalizeType(newField.type);
    const currentType = normalizeType(currentField.type);

    const hasChanges =
      newType !== currentType ||
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
      debugLog(`    type: "${currentType}" vs "${newType}" = ${newType !== currentType}`);
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
      if (newType !== currentType) {
        debugLog(`  - type: "${currentType}" -> "${newType}"`);
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
        fieldDefinition += ` ASSERT ${this.toSurrealQuotes(newField.assert)}`;
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
    newTable: IntrospectedTable,
    currentTable: IntrospectedTable,
  ): string[] {
    const changes: string[] = [];

    // Ensure we have valid index arrays
    const newIndexes = newTable.indexes || [];
    const currentIndexes = currentTable.indexes || [];

    // Check for new indexes
    for (const newIndex of newIndexes) {
      if (!newIndex || !newIndex.columns) continue;
      const currentIndex = currentIndexes.find((i) => i && i.name === newIndex.name);
      if (!currentIndex) {
        changes.push(
          `-- New index: ${newIndex.name || newIndex.columns.join('_')} on table ${newTable.name}`,
        );
        changes.push(this.generateIndexDefinition(newTable.name, newIndex));
      }
    }

    // Check for removed indexes
    for (const currentIndex of currentIndexes) {
      if (!currentIndex || !currentIndex.name) continue;
      const stillExists = newIndexes.find((i) => i && i.name === currentIndex.name);
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
    newTable: IntrospectedTable,
    currentTable: IntrospectedTable,
  ): string[] {
    const changes: string[] = [];

    // Ensure we have valid event arrays
    const newEvents = newTable.events || [];
    const currentEvents = currentTable.events || [];

    // Check for new events
    for (const newEvent of newEvents) {
      if (!newEvent || !newEvent.name) continue;
      const currentEvent = currentEvents.find((e) => e && e.name === newEvent.name);
      if (!currentEvent) {
        changes.push(`-- New event: ${newEvent.name} on table ${newTable.name}`);
        changes.push(this.generateEventDefinition(newTable.name, newEvent));
      }
    }

    // Check for removed events
    for (const currentEvent of currentEvents) {
      if (!currentEvent || !currentEvent.name) continue;
      const stillExists = newEvents.find((e) => e && e.name === currentEvent.name);
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
    newRelation: IntrospectedRelation,
    currentRelation: IntrospectedRelation,
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
  private calculateChecksum(content: string, algorithm: string = 'sha256'): string {
    const hash = createHash(algorithm).update(content).digest('hex');
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
    const parts = checksum.split('.');
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
 * const schema = await loadSchemaFromFile('./schema.ts');
 *
 * // Use with migration manager
 * const manager = new MigrationManager(config);
 * await manager.migrate(schema);
 * ```
 *
 * ## Example Schema File
 *
 * ```typescript
 * // schema.ts
 * import { defineSchema, composeSchema, string, int } from 'smig';
 *
 * const userSchema = defineSchema({
 *   table: 'user',
 *   fields: {
 *     id_uuid: uuid().default('rand::uuid::v7()'),
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
  const supportedExtensions = ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts'];

  if (!supportedExtensions.includes(ext)) {
    throw new Error(
      `Unsupported file type: ${ext}. Supported types: ${supportedExtensions.join(', ')}`,
    );
  }

  try {
    const absolutePath = path.resolve(filePath);
    let module: Record<string, unknown>;

    // Use jiti for TypeScript files, native import for JavaScript
    if (['.ts', '.mts', '.cts'].includes(ext)) {
      // Dynamic import of jiti to avoid bundling issues
      const { createJiti } = await import('jiti');
      const jiti = createJiti(import.meta.url, {
        // Enable TypeScript support
        interopDefault: true,
      });
      module = (await jiti.import(absolutePath)) as Record<string, unknown>;
    } else {
      // Native import for JavaScript files
      module = await import(absolutePath);
    }

    // Look for default export or named exports
    const schema = module.default || module.schema || module.fullSchema;

    if (!schema) {
      throw new Error(
        'No schema export found. Please export your schema as default or named export "schema" or "fullSchema".',
      );
    }

    return schema as SurrealDBSchema;
  } catch (error) {
    throw new Error(`Failed to load schema from ${filePath}: ${error}`);
  }
}
