/**
 * @fileoverview Entity comparison logic for functions, analyzers, scopes, etc.
 * @module migrator/comparison/entity-comparator
 */

import type { SurrealAnalyzer, SurrealFunction, SurrealScope } from '../../types/schema';

/**
 * Compares two function definitions to detect modifications.
 */
export function compareFunctions(currentFunc: SurrealFunction, newFunc: SurrealFunction): boolean {
  // Compare function body
  if (currentFunc.body !== newFunc.body) return true;

  // Compare parameters
  const currentParams = currentFunc.parameters || [];
  const newParams = newFunc.parameters || [];

  if (currentParams.length !== newParams.length) return true;

  for (let i = 0; i < newParams.length; i++) {
    if (currentParams[i].name !== newParams[i].name) return true;
    if (currentParams[i].type !== newParams[i].type) return true;
  }

  // Compare return type
  if (currentFunc.returnType !== newFunc.returnType) return true;

  // Compare permissions
  if (currentFunc.permissions !== newFunc.permissions) return true;

  return false;
}

/**
 * Compares two scope/access definitions to detect modifications.
 */
export function compareScopes(currentScope: SurrealScope, newScope: SurrealScope): boolean {
  // Compare session duration
  if (currentScope.session !== newScope.session) return true;

  // Compare signup logic
  if (currentScope.signup !== newScope.signup) return true;

  // Compare signin logic
  if (currentScope.signin !== newScope.signin) return true;

  return false;
}

/**
 * Compares two analyzer definitions to detect modifications.
 */
export function compareAnalyzers(
  currentAnalyzer: SurrealAnalyzer,
  newAnalyzer: SurrealAnalyzer,
): boolean {
  // Compare tokenizers
  const currentTokenizers = currentAnalyzer.tokenizers || [];
  const newTokenizers = newAnalyzer.tokenizers || [];

  if (currentTokenizers.length !== newTokenizers.length) return true;
  if (currentTokenizers.join(',') !== newTokenizers.join(',')) return true;

  // Compare filters
  const currentFilters = currentAnalyzer.filters || [];
  const newFilters = newAnalyzer.filters || [];

  if (currentFilters.length !== newFilters.length) return true;
  if (currentFilters.join(',') !== newFilters.join(',')) return true;

  return false;
}

/**
 * Detects if an entity has been renamed by checking the .was property.
 *
 * @param newEntity - The new entity definition
 * @param currentEntities - All current entities in the database
 * @param nameKey - The key used for the entity name (default: 'name')
 * @returns The old entity name if renamed, null otherwise
 */
export function detectEntityRename<T extends Record<string, unknown>>(
  newEntity: T,
  currentEntities: T[],
  nameKey = 'name',
): string | null {
  const previousName = newEntity.was as string | string[] | undefined;

  if (!previousName) return null;

  const previousNames = Array.isArray(previousName) ? previousName : [previousName];

  for (const oldName of previousNames) {
    const oldEntity = currentEntities.find((e) => e[nameKey] === oldName);
    if (oldEntity) {
      return oldName;
    }
  }

  return null;
}
