/**
 * @fileoverview SQL generator for FIELD definitions.
 * @module generators/field
 */

import type { GeneratorOptions } from './table';

/**
 * Field definition object (from builder's build() output).
 */
export interface FieldDefinition {
  name: string;
  type: string;
  optional?: boolean;
  readonly?: boolean;
  flexible?: boolean;
  ifNotExists?: boolean;
  overwrite?: boolean;
  default?: unknown;
  defaultAlways?: boolean;
  value?: string;
  assert?: string;
  permissions?: string;
  comment?: string;
  reference?: string;
  onDelete?: string;
  previousNames?: string[];
}

/**
 * Formats a value for SQL output.
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NONE';
  }
  if (typeof value === 'string') {
    // Check if it looks like a SurrealQL expression (function call, variable, etc.)
    if (
      value.includes('(') ||
      value.startsWith('$') ||
      value.startsWith('{') ||
      value.startsWith('<')
    ) {
      return value;
    }
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(formatValue).join(', ')}]`;
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Generates DEFINE FIELD SQL statement.
 */
export function generateFieldDefinition(
  tableName: string,
  field: FieldDefinition,
  options: GeneratorOptions = {},
): string {
  const parts: string[] = ['DEFINE FIELD'];

  // IF NOT EXISTS / OVERWRITE
  if (options.ifNotExists || field.ifNotExists) {
    parts.push('IF NOT EXISTS');
  } else if (field.overwrite) {
    parts.push('OVERWRITE');
  }

  // Field name and table
  parts.push(field.name, 'ON TABLE', tableName);

  // Type
  if (field.flexible) {
    parts.push(`FLEXIBLE TYPE ${field.type}`);
  } else {
    parts.push(`TYPE ${field.type}`);
  }

  // Default value
  if (field.default !== null && field.default !== undefined) {
    if (field.defaultAlways) {
      parts.push(`DEFAULT ALWAYS ${formatValue(field.default)}`);
    } else {
      parts.push(`DEFAULT ${formatValue(field.default)}`);
    }
  }

  // Computed value
  if (field.value) {
    parts.push(`VALUE ${field.value}`);
  }

  // Readonly
  if (field.readonly) {
    parts.push('READONLY');
  }

  // Reference (SurrealDB 3.x)
  if (field.reference) {
    parts.push(`REFERENCES ${field.reference}`);
    if (field.onDelete) {
      parts.push(`ON DELETE ${field.onDelete}`);
    }
  }

  // Assertion
  if (field.assert) {
    parts.push(`ASSERT ${field.assert}`);
  }

  // Permissions
  if (field.permissions && field.permissions !== 'FULL') {
    parts.push(`PERMISSIONS ${field.permissions}`);
  }

  // Comment
  if (options.includeComments && field.comment) {
    parts.push(`COMMENT "${field.comment.replace(/"/g, '\\"')}"`);
  }

  return parts.join(' ') + ';';
}

/**
 * Generates ALTER FIELD statement (for modifications).
 */
export function generateFieldAlter(
  tableName: string,
  fieldName: string,
  changes: Partial<FieldDefinition>,
): string {
  const parts: string[] = ['ALTER FIELD', fieldName, 'ON TABLE', tableName];

  if (changes.type) {
    parts.push(`TYPE ${changes.type}`);
  }
  if (changes.default !== undefined) {
    if (changes.defaultAlways) {
      parts.push(`DEFAULT ALWAYS ${formatValue(changes.default)}`);
    } else {
      parts.push(`DEFAULT ${formatValue(changes.default)}`);
    }
  }
  if (changes.value !== undefined) {
    parts.push(`VALUE ${changes.value}`);
  }
  if (changes.readonly !== undefined) {
    parts.push(changes.readonly ? 'READONLY' : 'NOT READONLY');
  }
  if (changes.assert !== undefined) {
    parts.push(`ASSERT ${changes.assert}`);
  }
  if (changes.permissions !== undefined) {
    parts.push(`PERMISSIONS ${changes.permissions}`);
  }
  if (changes.comment !== undefined) {
    parts.push(`COMMENT "${changes.comment.replace(/"/g, '\\"')}"`);
  }

  return parts.join(' ') + ';';
}

/**
 * Generates ALTER FIELD RENAME statement.
 */
export function generateFieldRename(tableName: string, oldName: string, newName: string): string {
  return `ALTER FIELD ${oldName} ON TABLE ${tableName} RENAME TO ${newName};`;
}

/**
 * Generates REMOVE FIELD statement.
 */
export function generateFieldRemove(tableName: string, fieldName: string): string {
  return `REMOVE FIELD ${fieldName} ON TABLE ${tableName};`;
}
