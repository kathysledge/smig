/**
 * @fileoverview Schema composition utilities.
 * @module schema/compose
 */

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
    functions: config.functions
      ? // biome-ignore lint/suspicious/noExplicitAny: Dynamic builder objects
        Object.values(config.functions).map((f: any) => (f.build ? f.build() : f))
      : [],
    scopes: config.scopes
      ? // biome-ignore lint/suspicious/noExplicitAny: Dynamic builder objects
        Object.values(config.scopes).map((s: any) => (s.build ? s.build() : s))
      : [],
    analyzers: config.analyzers
      ? // biome-ignore lint/suspicious/noExplicitAny: Dynamic builder objects
        Object.values(config.analyzers).map((a: any) => (a.build ? a.build() : a))
      : [],
    accesses: config.accesses
      ? // biome-ignore lint/suspicious/noExplicitAny: Dynamic builder objects
        Object.values(config.accesses).map((a: any) => (a.build ? a.build() : a))
      : [],
    params: config.params
      ? // biome-ignore lint/suspicious/noExplicitAny: Dynamic builder objects
        Object.values(config.params).map((p: any) => (p.build ? p.build() : p))
      : [],
    users: config.users
      ? // biome-ignore lint/suspicious/noExplicitAny: Dynamic builder objects
        Object.values(config.users).map((u: any) => (u.build ? u.build() : u))
      : [],
    models: config.surrealModels
      ? // biome-ignore lint/suspicious/noExplicitAny: Dynamic builder objects
        Object.values(config.surrealModels).map((m: any) => (m.build ? m.build() : m))
      : [],
    configs: config.configs
      ? // biome-ignore lint/suspicious/noExplicitAny: Dynamic builder objects
        Object.values(config.configs).map((c: any) => (c.build ? c.build() : c))
      : [],
    sequences: config.sequences
      ? // biome-ignore lint/suspicious/noExplicitAny: Dynamic builder objects
        Object.values(config.sequences).map((s: any) => (s.build ? s.build() : s))
      : [],
    comments: config.comments || [],
  };
}
