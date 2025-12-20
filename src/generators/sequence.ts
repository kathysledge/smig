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
  step?: number | null;
  min?: number | null;
  max?: number | null;
  cycle?: boolean;
  cache?: number | null;
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

  // Start
  if (sequence.start !== null && sequence.start !== undefined) {
    parts.push(`START ${sequence.start}`);
  }

  // Step/Increment
  if (sequence.step !== null && sequence.step !== undefined) {
    parts.push(`INCREMENT ${sequence.step}`);
  }

  // Min
  if (sequence.min !== null && sequence.min !== undefined) {
    parts.push(`MINVALUE ${sequence.min}`);
  }

  // Max
  if (sequence.max !== null && sequence.max !== undefined) {
    parts.push(`MAXVALUE ${sequence.max}`);
  }

  // Cycle
  if (sequence.cycle) {
    parts.push('CYCLE');
  } else if (sequence.cycle === false && (sequence.min !== null || sequence.max !== null)) {
    parts.push('NO CYCLE');
  }

  // Cache
  if (sequence.cache !== null && sequence.cache !== undefined) {
    parts.push(`CACHE ${sequence.cache}`);
  }

  // Comment
  if (options.includeComments && sequence.comments?.length) {
    parts.push(`COMMENT "${sequence.comments[0].replace(/"/g, '\\"')}"`);
  }

  return parts.join(' ') + ';';
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
