/**
 * @fileoverview Complex field type builders for SurrealDB.
 * @module schema/fields/complex
 */

import { processSurrealQL } from '../common/utils';
import { type FieldBuilderState, SurrealQLFieldBase } from './base';

/**
 * Interface for objects that have a build() method returning field definitions.
 */
interface Buildable {
  build(): FieldBuilderState | Record<string, unknown>;
}

/**
 * Internal structure for simple field builder state (used by SurrealQLAny, SurrealQLArray, SurrealQLSet).
 */
interface SimpleFieldState {
  type: string;
  optional: boolean;
  default: unknown;
  value: string | null;
  assert: string | null;
  assertConditions: string[];
  comments: string[];
  previousNames: string[];
}

/**
 * Option field type builder for SurrealDB.
 *
 * Creates option fields that can contain a value of a specific type or be null.
 * Similar to Rust's Option type or TypeScript's union with null.
 *
 * @example
 * ```typescript
 * // Optional string value
 * const message = option('string');
 *
 * // Optional number with default null
 * const score = option('int').default(null);
 *
 * // Optional record reference
 * const author = option('record<user>');
 *
 * // Untyped option (legacy)
 * const dynamicField = option();
 * ```
 */
export class SurrealQLOption extends SurrealQLFieldBase {
  constructor(type?: string | Buildable) {
    super();
    // Mark as optional since this is an option<T> type
    this.field.optional = true;
    if (!type) {
      this.field.type = 'option';
    } else if (typeof type === 'object' && type !== null && typeof type.build === 'function') {
      // If type is a builder object, call build() to get the type string
      const built = type.build();
      this.field.type = `option<${built.type}>`;
    } else {
      this.field.type = `option<${type}>`;
    }
  }
}

/**
 * Any field type builder for SurrealDB.
 *
 * Creates fields that can store values of any type. Provides maximum flexibility
 * but less type safety. Use when the field type varies or is unknown at design time.
 *
 * @example
 * ```typescript
 * // Dynamic content field
 * const content = option('any');
 *
 * // Flexible data with validation
 * const flexibleData = any()
 *   .assert('$value != NONE')
 *   .required();
 * ```
 */
export class SurrealQLAny {
  private field: SimpleFieldState = {
    type: 'any',
    optional: false,
    default: null,
    value: null,
    assert: null,
    assertConditions: [], // Stack of assertion conditions
    comments: [],
    previousNames: [],
  };

  default(value: unknown) {
    this.field.default = value;
    return this;
  }
  value(expression: string) {
    this.field.value = processSurrealQL(expression);
    return this;
  }
  computed(expression: string) {
    const processed = processSurrealQL(expression);
    // SurrealDB v3 uses { } for deferred evaluation instead of <future> { }
    this.field.value = `{ ${processed} }`;
    return this;
  }
  assert(condition: string) {
    const processedCondition = processSurrealQL(condition);
    this.field.assertConditions.push(processedCondition);
    this.updateCombinedAssert();
    return this;
  }

  private updateCombinedAssert() {
    if (this.field.assertConditions.length === 0) {
      this.field.assert = null;
    } else if (this.field.assertConditions.length === 1) {
      this.field.assert = this.field.assertConditions[0];
    } else {
      this.field.assert = this.field.assertConditions
        .map((condition) => `(${condition})`)
        .join(' AND ');
    }
  }

  comment(text: string) {
    this.field.comments.push(text);
    return this;
  }

  was(names: string | string[]) {
    const nameArray = Array.isArray(names) ? names : [names];
    this.field.previousNames.push(...nameArray);
    return this;
  }

  build() {
    return this.field;
  }
}

/**
 * Array field type builder for SurrealDB.
 *
 * Creates array fields that store collections of values of a specified type.
 * Supports type-safe array definitions with validation and constraints.
 *
 * @example
 * ```typescript
 * // Array of strings
 * const tags = array('string').default([]);
 *
 * // Array of numbers with validation
 * const scores = array('int')
 *   .assert('array::len($value) <= 10')
 *   .required();
 *
 * // Array of records
 * const authorIds = option('array<record<user>>');
 *
 * // Array with min/max length (SurrealDB 3.x)
 * const limitedTags = array('string', 1, 10);
 * ```
 */
export class SurrealQLArray<T extends string> {
  private field: SimpleFieldState = {
    type: 'array',
    optional: false,
    default: null,
    value: null,
    assert: null,
    assertConditions: [], // Stack of assertion conditions
    comments: [],
    previousNames: [],
  };

  constructor(type: T | Buildable, minLength?: number, maxLength?: number) {
    // If type is an object with a build() method, call it to get the type string
    let typeStr: string;
    if (typeof type === 'object' && type !== null && typeof type.build === 'function') {
      const built = type.build();
      typeStr = (built as { type: string }).type;
    } else {
      typeStr = type as string;
    }

    // Handle array with length constraints (SurrealDB 3.x feature)
    if (minLength !== undefined && maxLength !== undefined) {
      this.field.type = `array<${typeStr}, ${minLength}, ${maxLength}>`;
    } else if (minLength !== undefined) {
      this.field.type = `array<${typeStr}, ${minLength}>`;
    } else {
      this.field.type = `array<${typeStr}>`;
    }
  }

  default(value: unknown[]) {
    this.field.default = value;
    return this;
  }
  value(expression: string) {
    this.field.value = processSurrealQL(expression);
    return this;
  }
  assert(condition: string) {
    const processedCondition = processSurrealQL(condition);
    this.field.assertConditions.push(processedCondition);
    this.updateCombinedAssert();
    return this;
  }

  private updateCombinedAssert() {
    if (this.field.assertConditions.length === 0) {
      this.field.assert = null;
    } else if (this.field.assertConditions.length === 1) {
      this.field.assert = this.field.assertConditions[0];
    } else {
      this.field.assert = this.field.assertConditions
        .map((condition) => `(${condition})`)
        .join(' AND ');
    }
  }

  comment(text: string) {
    this.field.comments.push(text);
    return this;
  }

  was(names: string | string[]) {
    const nameArray = Array.isArray(names) ? names : [names];
    this.field.previousNames.push(...nameArray);
    return this;
  }

  build() {
    return this.field;
  }
}

/**
 * Record field type builder for SurrealDB table relationships.
 *
 * Creates a reference to records in another table, establishing relationships
 * between tables in the database schema. Supports single tables, union types,
 * and generic record types.
 *
 * @example
 * ```typescript
 * // Single table reference
 * const author = record('user').required();
 * const category = option('record<category>');
 *
 * // Union type (multiple possible tables)
 * const context = record(['post', 'comment', 'user']);
 *
 * // Generic record (any table)
 * const subject = record();
 * ```
 */
export class SurrealQLRecord extends SurrealQLFieldBase {
  constructor(tableName?: string | string[]) {
    super();
    if (!tableName) {
      // Generic record type (no specific table)
      this.field.type = 'record';
    } else if (Array.isArray(tableName)) {
      // Union type (multiple tables)
      const tables = tableName.map((t) => t.toLowerCase()).join(' | ');
      this.field.type = `record<${tables}>`;
    } else {
      // Single table reference
      this.field.type = `record<${tableName.toLowerCase()}>`;
    }
  }
}

/**
 * Set field type builder for SurrealDB.
 *
 * Creates set fields that store unique collections of values.
 * Similar to arrays but with uniqueness constraint.
 * SurrealDB 3.x feature.
 *
 * @example
 * ```typescript
 * const uniqueTags = set('string');
 * ```
 */
export class SurrealQLSet<T extends string> {
  private field: SimpleFieldState = {
    type: 'set',
    optional: false,
    default: null,
    value: null,
    assert: null,
    assertConditions: [],
    comments: [],
    previousNames: [],
  };

  constructor(type: T | Buildable, minLength?: number, maxLength?: number) {
    let typeStr: string;
    if (typeof type === 'object' && type !== null && typeof type.build === 'function') {
      const built = type.build();
      typeStr = (built as { type: string }).type;
    } else {
      typeStr = type as string;
    }

    if (minLength !== undefined && maxLength !== undefined) {
      this.field.type = `set<${typeStr}, ${minLength}, ${maxLength}>`;
    } else if (minLength !== undefined) {
      this.field.type = `set<${typeStr}, ${minLength}>`;
    } else {
      this.field.type = `set<${typeStr}>`;
    }
  }

  default(value: unknown[]) {
    this.field.default = value;
    return this;
  }
  value(expression: string) {
    this.field.value = processSurrealQL(expression);
    return this;
  }
  assert(condition: string) {
    const processedCondition = processSurrealQL(condition);
    this.field.assertConditions.push(processedCondition);
    this.updateCombinedAssert();
    return this;
  }

  private updateCombinedAssert() {
    if (this.field.assertConditions.length === 0) {
      this.field.assert = null;
    } else if (this.field.assertConditions.length === 1) {
      this.field.assert = this.field.assertConditions[0];
    } else {
      this.field.assert = this.field.assertConditions
        .map((condition) => `(${condition})`)
        .join(' AND ');
    }
  }

  comment(text: string) {
    this.field.comments.push(text);
    return this;
  }

  was(names: string | string[]) {
    const nameArray = Array.isArray(names) ? names : [names];
    this.field.previousNames.push(...nameArray);
    return this;
  }

  build() {
    return this.field;
  }
}
