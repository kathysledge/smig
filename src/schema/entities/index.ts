/**
 * @fileoverview Entity exports for SurrealDB schema definition.
 * @module schema/entities
 */

export { type AccessType, type JwtAlgorithm, SurrealQLAccess, SurrealQLScope } from './access';
export { SurrealQLAnalyzer } from './analyzer';
export { type ConfigType, type GraphQLTableMode, SurrealQLConfig } from './config';
export { SurrealQLEvent } from './event';
export { SurrealQLFunction } from './function';
export { SurrealQLModel } from './model';
export { SurrealQLParam } from './param';
export { SurrealQLSequence } from './sequence';
export {
  defineRelation,
  defineSchema,
  SurrealQLTable,
  type TableConfig,
  type TableSchema,
  type TableType,
} from './table';
export { SurrealQLUser, type UserRole } from './user';
