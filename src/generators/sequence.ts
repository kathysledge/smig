/**
 * @fileoverview SQL generator for SEQUENCE definitions.
 * @module generators/sequence
 */

import type { GeneratorOptions } from './table';

/**
 * Sequence definition object (from builder's build() output).
 */
export interface SequenceDefinition {
  name: string;
  start?: number | null;
  comments?: string[];
  previousNames?: string[];
  ifNotExists?: boolean;
  overwrite?: boolean;
}

/**
 * Generates DEFINE SEQUENCE SQL statement.
 */
export function generateSequenceDefinition(
  sequence: SequenceDefinition,
  options: GeneratorOptions = {},
): string {
  const parts: string[] = ['DEFINE SEQUENCE'];

  // IF NOT EXISTS / OVERWRITE
  if (options.ifNotExists || sequence.ifNotExists) {
    parts.push('IF NOT EXISTS');
  } else if (sequence.overwrite) {
    parts.push('OVERWRITE');
  }

  // Sequence name
  parts.push(sequence.name);

  // Start - SurrealDB 3.x only supports START, not INCREMENT/STEP/MIN/MAX/CYCLE/CACHE
  if (sequence.start !== null && sequence.start !== undefined) {
    parts.push(`START ${sequence.start}`);
  }

  // Comment
  if (options.includeComments && sequence.comments?.length) {
    parts.push(`COMMENT "${sequence.comments[0].replace(/"/g, '\\"')}"`);
  }

  return `${parts.join(' ')};`;
}

/**
 * Generates ALTER SEQUENCE RENAME statement.
 */
export function generateSequenceRename(oldName: string, newName: string): string {
  return `ALTER SEQUENCE ${oldName} RENAME TO ${newName};`;
}

/**
 * Generates REMOVE SEQUENCE statement.
 */
export function generateSequenceRemove(name: string): string {
  return `REMOVE SEQUENCE ${name};`;
}
