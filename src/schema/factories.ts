/**
 * @fileoverview Factory functions for creating schema elements.
 * @module schema/factories
 */

// Entity factories
import {
  type ConfigType,
  SurrealQLAccess,
  SurrealQLAnalyzer,
  SurrealQLConfig,
  SurrealQLEvent,
  SurrealQLFunction,
  SurrealQLModel,
  SurrealQLParam,
  SurrealQLScope,
  SurrealQLSequence,
  SurrealQLTable,
  SurrealQLUser,
} from './entities';
// Field factories
import {
  SurrealQLAny,
  SurrealQLArray,
  SurrealQLBool,
  SurrealQLBytes,
  SurrealQLDatetime,
  SurrealQLDecimal,
  SurrealQLDuration,
  SurrealQLFloat,
  SurrealQLGeometry,
  SurrealQLInt,
  SurrealQLLiteral,
  SurrealQLNull,
  SurrealQLNumber,
  SurrealQLObject,
  SurrealQLOption,
  SurrealQLRange,
  SurrealQLRecord,
  SurrealQLSet,
  SurrealQLString,
  SurrealQLUuid,
} from './fields';
// Index factory
import { type DistanceMetric, type IndexType, SurrealQLIndex } from './indexes';

// ============================================================================
// FIELD FACTORY FUNCTIONS
// ============================================================================

/**
 * Creates a string field with validation support.
 */
export const string = () => new SurrealQLString();

/**
 * Creates an integer field.
 */
export const int = () => new SurrealQLInt();

/**
 * Creates a floating-point field.
 */
export const float = () => new SurrealQLFloat();

/**
 * Creates a boolean field.
 */
export const bool = () => new SurrealQLBool();

/**
 * Creates a datetime field.
 */
export const datetime = () => new SurrealQLDatetime();

/**
 * Creates a decimal field for precise numbers.
 */
export const decimal = () => new SurrealQLDecimal();

/**
 * Creates a UUID field.
 */
export const uuid = () => new SurrealQLUuid();

/**
 * Creates a duration field.
 */
export const duration = () => new SurrealQLDuration();

/**
 * Creates an object field.
 */
export const object = () => new SurrealQLObject();

/**
 * Creates a geometry field.
 */
export const geometry = () => new SurrealQLGeometry();

/**
 * Creates a bytes field for binary data.
 */
export const bytes = () => new SurrealQLBytes();

/**
 * Creates a number field (any numeric type).
 */
export const number = () => new SurrealQLNumber();

/**
 * Creates a null field.
 */
export const nullType = () => new SurrealQLNull();

/**
 * Creates a literal type field.
 *
 * @param values - Allowed literal values
 */
export const literal = (...values: (string | number | boolean)[]) =>
  new SurrealQLLiteral(...values);

/**
 * Creates a range field.
 *
 * @param elementType - Optional type of range elements
 */
export const range = (elementType?: string) => new SurrealQLRange(elementType);

/**
 * Creates an option field that can hold a value of the specified type or null.
 *
 * @param type - Optional type parameter (e.g., 'string', 'int', 'record<user>')
 */
export const option = (type?: string) => new SurrealQLOption(type);

/**
 * Creates an any-type field.
 */
export const any = () => new SurrealQLAny();

/**
 * Creates an array field with a specific element type.
 *
 * @param type - The type of elements in the array
 * @param minLength - Optional minimum length (SurrealDB 3.x)
 * @param maxLength - Optional maximum length (SurrealDB 3.x)
 */
export const array = <T extends string>(type: T, minLength?: number, maxLength?: number) =>
  new SurrealQLArray<T>(type, minLength, maxLength);

/**
 * Creates a record field for table relationships.
 *
 * @param tableName - Optional table name(s) to reference
 */
export const record = (tableName?: string | string[]) => new SurrealQLRecord(tableName);

/**
 * Creates a set field (unique array).
 *
 * @param type - The type of elements in the set
 * @param minLength - Optional minimum length
 * @param maxLength - Optional maximum length
 */
export const set = <T extends string>(type: T, minLength?: number, maxLength?: number) =>
  new SurrealQLSet<T>(type, minLength, maxLength);

// ============================================================================
// INDEX FACTORY FUNCTION
// ============================================================================

/**
 * Creates an index definition.
 *
 * @param columns - Array of column names to index
 */
export const index = (columns: string[]) => new SurrealQLIndex(columns);

// ============================================================================
// ENTITY FACTORY FUNCTIONS
// ============================================================================

/**
 * Creates an event definition.
 *
 * @param name - The name of the event
 */
export const event = (name: string) => new SurrealQLEvent(name);

/**
 * Creates a function definition.
 *
 * @param name - The name of the function (can include 'fn::' prefix)
 */
export const fn = (name: string) => new SurrealQLFunction(name);

/**
 * Creates an analyzer definition for full-text search.
 *
 * @param name - The name of the analyzer
 */
export const analyzer = (name: string) => new SurrealQLAnalyzer(name);

/**
 * Creates an access definition for authentication.
 *
 * @param name - The name of the access method
 */
export const access = (name: string) => new SurrealQLAccess(name);

/**
 * Creates a scope definition for authentication.
 *
 * @deprecated Use access() with .record() instead. SCOPE is deprecated in SurrealDB 3.x.
 * @param name - The name of the scope
 */
export const scope = (name: string) => new SurrealQLScope(name);

/**
 * Creates a parameter definition.
 *
 * @param name - The name of the parameter (with or without $ prefix)
 */
export const param = (name: string) => new SurrealQLParam(name);

/**
 * Creates a user definition.
 *
 * @param name - The name of the user
 */
export const user = (name: string) => new SurrealQLUser(name);

/**
 * Creates an ML model definition.
 *
 * @param name - The name of the model
 */
export const model = (name: string) => new SurrealQLModel(name);

/**
 * Creates a config definition (GraphQL/API).
 *
 * @param type - The config type ('GRAPHQL' or 'API')
 */
export const config = (type: ConfigType) => new SurrealQLConfig(type);

/**
 * Creates a sequence definition.
 *
 * @param name - The name of the sequence
 */
export const sequence = (name: string) => new SurrealQLSequence(name);

/**
 * Creates a table definition.
 *
 * @param name - The name of the table
 */
export const table = (name: string) => new SurrealQLTable(name);

// ============================================================================
// COMMON FIELD PATTERNS
// ============================================================================

export const commonFields = {
  /** Timestamp that defaults to current time */
  timestamp: () => datetime().value('time::now()'),
  /** Empty datetime field */
  emptyTimestamp: () => datetime(),
  /** Optional metadata object */
  metadata: () => option('object'),
  /** Reference to owner record */
  owner: (tableName: string = 'user') => record(tableName),
  /** UUID v7 that auto-generates on create */
  uuidV7: () => uuid().default('rand::uuid::v7()'),
  /** Created at timestamp (readonly) */
  createdAt: () => datetime().value('time::now()').readonly(),
  /** Updated at timestamp */
  updatedAt: () => datetime(),
  /** Soft delete flag */
  deletedAt: () => option('datetime'),
  /** Active flag with default true */
  isActive: () => bool().default(true),
};

// ============================================================================
// COMMON INDEX PATTERNS
// ============================================================================

export const commonIndexes = {
  /** Primary unique index on id */
  primary: (_tableName: string) => index(['id']).unique(),
  /** Index on createdAt for sorting */
  createdAt: (_tableName: string) => index(['createdAt']),
  /** Index on updatedAt for sorting */
  updatedAt: (_tableName: string) => index(['updatedAt']),
  /** Full-text search index with English analyzer */
  contentSearch: (_tableName: string) =>
    index(['content']).search().analyzer('english').highlights(),
  /** Unique email index */
  email: (_tableName: string) => index(['email']).unique(),
  /** Vector index for embeddings */
  embedding: (dimension: number = 384, metric: DistanceMetric = 'COSINE') =>
    index(['embedding']).hnsw().dimension(dimension).dist(metric),
};

// ============================================================================
// COMMON EVENT PATTERNS
// ============================================================================

export const commonEvents = {
  /** Update timestamp on record modification */
  updateTimestamp: (tableName: string) =>
    event(`${tableName}_update_timestamp`).onUpdate().thenDo('SET updatedAt = time::now()'),
  /** Cascade delete related records */
  cascadeDelete: (tableName: string, relatedTable: string, foreignKey: string) =>
    event(`${tableName}_cascade_delete`)
      .onDelete()
      .thenDo(`DELETE ${relatedTable} WHERE ${foreignKey} = $value.id`),
};

// ============================================================================
// CONVENIENCE ALIASES
// ============================================================================

/** Shorthand alias for commonFields */
export const cf = commonFields;
/** Shorthand alias for commonIndexes */
export const ci = commonIndexes;
/** Shorthand alias for commonEvents */
export const ce = commonEvents;

// Re-export types
export type { DistanceMetric, IndexType };
