/**
 * @fileoverview Field definition parser for SurrealDB schema introspection.
 * @module migrator/introspection/field-parser
 */

/**
 * Regex patterns for parsing field definitions from SurrealDB INFO commands.
 */
export const FIELD_PATTERNS = {
  // Match TYPE clause - capture everything until next keyword or end
  // Handles: TYPE string, TYPE option<string>, TYPE none | string, TYPE record<user | post>
  type: /(?:FLEXIBLE\s+)?TYPE\s+([^\s;]+(?:<[^>]+>)?(?:\s*\|\s*[^\s;]+(?:<[^>]+>)?)*)/,
  // Match optional types - both option<T> and none | T formats
  optional: /TYPE\s+(?:option<|none\s*\|)/i,
  readonly: /\bREADONLY\b/i,
  flexible: /\bFLEXIBLE\b/i,
  ifNotExists: /\bIF\s+NOT\s+EXISTS\b/i,
  overwrite: /\bOVERWRITE\b/i,
  // Match ASSERT - capture until PERMISSIONS, COMMENT, READONLY, or end
  assert: /ASSERT\s+(.+?)(?:\s+(?:PERMISSIONS|COMMENT|READONLY)\s|$)/,
  // Match DEFAULT - capture until ASSERT, PERMISSIONS, COMMENT, FLEXIBLE, VALUE, or end
  default:
    /DEFAULT\s+(?:ALWAYS\s+)?(.+?)(?:\s+(?:ASSERT|VALUE|PERMISSIONS|COMMENT|FLEX(?:IBLE)?|READONLY)\s|$)/,
  permissions: /PERMISSIONS\s+(.+?)(?:\s+COMMENT\s|$)/,
  comment: /COMMENT\s+"([^"]+)"/,
  reference: /REFERENCES\s+(\w+)/i,
  onDelete: /ON\s+DELETE\s+(CASCADE|SET\s+NULL|SET\s+DEFAULT|RESTRICT)/i,
  defaultAlways: /DEFAULT\s+ALWAYS\s+/i,
} as const;

/**
 * Extracts the field type from a field definition string.
 */
export function extractFieldType(fieldDef: string): string {
  const typeMatch = fieldDef.match(FIELD_PATTERNS.type);
  return typeMatch ? typeMatch[1].trim() : 'string';
}

/**
 * Checks if a field is optional (option<type>).
 */
export function isFieldOptional(fieldDef: string): boolean {
  return FIELD_PATTERNS.optional.test(fieldDef);
}

/**
 * Checks if a field is read-only.
 */
export function isFieldReadonly(fieldDef: string): boolean {
  return FIELD_PATTERNS.readonly.test(fieldDef);
}

/**
 * Checks if a field is flexible type.
 */
export function isFieldFlexible(fieldDef: string): boolean {
  return FIELD_PATTERNS.flexible.test(fieldDef);
}

/**
 * Checks if the field uses IF NOT EXISTS.
 */
export function hasIfNotExists(fieldDef: string): boolean {
  return FIELD_PATTERNS.ifNotExists.test(fieldDef);
}

/**
 * Checks if the field uses OVERWRITE.
 */
export function hasOverwrite(fieldDef: string): boolean {
  return FIELD_PATTERNS.overwrite.test(fieldDef);
}

/**
 * Extracts the default value from a field definition.
 */
export function extractFieldDefault(fieldDef: string): string | null {
  const defaultMatch = fieldDef.match(FIELD_PATTERNS.default);
  return defaultMatch ? defaultMatch[1].trim() : null;
}

/**
 * Checks if the field uses DEFAULT ALWAYS.
 */
export function hasDefaultAlways(fieldDef: string): boolean {
  return FIELD_PATTERNS.defaultAlways.test(fieldDef);
}

/**
 * Extracts the computed VALUE expression from a field definition.
 * Handles both SurrealDB v2 <future> syntax and v3 { } syntax.
 */
export function extractFieldValue(fieldDef: string): string | null {
  // Check if there's a VALUE clause
  const valueIndex = fieldDef.indexOf('VALUE ');
  if (valueIndex === -1) return null;

  // Start after "VALUE "
  const start = valueIndex + 6;
  let value = '';
  let braceDepth = 0;
  let inFuture = false;

  // Scan through the string character by character
  for (let i = start; i < fieldDef.length; i++) {
    const char = fieldDef[i];

    // Check if we're starting a <future> block (SurrealDB v2 syntax)
    if (!inFuture && fieldDef.substring(i, i + 8) === '<future>') {
      inFuture = true;
    }

    // Track brace depth - also handle SurrealDB v3 computed fields { }
    if (char === '{') {
      braceDepth++;
      // If this is the first brace at the start of value, it's a computed expression
      if (braceDepth === 1 && value.trim() === '') {
        inFuture = true; // Treat { } blocks like <future> blocks for parsing
      }
    } else if (char === '}') {
      braceDepth--;
      // If we close all braces in a future/computed block, we're done with the value
      if (inFuture && braceDepth === 0) {
        value += char;
        break;
      }
    }

    // If not in a future/computed block and we hit a keyword, stop
    if (braceDepth === 0 && !inFuture) {
      const remaining = fieldDef.substring(i);
      if (/^\s+(ASSERT|DEFAULT|PERMISSIONS|COMMENT|FLEX(?:IBLE)?)\s/.test(remaining)) {
        break;
      }
    }

    value += char;
  }

  return value.trim() || null;
}

/**
 * Extracts the ASSERT condition from a field definition.
 */
export function extractFieldAssert(fieldDef: string): string | null {
  const assertMatch = fieldDef.match(FIELD_PATTERNS.assert);
  return assertMatch ? assertMatch[1].trim() : null;
}

/**
 * Extracts the PERMISSIONS clause from a field definition.
 */
export function extractFieldPermissions(fieldDef: string): string | null {
  const permissionsMatch = fieldDef.match(FIELD_PATTERNS.permissions);
  return permissionsMatch ? permissionsMatch[1].trim() : null;
}

/**
 * Extracts the COMMENT from a field definition.
 */
export function extractFieldComment(fieldDef: string): string | null {
  const commentMatch = fieldDef.match(FIELD_PATTERNS.comment);
  return commentMatch ? commentMatch[1].trim() : null;
}

/**
 * Extracts the REFERENCES table from a field definition (SurrealDB 3.x).
 */
export function extractFieldReference(fieldDef: string): string | null {
  const refMatch = fieldDef.match(FIELD_PATTERNS.reference);
  return refMatch ? refMatch[1].trim() : null;
}

/**
 * Extracts the ON DELETE action from a field definition (SurrealDB 3.x).
 */
export function extractFieldOnDelete(fieldDef: string): string | null {
  const onDeleteMatch = fieldDef.match(FIELD_PATTERNS.onDelete);
  return onDeleteMatch ? onDeleteMatch[1].trim() : null;
}

/**
 * Parses a complete field definition string into a structured object.
 */
export function parseFieldDefinition(fieldName: string, fieldDef: string): Record<string, unknown> {
  return {
    name: fieldName,
    type: extractFieldType(fieldDef),
    optional: isFieldOptional(fieldDef),
    readonly: isFieldReadonly(fieldDef),
    flexible: isFieldFlexible(fieldDef),
    ifNotExists: hasIfNotExists(fieldDef),
    overwrite: hasOverwrite(fieldDef),
    default: extractFieldDefault(fieldDef),
    defaultAlways: hasDefaultAlways(fieldDef),
    value: extractFieldValue(fieldDef),
    assert: extractFieldAssert(fieldDef),
    permissions: extractFieldPermissions(fieldDef),
    comment: extractFieldComment(fieldDef),
    reference: extractFieldReference(fieldDef),
    onDelete: extractFieldOnDelete(fieldDef),
  };
}
