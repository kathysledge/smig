/**
 * @fileoverview SQL generator for FUNCTION definitions.
 * @module generators/function
 */

import type { GeneratorOptions } from './table';

/**
 * Function parameter definition.
 */
export interface FunctionParameter {
  name: string;
  type: string;
}

/**
 * Function definition object (from builder's build() output).
 */
export interface FunctionDefinition {
  name: string;
  parameters: FunctionParameter[];
  returnType?: string | null;
  body: string;
  comments?: string[];
  previousNames?: string[];
  ifNotExists?: boolean;
  overwrite?: boolean;
  permissions?: string | null;
}

/**
 * Generates DEFINE FUNCTION SQL statement.
 */
export function generateFunctionDefinition(
  func: FunctionDefinition,
  options: GeneratorOptions = {},
): string {
  const parts: string[] = ['DEFINE FUNCTION'];

  // IF NOT EXISTS / OVERWRITE
  if (options.ifNotExists || func.ifNotExists) {
    parts.push('IF NOT EXISTS');
  } else if (func.overwrite) {
    parts.push('OVERWRITE');
  }

  // Function name (ensure fn:: prefix)
  const name = func.name.startsWith('fn::') ? func.name : `fn::${func.name}`;
  parts.push(name);

  // Parameters
  const params = func.parameters.map((p) => `$${p.name}: ${p.type}`).join(', ');
  parts.push(`(${params})`);

  // Return type
  if (func.returnType) {
    parts.push(`-> ${func.returnType}`);
  }

  // Body
  parts.push('{', func.body, '}');

  // Permissions (SurrealDB 3.x)
  if (func.permissions) {
    parts.push(`PERMISSIONS ${func.permissions}`);
  }

  // Comment
  if (options.includeComments && func.comments?.length) {
    parts.push(`COMMENT "${func.comments[0].replace(/"/g, '\\"')}"`);
  }

  return `${parts.join(' ')};`;
}

/**
 * Generates ALTER FUNCTION RENAME statement.
 */
export function generateFunctionRename(oldName: string, newName: string): string {
  const oldFn = oldName.startsWith('fn::') ? oldName : `fn::${oldName}`;
  const newFn = newName.startsWith('fn::') ? newName : `fn::${newName}`;
  return `ALTER FUNCTION ${oldFn} RENAME TO ${newFn};`;
}

/**
 * Generates REMOVE FUNCTION statement.
 */
export function generateFunctionRemove(name: string): string {
  const fnName = name.startsWith('fn::') ? name : `fn::${name}`;
  return `REMOVE FUNCTION ${fnName};`;
}
