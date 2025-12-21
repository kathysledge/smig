/**
 * @fileoverview Normalization utilities for schema comparison.
 * @module migrator/comparison/normalize
 */

/**
 * Normalizes permissions for comparison.
 * Handles FULL as default, removes deprecated DELETE permission,
 * and normalizes whitespace/formatting.
 */
export function normalizePermissions(perm: unknown): string {
  if (perm === null || perm === undefined || perm === '') return 'FULL';
  let normalized = String(perm).replace(/\s+/g, ' ').trim().toUpperCase();

  // FULL is the default - normalize to FULL
  if (normalized === 'FULL' || normalized === '' || normalized === 'NONE') return 'FULL';

  // SurrealDB drops DELETE from field permissions (deprecated)
  normalized = normalized.replace(/,?\s*DELETE\s*,?/gi, ' ');

  // SurrealDB normalizes "FOR x FOR y" to "FOR x, FOR y"
  normalized = normalized.replace(/(\S)\s+FOR\s+/g, '$1, FOR ');

  // Remove comma before WHERE
  normalized = normalized.replace(/,\s+WHERE\b/gi, ' WHERE');

  // Clean up whitespace and commas
  normalized = normalized.replace(/\s+/g, ' ');
  normalized = normalized.replace(/,\s*,+/g, ',');
  normalized = normalized.replace(/\s*,\s*/g, ', ');
  normalized = normalized.replace(/^,\s*/, '');
  normalized = normalized.replace(/,\s*$/, '');

  return normalized.trim();
}

/**
 * Normalizes default values for comparison.
 * Handles database string representation vs schema objects/arrays.
 * Also normalizes quote styles (SurrealDB uses single quotes internally).
 */
export function normalizeDefault(value: unknown): string {
  if (value === null || value === undefined) return '';

  if (typeof value === 'string') {
    let normalized = value;
    // Remove outer quotes that SurrealDB may add
    if (
      (normalized.startsWith("'") && normalized.endsWith("'")) ||
      (normalized.startsWith('"') && normalized.endsWith('"'))
    ) {
      normalized = normalized.slice(1, -1);
    }
    // Normalize internal quotes to single quotes for comparison
    // e.g., sequence::nextval("order_number") -> sequence::nextval('order_number')
    normalized = normalized.replace(/"([^"\\]*)"/g, "'$1'");
    return normalized;
  }

  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Normalizes comment values for comparison.
 */
export function normalizeComment(comment: unknown): string | null {
  if (comment === null || comment === undefined || comment === 'null' || comment === 'undefined') {
    return null;
  }
  return String(comment);
}

/**
 * Normalizes whitespace and syntax differences in expressions.
 * Used for comparing VALUE and ASSERT expressions.
 */
export function normalizeExpression(value: unknown): string {
  if (value === null || value === undefined) return '';

  let normalized = String(value).replace(/\s+/g, ' ').trim();

  // Remove parentheses around SELECT statements
  normalized = normalized.replace(/RETURN\s+\(\s*SELECT\s+/g, 'RETURN SELECT ');
  normalized = normalized.replace(/\)\s*;?\s*\}/g, ' }');
  normalized = normalized.replace(/;\s*\}/g, ' }');

  // Normalize quote styles in arrays
  normalized = normalized.replace(/\[([^\]]*)\]/g, (_match, contents) => {
    const normalizedContents = contents.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, "'$1'");
    return `[${normalizedContents}]`;
  });

  // Normalize duration values (1w = 7d)
  normalized = normalized.replace(/\b(\d+)w\b/g, (_, num) => `${parseInt(num, 10) * 7}d`);

  // Remove unnecessary parentheses
  let prevNormalized = '';
  while (prevNormalized !== normalized) {
    prevNormalized = normalized;
    normalized = normalized.replace(
      /\((\$[a-zA-Z_][a-zA-Z0-9_.]*\s*[!=<>]+\s*[A-Z0-9_]+)\)\s*(AND|OR)/gi,
      '$1 $2',
    );
    normalized = normalized.replace(
      /(AND|OR)\s+\((\$[a-zA-Z_][a-zA-Z0-9_.]*\s*[!=<>]+\s*[A-Z0-9_]+)\)$/gi,
      '$1 $2',
    );
    normalized = normalized.replace(/\((\$[a-zA-Z_][a-zA-Z0-9_.]*\s*[<>=!]+\s*\d+)\)/gi, '$1');
    normalized = normalized.replace(/\(([a-zA-Z_:]+\([^()]+\)\s*[!=<>]+\s*\d+)\)/g, '$1');
    normalized = normalized.replace(/\(([a-zA-Z_:]+\([^()]+\))\)/g, '$1');
  }

  return normalized;
}

/**
 * Normalizes a type string for comparison.
 * Handles optional types, whitespace, and generic syntax differences.
 */
export function normalizeType(type: unknown): string {
  if (type === null || type === undefined) return 'any';

  let normalized = String(type).replace(/\s+/g, ' ').trim().toLowerCase();

  // Normalize option<T> vs T? syntax if needed
  // SurrealDB uses option<type> internally
  normalized = normalized.replace(/(\w+)\?$/g, 'option<$1>');

  return normalized;
}

/**
 * Converts SurrealDB array quote styles.
 */
export function toSurrealQuotes(value: string): string {
  return value.replace(/\[([^\]]*)\]/g, (_match, contents) => {
    const normalized = contents.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, "'$1'");
    return `[${normalized}]`;
  });
}

/**
 * Serializes a default value for SQL generation.
 */
export function serializeDefaultValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'NONE';
  }

  if (typeof value === 'string') {
    // Check if it's a function call or expression (doesn't need quotes)
    if (
      value.includes('::') ||
      value.includes('(') ||
      value === 'NONE' ||
      value === 'NULL' ||
      value === 'true' ||
      value === 'false'
    ) {
      return value;
    }
    // Literal string value - wrap in quotes
    return `'${value.replace(/'/g, "\\'")}'`;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}
