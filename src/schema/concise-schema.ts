/**
 * @fileoverview Concise SurrealDB schema definition system with fluent API.
 * @module schema
 *
 * This module provides a comprehensive TypeScript API for defining SurrealDB database
 * schemas using a fluent, builder-pattern approach. It allows developers to define
 * tables, fields, indexes, events, and relations in a type-safe and intuitive way,
 * while automatically generating the corresponding SurrealQL definitions.
 *
 * ## Key Features
 *
 * - **Fluent API**: Method chaining for intuitive schema definition
 * - **Type safety**: Full TypeScript support with comprehensive type checking
 * - **Field types**: Support for all SurrealDB field types with validation
 * - **Indexes**: Support for all index types (BTREE, HASH, SEARCH, MTREE, HNSW)
 * - **Events**: Database triggers for CREATE, UPDATE, DELETE operations
 * - **Relations**: Graph edge definitions with automatic in/out fields
 * - **Common patterns**: Pre-built field, index, and event patterns
 * - **Schema composition**: Combine multiple models into complete schemas
 *
 * ## Basic Usage
 *
 * ```typescript
 * import { defineSchema, string, int, index } from 'smig';
 *
 * const userSchema = defineSchema({
 *   table: 'user',
 *   fields: {
 *     id_uuid: uuid().default('rand::uuid::v7()'),
 *     name: string().required(),
 *     age: option('int')
 *   },
 *   indexes: {
 *     primary: index(['id']).unique()
 *   }
 * });
 * ```
 *
 * ## Advanced Features
 *
 * ```typescript
 * // Define relations
 * const likeRelation = defineRelation({
 *   name: 'like',
 *   from: 'user',
 *   to: 'post',
 *   fields: {
 *     strength: int().default(1)
 *   }
 * });
 *
 * // Compose complete schema
 * const schema = composeSchema({
 *   models: { userSchema, postSchema },
 *   relations: { likeRelation }
 * });
 * ```
 *
 * @deprecated This file is maintained for backwards compatibility.
 * Import from 'smig' or 'smig/schema' directly for the new modular API.
 */

// Re-export everything from the new modular structure
export * from './index';
