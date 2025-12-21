/**
 * @fileoverview SQL generator for EVENT definitions.
 * @module generators/event
 */

import type { GeneratorOptions } from './table';

/**
 * Event definition object (from builder's build() output).
 */
export interface EventDefinition {
  name: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  when?: string | null;
  thenStatement: string;
  comments?: string[];
  previousNames?: string[];
  ifNotExists?: boolean;
  overwrite?: boolean;
}

/**
 * Generates DEFINE EVENT SQL statement.
 */
export function generateEventDefinition(
  tableName: string,
  event: EventDefinition,
  options: GeneratorOptions = {},
): string {
  const parts: string[] = ['DEFINE EVENT'];

  // IF NOT EXISTS / OVERWRITE
  if (options.ifNotExists || event.ifNotExists) {
    parts.push('IF NOT EXISTS');
  } else if (event.overwrite) {
    parts.push('OVERWRITE');
  }

  // Event name
  parts.push(event.name);

  // ON TABLE
  parts.push('ON TABLE', tableName);

  // WHEN (trigger type)
  parts.push('WHEN', `$event = "${event.type}"`);

  // Additional WHEN condition
  if (event.when) {
    parts.push('AND', event.when);
  }

  // THEN
  parts.push('THEN', `(${event.thenStatement})`);

  // Comment
  if (options.includeComments && event.comments?.length) {
    parts.push(`COMMENT "${event.comments[0].replace(/"/g, '\\"')}"`);
  }

  return `${parts.join(' ')};`;
}

/**
 * Generates ALTER EVENT RENAME statement.
 */
export function generateEventRename(tableName: string, oldName: string, newName: string): string {
  return `ALTER EVENT ${oldName} ON TABLE ${tableName} RENAME TO ${newName};`;
}

/**
 * Generates REMOVE EVENT statement.
 */
export function generateEventRemove(tableName: string, eventName: string): string {
  return `REMOVE EVENT ${eventName} ON TABLE ${tableName};`;
}
