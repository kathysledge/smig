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
 * - **Indexes**: Support for all index types (BTREE, HASH, SEARCH, MTREE)
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
 *     id: uuid().default('rand::uuid::v4()'),
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
 */

// import { outdent } from "outdent";
import dedent from "dedent";

// ============================================================================
// CONCISE SURREALDB SCHEMA DEFINITION SYSTEM
// ============================================================================

/**
 * Processes SurrealQL strings through dedent for consistent formatting.
 *
 * This helper function handles both single-line and multi-line SurrealQL strings,
 * applying dedent formatting only to multi-line strings to preserve intentional
 * indentation while removing unintentional leading whitespace.
 */
function processSurrealQL(input: string): string {
  // Only process multi-line strings through outdent
  if (input.includes("\n")) {
    // Create a template literal from the string and process it
    return dedent`${input}`;
  }
  return input.trim();
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
 *   .assert('$value ~ /^[^@]+@[^@]+\\.[^@]+$/')
 *   .comment('User email address with validation');
 *
 * const userId = string()
 *   .default('rand::uuid::v4()')
 *   .readonly()
 *   .comment('Auto-generated unique identifier');
 * ```
 */
class SurrealQLFieldBase {
  protected field: Record<string, unknown> = {
    type: "string",
    optional: false,
    readonly: false,
    flexible: false,
    ifNotExists: false,
    overwrite: false,
    default: null,
    value: null,
    assert: null,
    assertConditions: [], // Stack of assertion conditions
    permissions: "FULL", // Default to FULL permissions
    comment: null,
    comments: [],
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

  /** Sets a dynamic computed value expression (SurrealQL) */
  value(expression: string) {
    this.field.value = processSurrealQL(expression);
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
   *   .assert('$value ~ /^[a-zA-Z0-9_]+$/');
   * // Results in: ($value != NONE) AND (string::len($value) >= 3) AND (string::len($value) <= 50) AND ($value ~ /^[a-zA-Z0-9_]+$/)
   * ```
   */
  assert(condition: string) {
    const processedCondition = processSurrealQL(condition);
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic field builder requires flexible typing
    (this.field as any).assertConditions.push(processedCondition);

    // Update the combined assert field
    this.updateCombinedAssert();
    return this;
  }

  /**
   * Updates the combined assert field by joining all assertion conditions with AND.
   * This is called internally whenever assertions are modified.
   */
  private updateCombinedAssert() {
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic field builder requires flexible typing
    const field = this.field as any;
    if (field.assertConditions.length === 0) {
      field.assert = null;
    } else if (field.assertConditions.length === 1) {
      field.assert = field.assertConditions[0];
    } else {
      // Wrap each condition in parentheses and join with AND
      field.assert = field.assertConditions
        .map((condition: string) => `(${condition})`)
        .join(" AND ");
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
    return this.assert("$value != NONE");
  }

  /** Convenience method to make the field required (must have a value) */
  required() {
    return this.assert("$value != NONE");
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
 *   .assert('$value ~ /^[^@]+@[^@]+\\.[^@]+$/')
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
    this.field.type = "string";
  }

  // Note: Removed email(), url(), regex(), length() methods to prevent accidental assertion overrides
  // Use assert() method directly for validation:
  // .assert('$value ~ /^[^@]+@[^@]+\\.[^@]+$/') for email
  // .assert('$value ~ /^https?:\\/\\/.+/') for url
  // .assert('string::len($value) >= 1 AND string::len($value) <= 200') for length
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
    this.field.type = "int";
  }

  // Note: Removed min(), max(), range() methods to prevent accidental assertion overrides
  // Use assert() method directly for validation:
  // .assert('$value >= 0') for min
  // .assert('$value <= 100') for max
  // .assert('$value >= 0 AND $value <= 100') for range
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
    this.field.type = "float";
  }

  // Note: Removed min(), max(), range() methods to prevent accidental assertion overrides
  // Use assert() method directly for validation
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
    this.field.type = "bool";
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
    this.field.type = "datetime";
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
    this.field.type = "decimal";
  }

  // Note: Removed min(), max(), range() methods to prevent accidental assertion overrides
  // Use assert() method directly for validation
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
    this.field.type = "uuid";
  }
}

/**
 * Duration field type builder for SurrealDB.
 *
 * Creates duration fields for time intervals and time-based calculations.
 * Supports SurrealDB's duration format (e.g., '1h', '30m', '45s').
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
    this.field.type = "duration";
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
    this.field.type = "object";
  }
}

/**
 * Geometry field type builder for SurrealDB.
 *
 * Creates geometry fields for storing spatial data, coordinates, and geographic
 * information. Supports GeoJSON format and spatial operations.
 *
 * @example
 * ```typescript
 * // Location coordinates
 * const location = option('geometry');
 *
 * // Required geographic point
 * const coordinates = geometry().required();
 *
 * // Area boundaries
 * const boundary = geometry().comment('Geographic boundary');
 * ```
 */
export class SurrealQLGeometry extends SurrealQLFieldBase {
  constructor() {
    super();
    this.field.type = "geometry";
  }
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
  constructor(type?: string) {
    super();
    this.field.type = type ? `option<${type}>` : "option";
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
  private field: Record<string, unknown> = {
    type: "any",
    optional: false,
    default: null,
    value: null,
    assert: null,
    assertConditions: [], // Stack of assertion conditions
    comments: [],
  };

  default(value: unknown) {
    this.field.default = value;
    return this;
  }
  value(expression: string) {
    this.field.value = processSurrealQL(expression);
    return this;
  }
  assert(condition: string) {
    const processedCondition = processSurrealQL(condition);
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic field builder requires flexible typing
    (this.field as any).assertConditions.push(processedCondition);
    this.updateCombinedAssert();
    return this;
  }

  private updateCombinedAssert() {
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic field builder requires flexible typing
    const field = this.field as any;
    if (field.assertConditions.length === 0) {
      field.assert = null;
    } else if (field.assertConditions.length === 1) {
      field.assert = field.assertConditions[0];
    } else {
      field.assert = field.assertConditions
        .map((condition: string) => `(${condition})`)
        .join(" AND ");
    }
  }

  comment(text: string) {
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic field builder requires flexible typing
    (this.field as any).comments.push(text);
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
 * ```
 */
export class SurrealQLArray<T extends string> {
  private field: Record<string, unknown> = {
    type: "array",
    optional: false,
    default: null,
    value: null,
    assert: null,
    assertConditions: [], // Stack of assertion conditions
    comments: [],
  };

  constructor(type: T) {
    this.field.type = `array<${type}>`;
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
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic field builder requires flexible typing
    (this.field as any).assertConditions.push(processedCondition);
    this.updateCombinedAssert();
    return this;
  }

  private updateCombinedAssert() {
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic field builder requires flexible typing
    const field = this.field as any;
    if (field.assertConditions.length === 0) {
      field.assert = null;
    } else if (field.assertConditions.length === 1) {
      field.assert = field.assertConditions[0];
    } else {
      field.assert = field.assertConditions
        .map((condition: string) => `(${condition})`)
        .join(" AND ");
    }
  }

  comment(text: string) {
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic field builder requires flexible typing
    (this.field as any).comments.push(text);
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
 * between tables in the database schema.
 *
 * @example
 * ```typescript
 * const author = record('user').required();
 * const category = option('record<category>');
 * ```
 */
export class SurrealQLRecord extends SurrealQLFieldBase {
  constructor(tableName: string) {
    super();
    this.field.type = `record<${tableName.toLowerCase()}>`;
  }
}

/**
 * Index definition builder for SurrealDB tables.
 *
 * Indexes improve query performance and can enforce uniqueness constraints.
 * Different index types are optimized for specific use cases:
 *
 * - **BTREE**: General-purpose indexes for range queries and sorting
 * - **HASH**: Fast equality lookups
 * - **SEARCH**: Full-text search with analyzers
 * - **MTREE**: Multi-dimensional data (geometry, etc.)
 *
 * @example
 * ```typescript
 * // Primary key index
 * const primary = index(['id']).unique();
 *
 * // Search index with analyzer
 * const contentSearch = index(['title', 'content'])
 *   .search()
 *   .analyzer('english')
 *   .highlights();
 *
 * // Composite index
 * const userPosts = index(['userId', 'createdAt']).btree();
 * ```
 */
export class SurrealQLIndex {
  private index: Record<string, unknown> = {
    columns: [],
    unique: false,
    type: "BTREE",
    analyzer: null,
    highlights: false,
    comments: [],
  };

  constructor(columns: string[]) {
    this.index.columns = columns;
  }

  /** Makes this index enforce uniqueness constraints */
  unique() {
    this.index.unique = true;
    return this;
  }

  /** Sets index type to BTREE (default) - good for range queries */
  btree() {
    this.index.type = "BTREE";
    return this;
  }

  /** Sets index type to HASH - fast equality lookups */
  hash() {
    this.index.type = "HASH";
    return this;
  }

  /** Sets index type to SEARCH - enables full-text search */
  search() {
    this.index.type = "SEARCH";
    return this;
  }

  /** Sets index type to MTREE - for multi-dimensional data */
  mtree() {
    this.index.type = "MTREE";
    return this;
  }

  /** Sets the text analyzer for SEARCH indexes */
  analyzer(name: string) {
    this.index.analyzer = name;
    return this;
  }

  /** Enables search result highlighting for SEARCH indexes */
  highlights() {
    this.index.highlights = true;
    return this;
  }

  /** Adds a documentation comment for the index */
  comment(text: string) {
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic index builder requires flexible typing
    (this.index as any).comments.push(text);
    return this;
  }
  build() {
    return this.index;
  }
}

/**
 * Event (trigger) definition builder for SurrealDB tables.
 *
 * Events allow automatic execution of SurrealQL code in response to data changes,
 * enabling business logic implementation, data validation, and maintaining
 * data consistency across tables.
 *
 * ## Event Types
 *
 * - **CREATE**: Triggered when new records are inserted
 * - **UPDATE**: Triggered when existing records are modified
 * - **DELETE**: Triggered when records are removed
 *
 * @example
 * ```typescript
 * // Update timestamp on record changes
 * const updateTimestamp = event('update_timestamp')
 *   .onUpdate()
 *   .thenDo('SET updatedAt = time::now()');
 *
 * // Cascade delete related records
 * const cascadeDelete = event('cascade_posts')
 *   .onDelete()
 *   .thenDo('DELETE post WHERE authorId = $value.id');
 *
 * // Conditional event with when clause
 * const notifyAdmin = event('notify_admin')
 *   .onCreate()
 *   .when('$after.priority = "high"')
 *   .thenDo('http::post("https://api.example.com/notify", $after)');
 * ```
 */
export class SurrealQLEvent {
  private event: Record<string, unknown> = {
    type: null,
    when: null,
    thenStatement: null,
    comments: [],
  };
  private triggerSet = false;

  constructor(name: string) {
    this.validateName(name);
    this.event.name = name.trim();
  }

  private validateName(name: string): void {
    if (!name || name.trim() === "") {
      throw new Error("Event name is required and cannot be empty");
    }

    const trimmed = name.trim();
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
      throw new Error(
        `Invalid event name '${trimmed}'. Must be a valid SurrealDB identifier (letters, numbers, underscores only, cannot start with number).`,
      );
    }
  }

  /** Sets the event to trigger on CREATE operations */
  onCreate() {
    this.event.type = "CREATE";
    this.triggerSet = true;
    return this;
  }

  /** Sets the event to trigger on UPDATE operations */
  onUpdate() {
    this.event.type = "UPDATE";
    this.triggerSet = true;
    return this;
  }

  /** Sets the event to trigger on DELETE operations */
  onDelete() {
    this.event.type = "DELETE";
    this.triggerSet = true;
    return this;
  }

  /** Sets a condition that must be met for the event to execute */
  when(condition: string) {
    this.event.when = processSurrealQL(condition);
    return this;
  }

  /** Sets the SurrealQL code to execute when the event triggers */
  thenDo(action: string) {
    if (!action || action.trim() === "") {
      throw new Error("THEN clause is required and cannot be empty");
    }
    this.event.thenStatement = processSurrealQL(action);
    return this;
  }

  /** Adds a documentation comment for the event */
  comment(text: string) {
    if (text && text.trim() !== "") {
      // biome-ignore lint/suspicious/noExplicitAny: Dynamic event builder requires flexible typing
      (this.event as any).comments.push(text.trim());
    }
    return this;
  }

  /** Builds and validates the complete event definition */
  build() {
    if (!this.triggerSet) {
      throw new Error("Event trigger type must be set. Use onCreate(), onUpdate(), or onDelete().");
    }

    if (!this.event.thenStatement) {
      throw new Error('Event THEN clause is required. Use .thenDo("your SurrealQL here").');
    }

    // biome-ignore lint/suspicious/noExplicitAny: Dynamic event builder requires flexible typing
    const event = this.event as any;
    // Return a copy to prevent external mutation
    return {
      name: this.event.name,
      type: this.event.type,
      when: this.event.when,
      thenStatement: this.event.thenStatement,
      comments: [...event.comments],
    };
  }
}

/**
 * Defines a complete SurrealDB table schema with fields, indexes, and events.
 *
 * This function creates a comprehensive table definition that includes all
 * field definitions, indexes for performance optimization, and events for
 * business logic implementation. The resulting schema can be used with
 * the migration system to create or update database tables.
 *
 * @param config - Configuration object for the table schema
 * @param config.table - The name of the table
 * @param config.schemafull - Whether to enforce strict schema (default: true)
 * @param config.fields - Object mapping field names to field definitions
 * @param config.indexes - Optional object mapping index names to index definitions
 * @param config.events - Optional object mapping event names to event definitions
 * @param config.comments - Optional array of documentation comments
 *
 * @returns A complete table schema object ready for migration
 *
 * @example
 * ```typescript
 * const userSchema = defineSchema({
 *   table: 'user',
 *   schemafull: true,
 *   fields: {
 *     id: uuid().default('rand::uuid::v4()'),
 *     email: string().assert('$value ~ /^[^@]+@[^@]+\\.[^@]+$/').unique(),
 *     name: string().required(),
 *     isActive: bool().default(true),
 *     createdAt: datetime().value('time::now()'),
 *   },
 *   indexes: {
 *     primary: index(['id']).unique(),
 *     email: index(['email']).unique(),
 *     active_users: index(['isActive', 'createdAt'])
 *   },
 *   events: {
 *     update_timestamp: event('update_modified')
 *       .onUpdate()
 *       .thenDo('SET updatedAt = time::now()')
 *   },
 *   comments: ['User account management table']
 * });
 * ```
 */
export function defineSchema(config: {
  table: string;
  schemafull?: boolean;
  fields: Record<string, unknown>;
  indexes?: Record<string, SurrealQLIndex>;
  events?: Record<string, SurrealQLEvent>;
  comments?: string[];
}) {
  return {
    name: config.table,
    schemafull: config.schemafull !== false,
    fields: Object.entries(config.fields).map(([name, field]) => ({
      name,
      // biome-ignore lint/suspicious/noExplicitAny: Field builders are dynamically typed
      ...(field as any).build(),
    })),
    indexes: config.indexes
      ? Object.entries(config.indexes).map(([name, index]) => ({
          name: name,
          ...index.build(),
        }))
      : [],
    events: config.events
      ? Object.entries(config.events).map(([_name, event]) => ({
          ...event.build(),
        }))
      : [],
    comments: config.comments || [],
  };
}

/**
 * Defines a SurrealDB relation (graph edge) between two tables.
 *
 * Relations represent connections between records and are a core feature of
 * SurrealDB's graph database capabilities. They automatically include the
 * required 'in' and 'out' fields that reference the source and target tables.
 *
 * @param config - Configuration object for the relation
 * @param config.name - The name of the relation table
 * @param config.from - The source table name
 * @param config.to - The target table name
 * @param config.fields - Optional additional fields for the relation
 * @param config.indexes - Optional indexes for the relation
 * @param config.events - Optional events for the relation
 * @param config.comments - Optional documentation comments
 *
 * @returns A complete relation schema object with automatic in/out fields
 *
 * @example
 * ```typescript
 * // Simple relation
 * const followRelation = defineRelation({
 *   name: 'follow',
 *   from: 'user',
 *   to: 'user',
 *   comments: ['User following relationships']
 * });
 *
 * // Relation with additional metadata
 * const likeRelation = defineRelation({
 *   name: 'like',
 *   from: 'user',
 *   to: 'post',
 *   fields: {
 *     strength: int().default(1).assert('$value >= 1 AND $value <= 5'),
 *     createdAt: datetime().value('time::now()')
 *   },
 *   indexes: {
 *     unique_like: index(['in', 'out']).unique(),
 *     by_strength: index(['strength'])
 *   }
 * });
 * ```
 */
export function defineRelation(config: {
  name: string;
  from: string;
  to: string;
  fields?: Record<string, unknown>;
  indexes?: Record<string, SurrealQLIndex>;
  events?: Record<string, SurrealQLEvent>;
  comments?: string[];
}) {
  // Create the mandatory 'in' and 'out' fields for SurrealDB relations
  const mandatoryFields = {
    in: record(config.from).required(),
    out: record(config.to).required(),
  };

  // Merge mandatory fields with user-defined fields
  const allFields = {
    ...mandatoryFields,
    ...config.fields,
  };

  return {
    name: config.name,
    from: config.from,
    to: config.to,
    fields: Object.entries(allFields).map(([name, field]) => ({
      name,
      ...field.build(),
    })),
    indexes: config.indexes
      ? Object.entries(config.indexes).map(([name, index]) => ({
          name: name,
          ...index.build(),
        }))
      : [],
    events: config.events
      ? Object.entries(config.events).map(([_name, event]) => ({
          ...event.build(),
        }))
      : [],
    comments: config.comments || [],
  };
}

// Convenience Functions
/**
 * Creates a string field with validation support.
 *
 * @returns A string field builder with all available modifiers
 *
 * @example
 * ```typescript
 * const nameField = string()
 *   .required()
 *   .assert('string::len($value) >= 1 AND string::len($value) <= 100');
 *
 * const emailField = string()
 *   .unique()
 *   .assert('$value ~ /^[^@]+@[^@]+\\.[^@]+$/');
 * ```
 */
export const string = () => new SurrealQLString();

/**
 * Creates an integer field.
 *
 * @returns An integer field builder with all available modifiers
 *
 * @example
 * ```typescript
 * const ageField = option('int')
 *   .assert('$value >= 0 AND $value <= 150');
 * ```
 */
export const int = () => new SurrealQLInt();

/**
 * Creates a floating-point field.
 *
 * @returns A float field builder with all available modifiers
 *
 * @example
 * ```typescript
 * const priceField = float()
 *   .default(0.0)
 *   .assert('$value >= 0');
 * ```
 */
export const float = () => new SurrealQLFloat();

/**
 * Creates a boolean field.
 *
 * @returns A boolean field builder with all available modifiers
 *
 * @example
 * ```typescript
 * const isActiveField = bool()
 *   .default(true);
 * ```
 */
export const bool = () => new SurrealQLBool();

/**
 * Creates a datetime field.
 *
 * @returns A datetime field builder with all available modifiers
 *
 * @example
 * ```typescript
 * const createdAtField = datetime()
 *   .value('time::now()');
 * ```
 */
export const datetime = () => new SurrealQLDatetime();

/**
 * Creates a decimal field for precise numbers.
 *
 * @returns A decimal field builder with all available modifiers
 *
 * @example
 * ```typescript
 * const amountField = decimal()
 *   .default(0.00)
 *   .assert('$value >= 0');
 * ```
 */
export const decimal = () => new SurrealQLDecimal();

/**
 * Creates a UUID field.
 *
 * @returns A UUID field builder with all available modifiers
 *
 * @example
 * ```typescript
 * const userIdField = uuid()
 *   .default('rand::uuid::v4()');
 * ```
 */
export const uuid = () => new SurrealQLUuid();

/**
 * Creates a duration field.
 *
 * @returns A duration field builder with all available modifiers
 *
 * @example
 * ```typescript
 * const timeoutField = duration()
 *   .default('30s');
 * ```
 */
export const duration = () => new SurrealQLDuration();

/**
 * Creates an object field.
 *
 * @returns An object field builder with all available modifiers
 *
 * @example
 * ```typescript
 * const metadataField = option('object');
 * ```
 */
export const object = () => new SurrealQLObject();

/**
 * Creates a geometry field.
 *
 * @returns A geometry field builder with all available modifiers
 *
 * @example
 * ```typescript
 * const locationField = option('geometry');
 * ```
 */
export const geometry = () => new SurrealQLGeometry();

/**
 * Creates an option field that can hold a value of the specified type or null.
 *
 * @param type - Optional type parameter (e.g., 'string', 'int', 'record<user>')
 * @returns An option field builder with all available modifiers
 *
 * @example
 * ```typescript
 * // Typed option fields
 * const message = option('string');
 * const userId = option('record<user>').default(null);
 * const count = option('int');
 *
 * // Untyped option (legacy)
 * const statusField = option().default('pending');
 * ```
 */
export const option = (type?: string) => new SurrealQLOption(type);

/**
 * Creates an any-type field.
 *
 * @returns An any field builder with all available modifiers
 *
 * @example
 * ```typescript
 * const dataField = option('any');
 * ```
 */
export const any = () => new SurrealQLAny();

/**
 * Creates an array field with a specific element type.
 *
 * @param type - The type of elements in the array
 * @returns An array field builder with all available modifiers
 *
 * @example
 * ```typescript
 * const tagsField = array('string')
 *   .default([]);
 *
 * const scoresField = option('array<int>');
 * ```
 */
export const array = <T extends string>(type: T) => new SurrealQLArray<T>(type);

/**
 * Creates a record field for table relationships.
 *
 * @param tableName - The name of the related table
 * @returns A record field builder with all available modifiers
 *
 * @example
 * ```typescript
 * const authorField = record('user')
 *   .required();
 *
 * const parentField = option('record<category>');
 * ```
 */
export const record = (tableName: string) => new SurrealQLRecord(tableName);

/**
 * Creates an index definition.
 *
 * @param columns - Array of column names to index
 * @returns An index builder with all available modifiers
 *
 * @example
 * ```typescript
 * const emailIndex = index(['email'])
 *   .unique();
 *
 * const searchIndex = index(['content'])
 *   .search()
 *   .analyzer('english');
 * ```
 */
export const index = (columns: string[]) => new SurrealQLIndex(columns);

/**
 * Creates an event definition.
 *
 * @param name - The name of the event
 * @returns An event builder with all available modifiers
 *
 * @example
 * ```typescript
 * const updateTimestampEvent = event('update_timestamp')
 *   .onUpdate()
 *   .thenDo('SET updatedAt = time::now()');
 * ```
 */
export const event = (name: string) => new SurrealQLEvent(name);

// Common Field Patterns
export const commonFields = {
  timestamp: () => datetime().value("time::now()"),
  emptyTimestamp: () => datetime(),
  metadata: () => option("object"),
  tags: () => option("array<string>"),
  owner: (tableName: string = "user") => record(tableName),
};

// Common Index Patterns
export const commonIndexes = {
  primary: (_tableName: string) => index(["id"]).unique(),
  createdAt: (_tableName: string) => index(["createdAt"]),
  updatedAt: (_tableName: string) => index(["updatedAt"]),
  contentSearch: (_tableName: string) =>
    index(["content"]).search().analyzer("english").highlights(),
};

// Common Event Patterns
export const commonEvents = {
  updateTimestamp: (tableName: string) =>
    event(`${tableName}_update_timestamp`).onUpdate().thenDo("SET updatedAt = time::now()"),
  cascadeDelete: (tableName: string, relatedTable: string, foreignKey: string) =>
    event(`${tableName}_cascade_delete`)
      .onDelete()
      .thenDo(`DELETE ${relatedTable} WHERE ${foreignKey} = $value.id`),
};

/**
 * Composes multiple table schemas and relations into a complete database schema.
 *
 * This function combines individual table definitions and relations into a single
 * schema object that can be used with the migration system. It provides a clean
 * way to organize complex database schemas by composing them from smaller,
 * manageable pieces.
 *
 * @param config - Configuration object for schema composition
 * @param config.models - Object mapping model names to table schema definitions
 * @param config.relations - Optional object mapping relation names to relation definitions
 * @param config.comments - Optional array of schema-level documentation comments
 *
 * @returns A complete database schema ready for migration
 *
 * @example
 * ```typescript
 * // Define individual models
 * const userSchema = defineSchema({ table: 'user', fields: { ... } });
 * const postSchema = defineSchema({ table: 'post', fields: { ... } });
 *
 * // Define relations
 * const authorRelation = defineRelation({
 *   name: 'authored',
 *   from: 'user',
 *   to: 'post'
 * });
 *
 * // Compose complete schema
 * const blogSchema = composeSchema({
 *   models: {
 *     user: userSchema,
 *     post: postSchema
 *   },
 *   relations: {
 *     authored: authorRelation
 *   },
 *   comments: [
 *     'Blog application database schema',
 *     'Supports users, posts, and authorship relationships'
 *   ]
 * });
 * ```
 */
export function composeSchema(config: {
  models: Record<string, unknown>;
  relations?: Record<string, unknown>;
  comments?: string[];
}) {
  return {
    tables: Object.values(config.models),
    relations: config.relations ? Object.values(config.relations) : [],
    comments: config.comments || [],
  };
}

// ============================================================================
// SCHEMA TYPE DEFINITIONS
// ============================================================================

/** Type definition for a complete SurrealDB table model */
export interface SurrealDBModel {
  name: string;
  schemafull: boolean;
  fields: unknown[];
  indexes: unknown[];
  events: unknown[];
  comments: string[];
}

/** Type definition for a SurrealDB relation (graph edge) */
export interface SurrealDBRelation {
  name: string;
  from: string;
  to: string;
  fields: unknown[];
  indexes: unknown[];
  events: unknown[];
  comments: string[];
}

/** Type definition for a complete database schema */
export interface SurrealDBSchema {
  tables: SurrealDBModel[];
  relations: SurrealDBRelation[];
  comments: string[];
}

// ============================================================================
// CONVENIENCE ALIASES
// ============================================================================

/** Shorthand alias for commonFields */
export const cf = commonFields;
/** Shorthand alias for commonIndexes */
export const ci = commonIndexes;
/** Shorthand alias for commonEvents */
export const ce = commonEvents;
