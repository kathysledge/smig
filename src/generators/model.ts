/**
 * @fileoverview SQL generator for MODEL (ML) definitions.
 * @module generators/model
 */

import type { GeneratorOptions } from './table';

/**
 * Model definition object (from builder's build() output).
 */
export interface ModelDefinition {
  name: string;
  version?: string | null;
  permission?: string | null;
  comments?: string[];
  previousNames?: string[];
  ifNotExists?: boolean;
  overwrite?: boolean;
}

/**
 * Generates DEFINE MODEL SQL statement.
 *
 * Note: MODEL definitions typically require additional ML-specific
 * setup that is outside the scope of schema migrations.
 */
export function generateModelDefinition(
  model: ModelDefinition,
  options: GeneratorOptions = {},
): string {
  const parts: string[] = ['DEFINE MODEL'];

  // IF NOT EXISTS / OVERWRITE
  if (options.ifNotExists || model.ifNotExists) {
    parts.push('IF NOT EXISTS');
  } else if (model.overwrite) {
    parts.push('OVERWRITE');
  }

  // Model name with version
  if (model.version) {
    parts.push(`ml::${model.name}<${model.version}>`);
  } else {
    parts.push(`ml::${model.name}`);
  }

  // Permission
  if (model.permission) {
    parts.push(`PERMISSION ${model.permission}`);
  }

  // Comment
  if (options.includeComments && model.comments?.length) {
    parts.push(`COMMENT "${model.comments[0].replace(/"/g, '\\"')}"`);
  }

  return parts.join(' ') + ';';
}

/**
 * Generates REMOVE MODEL statement.
 */
export function generateModelRemove(name: string, version?: string): string {
  if (version) {
    return `REMOVE MODEL ml::${name}<${version}>;`;
  }
  return `REMOVE MODEL ml::${name};`;
}
