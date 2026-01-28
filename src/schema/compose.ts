/**
 * @fileoverview Schema composition utilities.
 * @module schema/compose
 */

/**
 * Interface for objects that have a build() method.
 */
interface BuildableObject {
  build(): unknown;
}

/**
 * Checks if an object has a build method.
 */
function isBuildable(obj: unknown): obj is BuildableObject {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'build' in obj &&
    typeof (obj as BuildableObject).build === 'function'
  );
}

/**
 * Resolves a value that may be a builder object or a raw definition.
 */
function resolveBuilder<T>(value: T | BuildableObject): T {
  if (isBuildable(value)) {
    return value.build() as T;
  }
  return value as T;
}

/**
 * Type definition for a complete SurrealDB table model
 */
export interface SurrealDBModel {
  name: string;
  schemafull: boolean;
  fields: unknown[];
  indexes: unknown[];
  events: unknown[];
  comments: string[];
}

/**
 * Type definition for a SurrealDB relation (graph edge)
 */
export interface SurrealDBRelation {
  name: string;
  from: string;
  to: string;
  schemafull?: boolean;
  enforced?: boolean;
  fields: unknown[];
  indexes: unknown[];
  events: unknown[];
  comments: string[];
}

/**
 * Type definition for a complete database schema
 */
export interface SurrealDBSchema {
  tables: SurrealDBModel[];
  relations: SurrealDBRelation[];
  functions: unknown[];
  scopes: unknown[];
  analyzers: unknown[];
  accesses: unknown[];
  params: unknown[];
  users: unknown[];
  models: unknown[];
  configs: unknown[];
  sequences: unknown[];
  comments: string[];
}

/**
 * Composes multiple table schemas, relations, functions, and other entities
 * into a complete database schema.
 *
 * This function combines individual schema elements into a single schema object
 * that can be used with the migration system. It provides a clean way to organize
 * complex database schemas by composing them from smaller, manageable pieces.
 *
 * @param config - Configuration object for schema composition
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
 *   models: { user: userSchema, post: postSchema },
 *   relations: { authored: authorRelation },
 *   functions: { daysSince: daysSinceFunc },
 *   analyzers: { search: searchAnalyzer },
 *   accesses: { user: userAccess },
 *   params: { appName: appNameParam },
 * });
 * ```
 */
export function composeSchema(config: {
  models: Record<string, unknown>;
  relations?: Record<string, unknown>;
  functions?: Record<string, unknown>;
  scopes?: Record<string, unknown>;
  analyzers?: Record<string, unknown>;
  accesses?: Record<string, unknown>;
  params?: Record<string, unknown>;
  users?: Record<string, unknown>;
  surrealModels?: Record<string, unknown>;
  configs?: Record<string, unknown>;
  sequences?: Record<string, unknown>;
  comments?: string[];
}): SurrealDBSchema {
  return {
    tables: Object.values(config.models) as SurrealDBModel[],
    relations: config.relations ? (Object.values(config.relations) as SurrealDBRelation[]) : [],
    functions: config.functions ? Object.values(config.functions).map(resolveBuilder) : [],
    scopes: config.scopes ? Object.values(config.scopes).map(resolveBuilder) : [],
    analyzers: config.analyzers ? Object.values(config.analyzers).map(resolveBuilder) : [],
    accesses: config.accesses ? Object.values(config.accesses).map(resolveBuilder) : [],
    params: config.params ? Object.values(config.params).map(resolveBuilder) : [],
    users: config.users ? Object.values(config.users).map(resolveBuilder) : [],
    models: config.surrealModels ? Object.values(config.surrealModels).map(resolveBuilder) : [],
    configs: config.configs ? Object.values(config.configs).map(resolveBuilder) : [],
    sequences: config.sequences ? Object.values(config.sequences).map(resolveBuilder) : [],
    comments: config.comments || [],
  };
}
