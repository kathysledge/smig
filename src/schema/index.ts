/**
 * @fileoverview Main schema module exports.
 * @module schema
 *
 * This module provides a comprehensive TypeScript API for defining SurrealDB database
 * schemas using a fluent, builder-pattern approach.
 */

// Common utilities
export { processSurrealQL, validateFunctionName, validateIdentifier } from './common';
// Composition
export {
  composeSchema,
  type SurrealDBModel,
  type SurrealDBRelation,
  type SurrealDBSchema,
} from './compose';
// Entity types
export {
  type AccessType,
  type ConfigType,
  defineRelation,
  defineSchema,
  type GraphQLTableMode,
  type JwtAlgorithm,
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
  type TableConfig,
  type TableSchema,
  type TableType,
  type UserRole,
} from './entities';
// Factory functions and patterns
export {
  access,
  analyzer,
  any,
  array,
  bool,
  bytes,
  ce,
  cf,
  ci,
  commonEvents,
  // Common patterns
  commonFields,
  commonIndexes,
  config,
  datetime,
  decimal,
  duration,
  // Entity factories
  event,
  float,
  fn,
  geometry,
  // Index factory
  index,
  int,
  literal,
  model,
  nullType,
  number,
  object,
  option,
  param,
  range,
  record,
  scope,
  sequence,
  set,
  // Field factories
  string,
  table,
  user,
  uuid,
} from './factories';
// Field types
export {
  type FieldTrackingConfig,
  SurrealQLAny,
  SurrealQLArray,
  SurrealQLBool,
  SurrealQLBytes,
  SurrealQLDatetime,
  SurrealQLDecimal,
  SurrealQLDuration,
  SurrealQLFieldBase,
  SurrealQLFloat,
  SurrealQLGeometry,
  SurrealQLInt,
  SurrealQLLiteral,
  SurrealQLNull,
  SurrealQLNumber,
  SurrealQLObject,
  // Complex
  SurrealQLOption,
  SurrealQLRange,
  SurrealQLRecord,
  SurrealQLSet,
  // Primitives
  SurrealQLString,
  SurrealQLUuid,
} from './fields';
// Index types
export { type DistanceMetric, type IndexType, SurrealQLIndex } from './indexes';
