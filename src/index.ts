/**
 * @fileoverview Main entry point for the SurrealDB Migration Library (smig).
 *
 * This is the primary module that exports all public APIs for the smig library,
 * providing a comprehensive solution for SurrealDB schema management and database
 * migrations. The library combines type-safe schema definition, automatic migration
 * generation, and robust database connection management.
 *
 * ## Library Overview
 *
 * Smig is designed to solve the challenges of database schema evolution in SurrealDB
 * applications. It provides a declarative approach to schema definition using a
 * fluent TypeScript API, automatically generates migration scripts by comparing
 * schemas, and manages the application of those migrations to ensure data consistency.
 *
 * ## Key Features
 *
 * - **Type-safe schema definition**: Define schemas using a fluent TypeScript API
 * - **Automatic migration generation**: Compare schemas and generate only necessary changes
 * - **Schema introspection**: Read and analyze existing database schemas
 * - **Migration tracking**: Track applied migrations with checksums and rollback support
 * - **CLI integration**: Command-line tools for development and deployment workflows
 * - **Graph relations**: Full support for SurrealDB's graph database features
 * - **Flexible field types**: Support for all SurrealDB data types and constraints
 * - **Performance optimization**: Automatic index management and query optimization
 *
 * ## Quick Start Example
 *
 * ```typescript
 * import { MigrationManager, defineSchema, string, int, datetime, bool, option, index } from 'smig';
 *
 * // Define a user table schema (SurrealDB auto-generates IDs)
 * const userSchema = defineSchema({
 *   table: 'user',
 *   fields: {
 *     email: string()
 *       .assert('$value ~ /^[^@]+@[^@]+\\\\.[^@]+$/')
 *       .unique(),
 *     name: string().required(),
 *     age: option('int')
 *       .assert('$value >= 0')
 *       .assert('$value <= 150'),
 *     createdAt: datetime().value('time::now()'),
 *     isActive: bool().default(true)
 *   },
 *   indexes: {
 *     email: index(['email']).unique(),
 *     active_users: index(['isActive', 'createdAt'])
 *   }
 * });
 *
 * // Set up migration manager
 * const manager = new MigrationManager({
 *   url: 'ws://localhost:8000',
 *   namespace: 'production',
 *   database: 'app',
 *   username: 'admin',
 *   password: 'secure-password'
 * });
 *
 * // Apply migrations
 * await manager.initialize();
 * await manager.migrate(userSchema);
 * await manager.close();
 * ```
 *
 * ## Schema Composition
 *
 * For complex applications, compose multiple schemas with relations:
 *
 * ```typescript
 * import { composeSchema, defineRelation } from 'smig';
 *
 * const postSchema = defineSchema({
 *   table: 'post',
 *   fields: {
 *     title: string().required(),
 *     content: string().required(),
 *     authorId: string().required()
 *   }
 * });
 *
 * const authorRelation = defineRelation({
 *   name: 'authored',
 *   from: 'user',
 *   to: 'post'
 * });
 *
 * const fullSchema = composeSchema({
 *   models: { user: userSchema, post: postSchema },
 *   relations: { authored: authorRelation }
 * });
 * ```
 *
 * ## Core Architecture
 *
 * - **MigrationManager**: Central controller for all migration operations
 * - **SurrealClient**: Low-level database connection and query execution
 * - **Schema builders**: Fluent API classes for defining database structures
 * - **Type system**: Comprehensive TypeScript definitions for type safety
 * - **CLI Tools**: Command-line interface for development and deployment
 *
 * @module smig
 * @version 0.1.2
 * @author Chris Harris
 * @license MIT
 */

// ============================================================================
// CORE MIGRATION SYSTEM
// ============================================================================

/** Low-level database client for direct SurrealDB operations */
export { SurrealClient } from "./database/surreal-client";
/** Main migration management and schema loading functionality */
export { loadSchemaFromFile, MigrationManager } from "./migrator/migration-manager";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** TypeScript type definitions for schema structures and migration management */
export type {
  DatabaseConfig,
  Migration,
  MigrationStatus,
  SurrealDBSchema,
  SurrealEvent,
  SurrealField,
  SurrealIndex,
  SurrealRelation,
  SurrealTable,
} from "./types/schema";

// ============================================================================
// SCHEMA DEFINITION API
// ============================================================================

/**
 * Schema builders, field types, and composition utilities.
 * This is the primary API for defining database schemas.
 */
export {
  analyzer,
  any,
  array,
  bool,
  commonEvents as ce,
  // Common patterns with descriptive aliases
  commonFields as cf,
  commonIndexes as ci,
  composeSchema,
  datetime,
  decimal,
  defineRelation,
  // Schema composition functions
  defineSchema,
  duration,
  event,
  float,
  // New builders
  fn,
  geometry,
  // Schema element builders
  index,
  int,
  object,
  option,
  record,
  scope,
  // Field type builders
  string,
  uuid,
} from "./schema/concise-schema";
