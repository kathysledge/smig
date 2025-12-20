/**
 * @fileoverview Common utilities for SurrealDB schema definition.
 * @module schema/common/utils
 */

import dedent from 'dedent';

/**
 * Processes SurrealQL strings through dedent for consistent formatting.
 *
 * This helper function handles both single-line and multi-line SurrealQL strings,
 * applying dedent formatting only to multi-line strings to preserve intentional
 * indentation while removing unintentional leading whitespace.
 */
export function processSurrealQL(input: string): string {
  // Only process multi-line strings through dedent
  if (input.includes('\n')) {
    return dedent`${input}`;
  }
  return input.trim();
}

/**
 * Validates that a name is a valid SurrealDB identifier.
 *
 * @param name - The name to validate
 * @param entityType - Type of entity for error message (e.g., 'event', 'function')
 * @throws Error if name is invalid
 */
export function validateIdentifier(name: string, entityType: string): void {
  const lowerType = entityType.toLowerCase();
  if (!name || name.trim() === '') {
    throw new Error(`${entityType} name is required and cannot be empty`);
  }

  const trimmed = name.trim();
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
    throw new Error(
      `Invalid ${lowerType} name '${trimmed}'. Must be a valid SurrealDB identifier (letters, numbers, underscores only, cannot start with number).`,
    );
  }
}

/**
 * Validates a function name which can include 'fn::' prefix.
 *
 * @param name - The function name to validate
 * @throws Error if name is invalid
 */
export function validateFunctionName(name: string): void {
  if (!name || name.trim() === '') {
    throw new Error('Function name is required and cannot be empty');
  }

  const trimmed = name.trim();

  // Allow 'fn::' prefix format
  if (trimmed.startsWith('fn::')) {
    const localName = trimmed.substring(4);
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(localName)) {
      throw new Error(
        `Invalid function name '${trimmed}'. After 'fn::', must be a valid identifier (letters, numbers, underscores only, cannot start with number).`,
      );
    }
  } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
    throw new Error(
      `Invalid function name '${trimmed}'. Must be a valid identifier or start with 'fn::' (letters, numbers, underscores only, cannot start with number).`,
    );
  }
}
