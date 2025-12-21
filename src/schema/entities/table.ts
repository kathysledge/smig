/**
 * @fileoverview Table builder for SurrealDB.
 * @module schema/entities/table
 */

import { processSurrealQL, validateIdentifier } from '../common/utils';
import { SurrealQLRecord } from '../fields/complex';
import type { SurrealQLIndex } from '../indexes';
import type { SurrealQLEvent } from './event';

/**
 * Table type enumeration.
 */
export type TableType = 'NORMAL' | 'RELATION' | 'ANY';

/**
 * Table configuration for tracking and options.
 */
export interface TableConfig {
  /** Previous name(s) this table was known as (for ALTER TABLE RENAME) */
  previousNames?: string[];
  /** Table type (NORMAL, RELATION, ANY) */
  type?: TableType;
  /** Whether the table is schemafull (default: true) */
  schemafull?: boolean;
  /** Whether to drop records on table removal */
  drop?: boolean;
  /** Comment for the table */
  comment?: string;
  /** Permissions configuration */
  permissions?: {
    select?: string;
    create?: string;
    update?: string;
    delete?: string;
  };
  /** View definition (for VIEW tables) */
  as?: string;
  /** Changefeed configuration */
  changefeed?: {
    duration?: string;
    includeOriginal?: boolean;
  };
}

/**
 * Table definition builder for SurrealDB.
 *
 * Tables are the primary data storage containers in SurrealDB.
 * This builder supports all table options including types, permissions,
 * views, changefeeds, and schema modes.
 *
 * @example
 * ```typescript
 * // Basic schemafull table
 * const users = table('user')
 *   .schemafull()
 *   .comment('User accounts');
 *
 * // Relation table (for graph edges)
 * const follows = table('follows')
 *   .relation('user', 'user')
 *   .comment('User follow relationships');
 *
 * // View table
 * const activeUsers = table('active_users')
 *   .view('SELECT * FROM user WHERE active = true');
 *
 * // Table with changefeed
 * const auditedTable = table('orders')
 *   .schemafull()
 *   .changefeed('7d', true);
 * ```
 */
export class SurrealQLTable {
  private table: Record<string, unknown> = {
    name: '',
    type: 'NORMAL',
    schemafull: true,
    drop: false,
    // Relation options
    from: null,
    to: null,
    enforced: false,
    // View
    as: null,
    // Changefeed
    changefeedDuration: null,
    changefeedIncludeOriginal: false,
    // Permissions
    permissions: null,
    // Metadata
    comment: null,
    comments: [],
    previousNames: [],
    ifNotExists: false,
    overwrite: false,
  };

  constructor(name: string) {
    validateIdentifier(name, 'Table');
    this.table.name = name.trim();
  }

  /** Uses IF NOT EXISTS clause when defining the table */
  ifNotExists() {
    this.table.ifNotExists = true;
    return this;
  }

  /** Uses OVERWRITE clause when redefining the table */
  overwrite() {
    this.table.overwrite = true;
    return this;
  }

  /** Sets the table as schemafull (strict typing, default) */
  schemafull() {
    this.table.schemafull = true;
    return this;
  }

  /** Sets the table as schemaless (flexible typing) */
  schemaless() {
    this.table.schemafull = false;
    return this;
  }

  /**
   * Sets the table type to NORMAL (standard data table).
   *
   * @returns The table instance for method chaining
   */
  normal() {
    this.table.type = 'NORMAL';
    return this;
  }

  /**
   * Sets the table type to RELATION (graph edge table).
   *
   * Relation tables automatically have `in` and `out` fields
   * that reference the connected records.
   *
   * @param from - Source table name
   * @param to - Target table name
   * @returns The table instance for method chaining
   */
  relation(from?: string, to?: string) {
    this.table.type = 'RELATION';
    if (from) this.table.from = from;
    if (to) this.table.to = to;
    return this;
  }

  /**
   * Sets the table type to ANY (accepts any record type).
   *
   * @returns The table instance for method chaining
   */
  any() {
    this.table.type = 'ANY';
    return this;
  }

  /**
   * Enforces relation constraints (SurrealDB 3.x).
   * Ensures that `in` and `out` fields reference valid records.
   *
   * @returns The table instance for method chaining
   */
  enforced() {
    this.table.enforced = true;
    return this;
  }

  /**
   * Enables DROP behavior (records are removed when table is dropped).
   *
   * @returns The table instance for method chaining
   */
  drop() {
    this.table.drop = true;
    return this;
  }

  /**
   * Defines the table as a VIEW with a SELECT query.
   *
   * @param query - The SELECT query for the view
   * @returns The table instance for method chaining
   */
  view(query: string) {
    this.table.as = processSurrealQL(query);
    return this;
  }

  /**
   * Alias for view() - defines table AS SELECT query.
   *
   * @param query - The SELECT query
   * @returns The table instance for method chaining
   */
  as(query: string) {
    return this.view(query);
  }

  /**
   * Enables changefeed for the table.
   *
   * Changefeeds track all changes to the table for a specified duration,
   * useful for real-time sync, audit logs, and event sourcing.
   *
   * @param duration - How long to keep changes (e.g., '7d', '24h')
   * @param includeOriginal - Whether to include original record values
   * @returns The table instance for method chaining
   */
  changefeed(duration: string, includeOriginal?: boolean) {
    this.table.changefeedDuration = duration;
    if (includeOriginal !== undefined) {
      this.table.changefeedIncludeOriginal = includeOriginal;
    }
    return this;
  }

  /**
   * Sets permissions for the table.
   *
   * @param perms - Permission configuration object or string
   * @returns The table instance for method chaining
   */
  permissions(
    perms:
      | string
      | {
          select?: string;
          create?: string;
          update?: string;
          delete?: string;
          for?: string;
        },
  ) {
    if (typeof perms === 'string') {
      this.table.permissions = perms;
    } else {
      this.table.permissions = perms;
    }
    return this;
  }

  /** Adds a documentation comment for the table */
  comment(text: string) {
    if (text && text.trim() !== '') {
      this.table.comment = text.trim();
    }
    return this;
  }

  /**
   * Tracks previous name(s) for this table (for ALTER TABLE RENAME operations).
   *
   * When a table is renamed, smig uses this information to generate
   * ALTER TABLE ... RENAME TO statements instead of DROP/CREATE.
   *
   * @param names - Previous table name(s)
   * @returns The table instance for method chaining
   *
   * @example
   * ```typescript
   * // Table was renamed from 'users' to 'user'
   * const user = table('user')
   *   .was('users')
   *   .schemafull();
   *
   * // Table has been renamed multiple times
   * const account = table('account')
   *   .was(['user_account', 'user'])
   *   .schemafull();
   * ```
   */
  was(names: string | string[]) {
    const nameArray = Array.isArray(names) ? names : [names];
    (this.table.previousNames as string[]).push(...nameArray);
    return this;
  }

  /** Builds and validates the complete table definition */
  build() {
    return {
      name: this.table.name,
      type: this.table.type,
      schemafull: this.table.schemafull,
      drop: this.table.drop,
      from: this.table.from,
      to: this.table.to,
      enforced: this.table.enforced,
      as: this.table.as,
      changefeedDuration: this.table.changefeedDuration,
      changefeedIncludeOriginal: this.table.changefeedIncludeOriginal,
      permissions: this.table.permissions,
      comment: this.table.comment,
      comments: [...(this.table.comments as string[])],
      previousNames: [...(this.table.previousNames as string[])],
      ifNotExists: this.table.ifNotExists,
      overwrite: this.table.overwrite,
    };
  }
}

/**
 * Schema definition helper that combines a table with its fields, indexes, and events.
 *
 * This is the main entry point for defining complete table schemas.
 */
export interface TableSchema {
  name: string;
  schemafull: boolean;
  fields: unknown[];
  indexes: unknown[];
  events: unknown[];
  comments: string[];
  // Table options
  type?: TableType;
  drop?: boolean;
  from?: string;
  to?: string;
  enforced?: boolean;
  as?: string;
  changefeedDuration?: string;
  changefeedIncludeOriginal?: boolean;
  permissions?: unknown;
  previousNames?: string[];
  // Definition options
  ifNotExists?: boolean;
  overwrite?: boolean;
  comment?: string;
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
 * @returns A complete table schema object ready for migration
 */
export function defineSchema(config: {
  table: string;
  schemaless?: boolean;
  schemafull?: boolean;
  type?: TableType;
  drop?: boolean;
  as?: string;
  changefeed?: { duration: string; includeOriginal?: boolean };
  permissions?: unknown;
  was?: string | string[];
  fields: Record<string, unknown>;
  indexes?: Record<string, SurrealQLIndex>;
  events?: Record<string, SurrealQLEvent>;
  comments?: string[];
}): TableSchema {
  const previousNames: string[] = [];
  if (config.was) {
    const names = Array.isArray(config.was) ? config.was : [config.was];
    previousNames.push(...names);
  }

  return {
    name: config.table,
    schemafull: config.schemafull !== false && config.schemaless !== true,
    type: config.type,
    drop: config.drop,
    as: config.as,
    changefeedDuration: config.changefeed?.duration,
    changefeedIncludeOriginal: config.changefeed?.includeOriginal,
    permissions: config.permissions,
    previousNames,
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
 */
export function defineRelation(config: {
  name: string;
  from: string;
  to: string;
  enforced?: boolean;
  was?: string | string[];
  fields?: Record<string, unknown>;
  indexes?: Record<string, SurrealQLIndex>;
  events?: Record<string, SurrealQLEvent>;
  comments?: string[];
}) {
  const previousNames: string[] = [];
  if (config.was) {
    const names = Array.isArray(config.was) ? config.was : [config.was];
    previousNames.push(...names);
  }

  // Create the mandatory 'in' and 'out' fields for SurrealDB relations
  const inField = new SurrealQLRecord(config.from).required();
  const outField = new SurrealQLRecord(config.to).required();

  // Build the mandatory fields first
  const mandatoryFields = [
    { name: 'in', ...inField.build() },
    { name: 'out', ...outField.build() },
  ];

  // Add user-defined fields
  const userFields = config.fields
    ? Object.entries(config.fields).map(([name, field]) => ({
        name,
        // biome-ignore lint/suspicious/noExplicitAny: Field builders are dynamically typed
        ...(field as any).build(),
      }))
    : [];

  return {
    name: config.name,
    type: 'RELATION' as TableType,
    schemafull: true,
    from: config.from,
    to: config.to,
    enforced: config.enforced,
    previousNames,
    fields: [...mandatoryFields, ...userFields],
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
