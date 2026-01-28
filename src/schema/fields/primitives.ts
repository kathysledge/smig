/**
 * @fileoverview Primitive field type builders for SurrealDB.
 * @module schema/fields/primitives
 */

import { SurrealQLFieldBase } from './base';

/**
 * String field type builder for SurrealDB.
 *
 * Creates string fields with validation and constraint support. Use the assert()
 * method for custom validation patterns like email, URL, or length constraints.
 *
 * @example
 * ```typescript
 * // Basic string field
 * const name = string().required();
 *
 * // Email validation
 * const email = string()
 *   .assert('string::is_email($value)')
 *   .comment('User email address');
 *
 * // Length-constrained string
 * const title = string()
 *   .assert('string::len($value) >= 1')
 *   .assert('string::len($value) <= 200')
 *   .required();
 * ```
 */
export class SurrealQLString extends SurrealQLFieldBase {
  constructor() {
    super();
    this.field.type = 'string';
  }
}

/**
 * Integer field type builder for SurrealDB.
 *
 * Creates integer fields with numeric validation support. Use the assert()
 * method for range validation and other numeric constraints.
 *
 * @example
 * ```typescript
 * // Basic integer field
 * const count = int().default(0);
 *
 * // Age with range validation
 * const age = int()
 *   .assert('$value >= 0')
 *   .assert('$value <= 150');
 * ```
 */
export class SurrealQLInt extends SurrealQLFieldBase {
  constructor() {
    super();
    this.field.type = 'int';
  }
}

/**
 * Float field type builder for SurrealDB.
 *
 * Creates floating-point number fields with decimal precision. Use the assert()
 * method for range validation and precision constraints.
 *
 * @example
 * ```typescript
 * // Basic float field
 * const price = float().default(0.0);
 *
 * // Price with range validation
 * const score = float()
 *   .assert('$value >= 0.0')
 *   .assert('$value <= 100.0')
 *   .required();
 * ```
 */
export class SurrealQLFloat extends SurrealQLFieldBase {
  constructor() {
    super();
    this.field.type = 'float';
  }
}

/**
 * Boolean field type builder for SurrealDB.
 *
 * @example
 * ```typescript
 * const isActive = bool().default(true);
 * ```
 */
export class SurrealQLBool extends SurrealQLFieldBase {
  constructor() {
    super();
    this.field.type = 'bool';
  }
}

/**
 * Datetime field type builder for SurrealDB.
 *
 * @example
 * ```typescript
 * const createdAt = datetime().value('time::now()');
 * ```
 */
export class SurrealQLDatetime extends SurrealQLFieldBase {
  constructor() {
    super();
    this.field.type = 'datetime';
  }
}

/**
 * Decimal field type builder for SurrealDB.
 *
 * Creates high-precision decimal fields for financial calculations and scenarios
 * requiring exact decimal representation. Use the assert() method for validation.
 *
 * @example
 * ```typescript
 * // Financial decimal field
 * const amount = decimal().assert('$value >= 0').required();
 *
 * // Percentage with precision
 * const rate = decimal()
 *   .assert('$value >= 0.0')
 *   .assert('$value <= 1.0')
 *   .default(0.0);
 * ```
 */
export class SurrealQLDecimal extends SurrealQLFieldBase {
  constructor() {
    super();
    this.field.type = 'decimal';
  }
}

/**
 * SurrealDB UUID field type for universally unique identifiers.
 *
 * Provides native UUID support with automatic generation and validation.
 * UUIDs are 128-bit identifiers that are guaranteed to be unique across
 * space and time without requiring a central authority.
 */
export class SurrealQLUuid extends SurrealQLFieldBase {
  constructor() {
    super();
    this.field.type = 'uuid';
  }
}

/**
 * Duration field type builder for SurrealDB.
 *
 * Creates duration fields for time intervals and time-based calculations.
 * Supports SurrealDB’s duration format (e.g., '1h', '30m', '45s').
 *
 * @example
 * ```typescript
 * // Timeout duration
 * const timeout = duration().default('30s');
 *
 * // Session duration with validation
 * const sessionDuration = duration()
 *   .assert('$value >= 1m')
 *   .assert('$value <= 24h')
 *   .default('1h');
 * ```
 */
export class SurrealQLDuration extends SurrealQLFieldBase {
  constructor() {
    super();
    this.field.type = 'duration';
  }
}

/**
 * Object field type builder for SurrealDB.
 *
 * Creates object fields for storing structured JSON-like data.
 * Perfect for nested data, metadata, and flexible document storage.
 *
 * @example
 * ```typescript
 * // User preferences object
 * const preferences = option('object');
 *
 * // Configuration with default
 * const config = object().default('{}');
 *
 * // Required metadata
 * const metadata = object().required();
 * ```
 */
export class SurrealQLObject extends SurrealQLFieldBase {
  constructor() {
    super();
    this.field.type = 'object';
  }
}

/**
 * Valid geometry subtypes supported by SurrealDB.
 */
export type GeometryType =
  | 'point'
  | 'line'
  | 'polygon'
  | 'multipoint'
  | 'multiline'
  | 'multipolygon'
  | 'collection';

/**
 * Geometry field type builder for SurrealDB.
 *
 * Creates geometry fields for storing spatial data, coordinates, and geographic
 * information. Supports GeoJSON format and spatial operations. Can specify
 * a specific geometry subtype for type safety.
 *
 * @example
 * ```typescript
 * // Generic geometry field (any geometry type)
 * const location = geometry();
 *
 * // Specific point geometry
 * const coordinates = geometry('point').required();
 *
 * // Polygon for boundaries
 * const boundary = geometry('polygon').comment('Geographic boundary');
 *
 * // Line for routes/paths
 * const route = geometry('line');
 *
 * // Multi-point for multiple locations
 * const waypoints = geometry('multipoint');
 * ```
 */
export class SurrealQLGeometry extends SurrealQLFieldBase {
  constructor(geometryType?: GeometryType) {
    super();
    this.field.type = geometryType ? `geometry<${geometryType}>` : 'geometry';
  }
}

/**
 * Bytes field type builder for SurrealDB.
 *
 * Creates bytes fields for storing binary data.
 * SurrealDB 3.x feature.
 *
 * @example
 * ```typescript
 * const avatar = bytes().comment('User avatar binary data');
 * ```
 */
export class SurrealQLBytes extends SurrealQLFieldBase {
  constructor() {
    super();
    this.field.type = 'bytes';
  }
}

/**
 * Number field type builder for SurrealDB.
 *
 * Creates number fields that can hold any numeric type (int, float, decimal).
 *
 * @example
 * ```typescript
 * const value = number().default(0);
 * ```
 */
export class SurrealQLNumber extends SurrealQLFieldBase {
  constructor() {
    super();
    this.field.type = 'number';
  }
}

/**
 * Null field type builder for SurrealDB.
 *
 * Creates null fields (rarely used directly, mainly for union types).
 */
export class SurrealQLNull extends SurrealQLFieldBase {
  constructor() {
    super();
    this.field.type = 'null';
  }
}

/**
 * Literal field type builder for SurrealDB.
 *
 * Creates literal type fields that only accept specific values.
 * SurrealDB 3.x feature.
 *
 * @example
 * ```typescript
 * // Only accepts 'active', 'pending', or 'inactive'
 * const status = literal('active', 'pending', 'inactive');
 * ```
 */
export class SurrealQLLiteral extends SurrealQLFieldBase {
  constructor(...values: (string | number | boolean)[]) {
    super();
    const formatted = values.map((v) => (typeof v === 'string' ? `"${v}"` : String(v)));
    this.field.type = formatted.join(' | ');
  }
}

/**
 * Range field type builder for SurrealDB.
 *
 * Creates range fields that hold a range of values.
 * SurrealDB 3.x feature.
 *
 * @example
 * ```typescript
 * const dateRange = range('datetime');
 * ```
 */
export class SurrealQLRange extends SurrealQLFieldBase {
  constructor(elementType?: string) {
    super();
    this.field.type = elementType ? `range<${elementType}>` : 'range';
  }
}
