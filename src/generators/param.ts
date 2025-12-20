/**
 * @fileoverview SQL generator for PARAM definitions.
 * @module generators/param
 */

import type { GeneratorOptions } from './table';

/**
 * Param definition object (from builder's build() output).
 */
export interface ParamDefinition {
  name: string;
  value: string;
  comments?: string[];
  previousNames?: string[];
  ifNotExists?: boolean;
  overwrite?: boolean;
}

/**
 * Generates DEFINE PARAM SQL statement.
 */
export function generateParamDefinition(
  param: ParamDefinition,
  options: GeneratorOptions = {},
): string {
  const parts: string[] = ['DEFINE PARAM'];

  // IF NOT EXISTS / OVERWRITE
  if (options.ifNotExists || param.ifNotExists) {
    parts.push('IF NOT EXISTS');
  } else if (param.overwrite) {
    parts.push('OVERWRITE');
  }

  // Param name (ensure $ prefix)
  const name = param.name.startsWith('$') ? param.name : `$${param.name}`;
  parts.push(name);

  // Value
  parts.push('VALUE', param.value);

  // Comment
  if (options.includeComments && param.comments?.length) {
    parts.push(`COMMENT "${param.comments[0].replace(/"/g, '\\"')}"`);
  }

  return parts.join(' ') + ';';
}

/**
 * Generates ALTER PARAM RENAME statement.
 */
export function generateParamRename(oldName: string, newName: string): string {
  const old$ = oldName.startsWith('$') ? oldName : `$${oldName}`;
  const new$ = newName.startsWith('$') ? newName : `$${newName}`;
  return `ALTER PARAM ${old$} RENAME TO ${new$};`;
}

/**
 * Generates REMOVE PARAM statement.
 */
export function generateParamRemove(name: string): string {
  const $name = name.startsWith('$') ? name : `$${name}`;
  return `REMOVE PARAM ${$name};`;
}
