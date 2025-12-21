/**
 * @fileoverview Base class for SurrealDB field types.
 * @module schema/fields/base
 */

import { processSurrealQL } from '../common/utils';

/**
 * Configuration object for field tracking of renamed fields.
 */
export interface FieldTrackingConfig {
  /** Previous name(s) this field was known as (for ALTER FIELD RENAME) */
  previousNames?: string[];
}

/**
 * Internal structure for field builder state.
 */
export interface FieldBuilderState {
  type: string;
  optional: boolean;
  readonly: boolean;
  flexible: boolean;
  ifNotExists: boolean;
  overwrite: boolean;
  default: unknown;
  value: string | null;
  assert: string | null;
  assertConditions: string[];
  permissions: string | null;
  comment: string | null;
  comments: string[];
  previousNames: string[];
  reference: string | null;
  onDelete: string | null;
  defaultAlways: boolean;
}

/**
 * Base class for all SurrealDB field types.
 *
 * This abstract base class provides the foundation for all SurrealDB field type definitions,
 * offering common properties and modifiers that are available across all field types.
 * The class uses a fluent builder pattern, allowing for intuitive method chaining when
 * defining field characteristics and constraints.
 *
 * ## Field Properties
 *
 * - `type` - The SurrealDB field type (string, int, bool, etc.)
 * - `optional` - Whether the field can be omitted from records
 * - `readonly` - Whether the field is read-only after creation
 * - `flexible` - Whether the field accepts dynamic typing
 * - `ifNotExists` - Whether to use IF NOT EXISTS when defining
 * - `overwrite` - Whether to use OVERWRITE when redefining
 * - `default` - Static default value for the field
 * - `value` - Dynamic computed value expression (SurrealQL)
 * - `assert` - Validation assertion conditions (SurrealQL, multiple conditions joined with AND)
 * - `permissions` - Field access permissions (defaults to 'FULL')
 * - `comment` - Documentation comment for the field
 *
 * ## Method Chaining
 *
 * All modifier methods return the field instance, enabling fluent chaining:
 *
 * @example
 * ```typescript
 * const userEmail = string()
 *   .required()
 *   .assert('string::is_email($value)')
 *   .comment('User email address with validation');
 *
 * const userId = string()
 *   .default('rand::uuid::v7()')
 *   .readonly()
 *   .comment('Auto-generated unique identifier');
 * ```
 */
export class SurrealQLFieldBase {
  protected field: FieldBuilderState = {
    type: 'string',
    optional: false,
    readonly: false,
    flexible: false,
    ifNotExists: false,
    overwrite: false,
    default: null,
    value: null,
    assert: null,
    assertConditions: [], // Stack of assertion conditions
    permissions: 'FULL', // Default to FULL permissions
    comment: null,
    comments: [],
    // Rename tracking
    previousNames: [],
    // Reference support (SurrealDB 3.x)
    reference: null,
    onDelete: null,
    // Default always (SurrealDB 3.x)
    defaultAlways: false,
  };

  /** Makes the field read-only after initial creation */
  readonly() {
    this.field.readonly = true;
    return this;
  }

  /** Enables flexible typing for the field */
  flexible() {
    this.field.flexible = true;
    return this;
  }

  /** Uses IF NOT EXISTS clause when defining the field */
  ifNotExists() {
    this.field.ifNotExists = true;
    return this;
  }

  /** Uses OVERWRITE clause when redefining the field */
  overwrite() {
    this.field.overwrite = true;
    return this;
  }

  /** Sets a static default value for the field */
  default(value: unknown) {
    this.field.default = value;
    return this;
  }

  /**
   * Sets a default value that is always applied (even on UPDATE).
   * SurrealDB 3.x feature: DEFAULT ALWAYS.
   *
   * @param value - The default value or expression
   * @returns The field instance for method chaining
   */
  defaultAlways(value: unknown) {
    this.field.default = value;
    this.field.defaultAlways = true;
    return this;
  }

  /** Sets a dynamic computed value expression (SurrealQL) */
  value(expression: string) {
    this.field.value = processSurrealQL(expression);
    return this;
  }

  /**
   * Sets a computed field that is evaluated on read.
   *
   * Computed fields are evaluated on read and can reference other fields,
   * perform calculations, or execute queries. This is ideal for derived
   * data that changes based on other field values.
   *
   * Note: SurrealDB v3 no longer uses the <future> syntax. The expression
   * is wrapped in braces for deferred evaluation.
   *
   * @param expression - SurrealQL expression for the computed value
   * @returns The field instance for method chaining
   *
   * @example
   * ```typescript
   * // Computed vote score
   * const score = number().computed(`
   *   array::len(votes.positive) -
   *   (<float> array::len(votes.misleading) / 2) -
   *   array::len(votes.negative)
   * `);
   *
   * // Computed followers list
   * const followers = array(record('user')).computed(`
   *   LET $id = id;
   *   RETURN SELECT VALUE id FROM user WHERE topics CONTAINS $id;
   * `);
   * ```
   */
  computed(expression: string) {
    const processed = processSurrealQL(expression);
    // SurrealDB v3 uses { } for deferred evaluation instead of <future> { }
    this.field.value = `{ ${processed} }`;
    return this;
  }

  /**
   * Adds a validation assertion condition (SurrealQL).
   *
   * Multiple assertions can be chained and will be combined with AND operators.
   * This allows for complex validation logic by composing simpler conditions.
   *
   * @param condition - SurrealQL assertion condition
   * @returns The field instance for method chaining
   *
   * @example
   * ```typescript
   * // Single assertion
   * const age = int().assert('$value >= 0');
   *
   * // Multiple assertions combined with AND
   * const username = string()
   *   .assert('$value != NONE')
   *   .assert('string::len($value) >= 3')
   *   .assert('string::len($value) <= 50')
   *   .assert('string::is_alphanum($value)');
   * // Results in: ($value != NONE) AND (string::len($value) >= 3) AND (string::len($value) <= 50) AND (string::is_alphanum($value))
   * ```
   */
  assert(condition: string) {
    const processedCondition = processSurrealQL(condition);
    this.field.assertConditions.push(processedCondition);

    // Update the combined assert field
    this.updateCombinedAssert();
    return this;
  }

  /**
   * Updates the combined assert field by joining all assertion conditions with AND.
   * This is called internally whenever assertions are modified.
   */
  private updateCombinedAssert() {
    if (this.field.assertConditions.length === 0) {
      this.field.assert = null;
    } else if (this.field.assertConditions.length === 1) {
      this.field.assert = this.field.assertConditions[0];
    } else {
      // Wrap each condition in parentheses and join with AND
      this.field.assert = this.field.assertConditions
        .map((condition) => `(${condition})`)
        .join(' AND ');
    }
  }

  /** Sets field access permissions */
  permissions(perms: string) {
    this.field.permissions = perms;
    return this;
  }

  /** Adds a documentation comment for the field */
  comment(text: string) {
    this.field.comment = text;
    return this;
  }

  /**
   * Convenience method to ensure the field has a value (not unique constraint).
   *
   * Note: This adds a non-null assertion. For actual uniqueness constraints,
   * use indexes with the unique() modifier.
   */
  unique() {
    return this.assert('$value != NONE');
  }

  /** Convenience method to make the field required (must have a value) */
  required() {
    return this.assert('$value != NONE');
  }

  /**
   * Tracks previous name(s) for this field (for ALTER FIELD RENAME operations).
   *
   * When a field is renamed, smig uses this information to generate
   * ALTER FIELD ... RENAME TO statements instead of DROP/CREATE.
   *
   * @param names - Previous field name(s)
   * @returns The field instance for method chaining
   *
   * @example
   * ```typescript
   * // Field was renamed from 'username' to 'displayName'
   * const displayName = string()
   *   .was('username')
   *   .required();
   *
   * // Field has been renamed multiple times
   * const email = string()
   *   .was(['mail', 'emailAddress'])
   *   .required();
   * ```
   */
  was(names: string | string[]) {
    const nameArray = Array.isArray(names) ? names : [names];
    (this.field.previousNames as string[]).push(...nameArray);
    return this;
  }

  /**
   * Sets this field as a reference to another table with foreign key behavior.
   * SurrealDB 3.x feature: REFERENCES.
   *
   * @param table - The table this field references
   * @returns The field instance for method chaining
   *
   * @example
   * ```typescript
   * const authorId = record('user')
   *   .references('user')
   *   .onDelete('CASCADE');
   * ```
   */
  references(table: string) {
    this.field.reference = table;
    return this;
  }

  /**
   * Sets the ON DELETE behavior for referenced fields.
   * SurrealDB 3.x feature.
   *
   * @param action - CASCADE, SET NULL, SET DEFAULT, or RESTRICT
   * @returns The field instance for method chaining
   */
  onDelete(action: 'CASCADE' | 'SET NULL' | 'SET DEFAULT' | 'RESTRICT') {
    this.field.onDelete = action;
    return this;
  }

  /**
   * Adds a length constraint for string and array fields.
   *
   * @param min - Minimum length (inclusive)
   * @param max - Maximum length (inclusive)
   * @returns The field instance for method chaining
   *
   * @example
   * ```typescript
   * const username = string()
   *   .required()
   *   .length(3, 50);
   * // Results in: ($value != NONE) AND (string::len($value) >= 3) AND (string::len($value) <= 50)
   * ```
   */
  length(min: number, max?: number) {
    if (max === undefined) {
      return this.assert(`string::len($value) >= ${min}`);
    }
    return this.assert(`string::len($value) >= ${min}`).assert(`string::len($value) <= ${max}`);
  }

  /**
   * Adds a range constraint for numeric fields.
   *
   * @param min - Minimum value (inclusive)
   * @param max - Maximum value (inclusive)
   * @returns The field instance for method chaining
   *
   * @example
   * ```typescript
   * const age = int()
   *   .range(0, 150);
   * // Results in: ($value >= 0) AND ($value <= 150)
   * ```
   */
  range(min: number, max: number) {
    return this.assert(`$value >= ${min}`).assert(`$value <= ${max}`);
  }

  /**
   * Adds a minimum value constraint for numeric fields.
   *
   * @param min - Minimum value (inclusive)
   * @returns The field instance for method chaining
   */
  min(min: number) {
    return this.assert(`$value >= ${min}`);
  }

  /**
   * Adds a maximum value constraint for numeric fields.
   *
   * @param max - Maximum value (inclusive)
   * @returns The field instance for method chaining
   */
  max(max: number) {
    return this.assert(`$value <= ${max}`);
  }

  /**
   * Adds a regex pattern constraint for string fields.
   *
   * @param pattern - Regular expression pattern
   * @param description - Optional description for documentation
   * @returns The field instance for method chaining
   *
   * @example
   * ```typescript
   * const email = string()
   *   .required()
   *   .regex(/^[^@]+@[^@]+\.[^@]+$/, 'valid email format');
   * ```
   */
  regex(pattern: RegExp, _description?: string) {
    return this.assert(`$value ~ ${pattern.toString()}`);
  }

  /** Returns the built field configuration object */
  build() {
    return this.field;
  }
}
