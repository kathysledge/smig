/**
 * @fileoverview TypeScript type definitions and validation schemas for SurrealDB schema management.
 *
 * This module provides comprehensive type definitions for all aspects of SurrealDB schema
 * management, including field types, table definitions, migration tracking, and database
 * configuration. It also includes Zod validation schemas for runtime type checking and
 * data validation.
 *
 * ## Type Categories
 *
 * - **Field types**: Definitions for all SurrealDB field types and their properties
 * - **Schema elements**: Tables, indexes, events, and relations
 * - **Migration types**: Migration tracking and status management
 * - **Configuration**: Database connection and configuration types
 * - **Validation**: Zod schemas for runtime validation
 *
 * @example
 * ```typescript
 * import { SurrealDBSchema, SurrealTable, DatabaseConfig } from './types/schema';
 *
 * const config: DatabaseConfig = {
 *   url: 'ws://localhost:8000',
 *   namespace: 'test',
 *   database: 'test',
 *   username: 'root',
 *   password: 'root'
 * };
 * ```
 */

import { z } from 'zod';

// ============================================================================
// SURREALDB FIELD TYPES
// ============================================================================

/**
 * Union type for all supported SurrealDB field types.
 *
 * This type defines all the primitive and complex data types that can be used
 * in SurrealDB field definitions, including their common aliases.
 */
export type SurrealFieldType =
  | 'string'
  | 'int'
  | 'float'
  | 'number'
  | 'bool'
  | 'boolean'
  | 'datetime'
  | 'duration'
  | 'decimal'
  | 'uuid'
  | 'array'
  | 'object'
  | 'record'
  | 'geometry'
  | 'option'
  | 'any';

/** Supported SurrealDB index types for different use cases */
export type IndexType = 'BTREE' | 'HASH' | 'SEARCH' | 'MTREE';

/** Database event types for triggers and hooks */
export type EventType = 'CREATE' | 'UPDATE' | 'DELETE';

/** Table schema enforcement types */
export type SchemaType = 'SCHEMAFULL' | 'SCHEMALESS';

// ============================================================================
// FIELD DEFINITIONS
// ============================================================================

/**
 * Comprehensive definition for a SurrealDB table field.
 *
 * This interface captures all possible properties and constraints that can be
 * applied to a database field, including type information, validation rules,
 * default values, and access permissions.
 */
export interface SurrealField {
  /** The field name */
  name: string;
  /** The SurrealDB data type for this field */
  type: string;
  /** Whether the field can be omitted (optional) */
  optional: boolean;
  /** Whether the field is read-only after creation */
  readonly: boolean;
  /** Whether the field accepts flexible/dynamic typing */
  flexible: boolean;
  /** Whether to use IF NOT EXISTS when defining the field */
  ifNotExists: boolean;
  /** Whether to use OVERWRITE when redefining the field */
  overwrite: boolean;
  /** Static default value for the field */
  default: unknown;
  /** Dynamic value expression (SurrealQL) */
  value: string | null;
  /** Validation assertion (SurrealQL condition) */
  assert: string | null;
  /** Field access permissions (null means use default "FULL") */
  permissions: string | null;
  /** Single line comment for the field */
  comment: string | null;
  /** Array of comments for documentation */
  comments: string[];
}

// ============================================================================
// INDEX DEFINITIONS
// ============================================================================

/**
 * Definition for a SurrealDB table index.
 *
 * Indexes improve query performance and can enforce uniqueness constraints.
 * Different index types are optimized for different use cases.
 */
export interface SurrealIndex {
  /** The index name */
  name: string;
  /** Array of column names included in the index */
  columns: string[];
  /** Whether this index enforces uniqueness */
  unique: boolean;
  /** The type of index (BTREE, HASH, SEARCH, MTREE) */
  type: IndexType;
  /** Text analyzer for SEARCH indexes */
  analyzer: string | null;
  /** Whether to enable highlighting for SEARCH indexes */
  highlights: boolean;
  /** Array of comments for documentation */
  comments: string[];
}

// ============================================================================
// EVENT DEFINITIONS
// ============================================================================

/**
 * Definition for a SurrealDB table event (trigger).
 *
 * Events allow automatic execution of SurrealQL code in response to
 * data changes, enabling business logic and data consistency enforcement.
 */
export interface SurrealEvent {
  /** The event name */
  name: string;
  /** When the event should trigger (CREATE, UPDATE, DELETE) */
  type: EventType;
  /** Condition that must be met for the event to execute */
  when: string | null;
  /** SurrealQL code to execute when the event triggers */
  thenStatement: string | null;
  /** Array of comments for documentation */
  comments: string[];
}

// ============================================================================
// TABLE DEFINITIONS
// ============================================================================

/**
 * Complete definition for a SurrealDB table.
 *
 * Tables are the primary data containers in SurrealDB and can be either
 * schemafull (enforced structure) or schemaless (flexible structure).
 */
export interface SurrealTable {
  /** The table name */
  name: string;
  /** Whether the table enforces a strict schema */
  schemafull: boolean;
  /** Table-level access permissions */
  permissions: string | null;
  /** Array of field definitions for this table */
  fields: SurrealField[];
  /** Array of index definitions for this table */
  indexes: SurrealIndex[];
  /** Array of event definitions for this table */
  events: SurrealEvent[];
  /** Array of comments for documentation */
  comments: string[];
}

// ============================================================================
// RELATION DEFINITIONS (GRAPH EDGES)
// ============================================================================

/**
 * Definition for a SurrealDB relation (graph edge).
 *
 * Relations represent connections between records and are a key feature of
 * SurrealDB's graph database capabilities. They define how tables are related
 * and can store additional metadata about the relationship.
 */
export interface SurrealRelation {
  /** The relation name */
  name: string;
  /** Source table for the relation */
  from: string;
  /** Target table for the relation */
  to: string;
  /** Whether the relation uses SCHEMAFULL (true) or SCHEMALESS (false) mode */
  schemafull?: boolean;
  /** Array of field definitions for this relation */
  fields: SurrealField[];
  /** Array of index definitions for this relation */
  indexes: SurrealIndex[];
  /** Array of event definitions for this relation */
  events: SurrealEvent[];
  /** Array of comments for documentation */
  comments: string[];
}

// ============================================================================
// FUNCTION DEFINITIONS
// ============================================================================

/**
 * Definition for a SurrealDB custom function.
 *
 * Functions allow you to define reusable logic that can be called throughout
 * your database queries and business logic. They support parameters, return types,
 * and complex SurrealQL expressions.
 */
export interface SurrealFunction {
  /** The function name (e.g., 'fn::days_since') */
  name: string;
  /** Array of parameter definitions with their types */
  parameters: Array<{ name: string; type: string }>;
  /** The return type of the function */
  returnType: string | null;
  /** The SurrealQL body of the function */
  body: string;
  /** Array of comments for documentation */
  comments: string[];
  /** Optional permissions for function access control */
  permissions?: string | null;
}

// ============================================================================
// SCOPE DEFINITIONS (AUTHENTICATION)
// ============================================================================

/**
 * Definition for a SurrealDB authentication scope.
 *
 * Scopes provide session-based authentication with custom SIGNUP and SIGNIN logic.
 * They define how users authenticate and what session duration to use.
 */
export interface SurrealScope {
  /** The scope name */
  name: string;
  /** Session duration (e.g., '7d', '24h', '30m') */
  session: string | null;
  /** SurrealQL for user signup logic */
  signup: string | null;
  /** SurrealQL for user signin logic */
  signin: string | null;
  /** Array of comments for documentation */
  comments: string[];
}

// ============================================================================
// ANALYZER DEFINITIONS (FULL-TEXT SEARCH)
// ============================================================================

/**
 * Definition for a SurrealDB text analyzer.
 *
 * Analyzers process text for full-text search indexes, defining how text
 * is tokenized and filtered for search operations.
 */
export interface SurrealAnalyzer {
  /** The analyzer name */
  name: string;
  /** Array of tokenizer names (e.g., ['camel', 'class', 'blank']) */
  tokenizers: string[];
  /** Array of filter names (e.g., ['ascii', 'snowball(english)']) */
  filters: string[];
  /** Array of comments for documentation */
  comments: string[];
}

// ============================================================================
// SCHEMA DEFINITIONS
// ============================================================================

/**
 * Complete SurrealDB database schema definition.
 *
 * This is the top-level interface that represents an entire database schema,
 * including all tables, relations, functions, scopes, analyzers, and associated
 * metadata. This structure is used throughout the migration system for schema
 * comparisons and generation.
 */
export interface SurrealDBSchema {
  /** Array of table definitions in the schema */
  tables: SurrealTable[];
  /** Array of relation definitions in the schema */
  relations: SurrealRelation[];
  /** Array of function definitions in the schema */
  functions: SurrealFunction[];
  /** Array of scope definitions in the schema */
  scopes: SurrealScope[];
  /** Array of analyzer definitions in the schema */
  analyzers: SurrealAnalyzer[];
  /** Array of param definitions in the schema */
  params?: SurrealParam[];
  /** Array of sequence definitions in the schema */
  sequences?: SurrealSequence[];
  /** Array of schema-level comments for documentation */
  comments: string[];
}

/**
 * Definition for a SurrealDB param.
 */
export interface SurrealParam {
  /** The param name (without $ prefix) */
  name: string;
  /** The param value expression */
  value: string;
  /** Optional comment */
  comment?: string;
  /** Previous names for rename detection */
  previousNames?: string[];
}

/**
 * Definition for a SurrealDB sequence.
 */
export interface SurrealSequence {
  /** The sequence name */
  name: string;
  /** Starting value */
  start?: number;
  /** Documentation comments */
  comments?: string[];
  /** Previous names for rename detection */
  previousNames?: string[];
}

// ============================================================================
// MIGRATION TYPES
// ============================================================================

/**
 * Represents a database migration with its metadata and SQL content.
 *
 * Migrations track changes to the database schema over time, allowing for
 * version control and rollback capabilities. Each migration contains both
 * forward (up) and backward (down) SQL scripts.
 */
export interface Migration {
  /** Unique identifier for the migration (auto-generated by SurrealDB) */
  id: string;
  /** Timestamp when the migration was applied */
  appliedAt: Date;
  /** Forward migration SQL (applies changes) */
  up: string;
  /** Backward migration SQL (reverts changes) */
  down: string;
  /** Checksum of the up migration content with algorithm prefix (e.g., "sha256.abc123...") */
  checksum: string;
  /** Checksum of the down migration content with algorithm prefix (e.g., "sha256.def456...") */
  downChecksum: string;
}

/**
 * Represents the current migration status of the database.
 *
 * This interface is used to track whether migrations have been applied
 * and to provide information about the most recent migration.
 */
export interface MigrationStatus {
  /** Whether any migrations have been applied to the database */
  applied: boolean;
  /** The most recent migration applied, if any */
  migration?: Migration;
}

// ============================================================================
// DATABASE CONFIGURATION
// ============================================================================

/**
 * Configuration object for connecting to a SurrealDB database.
 *
 * This interface defines all the necessary connection parameters required
 * to establish a connection to a SurrealDB instance, including authentication
 * credentials and database selection.
 */
export interface DatabaseConfig {
  /** The SurrealDB server URL (e.g., 'ws://localhost:8000') */
  url: string;
  /** The database namespace to use */
  namespace: string;
  /** The specific database within the namespace */
  database: string;
  /** Username for authentication */
  username: string;
  /** Password for authentication */
  password: string;
  /** Path to the schema file */
  schema: string;
}

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

/**
 * Zod validation schema for database configuration objects.
 *
 * This schema ensures that database configuration objects contain all required
 * fields with appropriate types and constraints, providing runtime validation
 * for configuration data.
 */
export const DatabaseConfigSchema = z.object({
  url: z.string().url(),
  namespace: z.string().min(1),
  database: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
});

/** Zod validation schema for migration objects */
export const MigrationSchema = z.object({
  id: z.string(),
  appliedAt: z.date(),
  up: z.string(),
  down: z.string(),
  message: z.string().optional(),
  checksum: z.string(),
  downChecksum: z.string(),
});

/** Zod validation schema for complete SurrealDB schema objects */
export const SurrealDBSchemaSchema = z.object({
  tables: z.array(
    z.object({
      name: z.string(),
      schemafull: z.boolean(),
      fields: z.array(
        z.object({
          name: z.string(),
          type: z.string(),
          optional: z.boolean(),
          default: z.unknown(),
          value: z.string().nullable(),
          assert: z.string().nullable(),
          permissions: z.string().nullable(),
          comments: z.array(z.string()),
        }),
      ),
      indexes: z.array(
        z.object({
          name: z.string(),
          columns: z.array(z.string()),
          unique: z.boolean(),
          type: z.enum(['BTREE', 'HASH', 'SEARCH', 'MTREE']),
          analyzer: z.string().nullable(),
          highlights: z.boolean(),
          comments: z.array(z.string()),
        }),
      ),
      events: z.array(
        z.object({
          name: z.string(),
          type: z.enum(['CREATE', 'UPDATE', 'DELETE']),
          when: z.string().nullable(),
          thenStatement: z.string().nullable(),
          comments: z.array(z.string()),
        }),
      ),
      comments: z.array(z.string()),
    }),
  ),
  relations: z.array(
    z.object({
      name: z.string(),
      from: z.string(),
      to: z.string(),
      fields: z.array(
        z.object({
          name: z.string(),
          type: z.string(),
          optional: z.boolean(),
          default: z.unknown(),
          value: z.string().nullable(),
          assert: z.string().nullable(),
          permissions: z.string().nullable(),
          comments: z.array(z.string()),
        }),
      ),
      indexes: z.array(
        z.object({
          name: z.string(),
          columns: z.array(z.string()),
          unique: z.boolean(),
          type: z.enum(['BTREE', 'HASH', 'SEARCH', 'MTREE']),
          analyzer: z.string().nullable(),
          highlights: z.boolean(),
          comments: z.array(z.string()),
        }),
      ),
      events: z.array(
        z.object({
          name: z.string(),
          type: z.enum(['CREATE', 'UPDATE', 'DELETE']),
          when: z.string().nullable(),
          thenStatement: z.string().nullable(),
          comments: z.array(z.string()),
        }),
      ),
      comments: z.array(z.string()),
    }),
  ),
  functions: z.array(
    z.object({
      name: z.string(),
      parameters: z.array(
        z.object({
          name: z.string(),
          type: z.string(),
        }),
      ),
      returnType: z.string().nullable(),
      body: z.string(),
      comments: z.array(z.string()),
    }),
  ),
  scopes: z.array(
    z.object({
      name: z.string(),
      session: z.string().nullable(),
      signup: z.string().nullable(),
      signin: z.string().nullable(),
      comments: z.array(z.string()),
    }),
  ),
  analyzers: z.array(
    z.object({
      name: z.string(),
      tokenizers: z.array(z.string()),
      filters: z.array(z.string()),
      comments: z.array(z.string()),
    }),
  ),
  comments: z.array(z.string()),
});
