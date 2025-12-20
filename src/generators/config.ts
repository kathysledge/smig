/**
 * @fileoverview SQL generator for CONFIG (GraphQL/API) definitions.
 * @module generators/config
 */

import type { ConfigType, GraphQLTableMode } from '../schema/entities/config';
import type { GeneratorOptions } from './table';

/**
 * Config definition object (from builder's build() output).
 */
export interface ConfigDefinition {
  type: ConfigType;
  tablesMode?: GraphQLTableMode | null;
  tablesList?: string[];
  functionsMode?: GraphQLTableMode | null;
  functionsList?: string[];
  comments?: string[];
  ifNotExists?: boolean;
  overwrite?: boolean;
}

/**
 * Generates DEFINE CONFIG SQL statement.
 */
export function generateConfigDefinition(
  config: ConfigDefinition,
  options: GeneratorOptions = {},
): string {
  const parts: string[] = ['DEFINE CONFIG'];

  // IF NOT EXISTS / OVERWRITE
  if (options.ifNotExists || config.ifNotExists) {
    parts.push('IF NOT EXISTS');
  } else if (config.overwrite) {
    parts.push('OVERWRITE');
  }

  // Config type
  parts.push(config.type);

  // Tables mode
  if (config.tablesMode) {
    switch (config.tablesMode) {
      case 'AUTO':
        parts.push('TABLES AUTO');
        break;
      case 'NONE':
        parts.push('TABLES NONE');
        break;
      case 'INCLUDE':
        if (config.tablesList?.length) {
          parts.push(`TABLES INCLUDE ${config.tablesList.join(', ')}`);
        }
        break;
      case 'EXCLUDE':
        if (config.tablesList?.length) {
          parts.push(`TABLES EXCLUDE ${config.tablesList.join(', ')}`);
        }
        break;
    }
  }

  // Functions mode
  if (config.functionsMode) {
    switch (config.functionsMode) {
      case 'AUTO':
        parts.push('FUNCTIONS AUTO');
        break;
      case 'NONE':
        parts.push('FUNCTIONS NONE');
        break;
      case 'INCLUDE':
        if (config.functionsList?.length) {
          parts.push(`FUNCTIONS INCLUDE ${config.functionsList.join(', ')}`);
        }
        break;
      case 'EXCLUDE':
        if (config.functionsList?.length) {
          parts.push(`FUNCTIONS EXCLUDE ${config.functionsList.join(', ')}`);
        }
        break;
    }
  }

  // Comment
  if (options.includeComments && config.comments?.length) {
    parts.push(`COMMENT "${config.comments[0].replace(/"/g, '\\"')}"`);
  }

  return parts.join(' ') + ';';
}

/**
 * Generates REMOVE CONFIG statement.
 */
export function generateConfigRemove(type: ConfigType): string {
  return `REMOVE CONFIG ${type};`;
}
