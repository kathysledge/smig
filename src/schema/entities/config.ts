/**
 * @fileoverview Config builder for SurrealDB GraphQL/API settings.
 * @module schema/entities/config
 */

/**
 * Config type enumeration.
 */
export type ConfigType = 'GRAPHQL' | 'API';

/**
 * GraphQL table mode.
 */
export type GraphQLTableMode = 'AUTO' | 'NONE' | 'INCLUDE' | 'EXCLUDE';

/**
 * Config definition builder for SurrealDB.
 *
 * Config defines settings for GraphQL and API endpoints.
 * SurrealDB 3.x supports native GraphQL with configurable schema exposure.
 *
 * @example
 * ```typescript
 * // Enable GraphQL with all tables
 * const graphql = config('GRAPHQL')
 *   .tables('AUTO')
 *   .functions('AUTO');
 *
 * // GraphQL with specific tables only
 * const limitedGraphql = config('GRAPHQL')
 *   .tables('INCLUDE', ['user', 'post', 'comment'])
 *   .functions('NONE');
 *
 * // Exclude certain tables from GraphQL
 * const filteredGraphql = config('GRAPHQL')
 *   .tables('EXCLUDE', ['internal_log', 'migrations']);
 * ```
 */
export class SurrealQLConfig {
  private config: Record<string, unknown> = {
    type: null,
    // GraphQL options
    tablesMode: null,
    tablesList: [],
    functionsMode: null,
    functionsList: [],
    // Common
    comments: [],
    ifNotExists: false,
    overwrite: false,
  };

  constructor(type: ConfigType) {
    this.config.type = type;
  }

  /** Uses IF NOT EXISTS clause when defining the config */
  ifNotExists() {
    this.config.ifNotExists = true;
    return this;
  }

  /** Uses OVERWRITE clause when redefining the config */
  overwrite() {
    this.config.overwrite = true;
    return this;
  }

  /**
   * Sets which tables to expose in GraphQL.
   *
   * @param mode - AUTO | NONE | INCLUDE | EXCLUDE
   * @param tables - List of tables (for INCLUDE/EXCLUDE modes)
   * @returns The config instance for method chaining
   */
  tables(mode: GraphQLTableMode, tables?: string[]) {
    this.config.tablesMode = mode;
    if (tables) {
      this.config.tablesList = tables;
    }
    return this;
  }

  /**
   * Sets which functions to expose in GraphQL.
   *
   * @param mode - AUTO | NONE | INCLUDE | EXCLUDE
   * @param functions - List of functions (for INCLUDE/EXCLUDE modes)
   * @returns The config instance for method chaining
   */
  functions(mode: GraphQLTableMode, functions?: string[]) {
    this.config.functionsMode = mode;
    if (functions) {
      this.config.functionsList = functions;
    }
    return this;
  }

  /** Adds a documentation comment */
  comment(text: string) {
    if (text && text.trim() !== '') {
      // biome-ignore lint/suspicious/noExplicitAny: Dynamic comment array
      (this.config.comments as any[]).push(text.trim());
    }
    return this;
  }

  /** Builds and validates the complete config definition */
  build() {
    if (!this.config.type) {
      throw new Error('Config type is required. Use config("GRAPHQL") or config("API").');
    }

    return {
      type: this.config.type,
      tablesMode: this.config.tablesMode,
      tablesList: [...(this.config.tablesList as string[])],
      functionsMode: this.config.functionsMode,
      functionsList: [...(this.config.functionsList as string[])],
      comments: [...(this.config.comments as string[])],
      ifNotExists: this.config.ifNotExists,
      overwrite: this.config.overwrite,
    };
  }
}
