/**
 * @fileoverview SQL generator for TABLE definitions.
 * @module generators/table
 */

import type { TableSchema } from '../schema/entities/table';

/**
 * Options for SQL generation.
 */
export interface GeneratorOptions {
  /** Use ALTER instead of OVERWRITE when possible */
  useAlter?: boolean;
  /** Include IF NOT EXISTS clause */
  ifNotExists?: boolean;
  /** Include COMMENT clauses */
  includeComments?: boolean;
}

/**
 * Generates DEFINE TABLE SQL statement.
 */
export function generateTableDefinition(
  table: TableSchema,
  options: GeneratorOptions = {},
): string {
  const parts: string[] = ['DEFINE TABLE'];

  // IF NOT EXISTS
  if (options.ifNotExists || (table as any).ifNotExists) {
    parts.push('IF NOT EXISTS');
  }

  // Table name
  parts.push(table.name);

  // DROP (records are deleted when table is removed)
  if (table.drop) {
    parts.push('DROP');
  }

  // Table type (NORMAL, RELATION, ANY)
  if (table.type && table.type !== 'NORMAL') {
    parts.push('TYPE', table.type);

    // For RELATION type, add IN/OUT constraints
    if (table.type === 'RELATION') {
      if (table.from) {
        parts.push(`IN ${table.from}`);
      }
      if (table.to) {
        parts.push(`OUT ${table.to}`);
      }
      if ((table as any).enforced) {
        parts.push('ENFORCED');
      }
    }
  }

  // Schema mode
  if (table.schemafull) {
    parts.push('SCHEMAFULL');
  } else {
    parts.push('SCHEMALESS');
  }

  // View (AS SELECT)
  if (table.as) {
    parts.push('AS', table.as);
  }

  // Changefeed
  if (table.changefeedDuration) {
    parts.push(`CHANGEFEED ${table.changefeedDuration}`);
    if (table.changefeedIncludeOriginal) {
      parts.push('INCLUDE ORIGINAL');
    }
  }

  // Permissions
  if (table.permissions) {
    const perms = table.permissions;
    if (typeof perms === 'string') {
      parts.push(`PERMISSIONS ${perms}`);
    } else if (typeof perms === 'object') {
      const permParts: string[] = [];
      const p = perms as Record<string, string>;
      if (p.select) permParts.push(`FOR select ${p.select}`);
      if (p.create) permParts.push(`FOR create ${p.create}`);
      if (p.update) permParts.push(`FOR update ${p.update}`);
      if (p.delete) permParts.push(`FOR delete ${p.delete}`);
      if (permParts.length > 0) {
        parts.push('PERMISSIONS', permParts.join(', '));
      }
    }
  }

  // Comment
  if (options.includeComments && (table.comments?.length || (table as any).comment)) {
    const comment = (table as any).comment || table.comments?.[0];
    if (comment) {
      parts.push(`COMMENT "${comment.replace(/"/g, '\\"')}"`);
    }
  }

  return `${parts.join(' ')};`;
}

/**
 * Generates ALTER TABLE RENAME statement.
 */
export function generateTableRename(oldName: string, newName: string): string {
  return `ALTER TABLE ${oldName} RENAME TO ${newName};`;
}

/**
 * Generates REMOVE TABLE statement.
 */
export function generateTableRemove(tableName: string): string {
  return `REMOVE TABLE ${tableName};`;
}
