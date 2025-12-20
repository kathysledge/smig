/**
 * @fileoverview Field type exports for SurrealDB schema definition.
 * @module schema/fields
 */

// Base class
export { type FieldTrackingConfig, SurrealQLFieldBase } from './base';
// Complex types
export {
  SurrealQLAny,
  SurrealQLArray,
  SurrealQLOption,
  SurrealQLRecord,
  SurrealQLSet,
} from './complex';
// Primitive types
export {
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
  SurrealQLRange,
  SurrealQLString,
  SurrealQLUuid,
} from './primitives';
