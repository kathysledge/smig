/**
 * @fileoverview Rename detection for schema migrations.
 * @module migrator/comparison/rename-detector
 *
 * ## Why Track Renames?
 *
 * When you rename a table from `users` to `customers`, there are two ways to
 * handle this in a migration:
 *
 * 1. **Drop and Create** (data loss):
 *    ```sql
 *    REMOVE TABLE users;
 *    DEFINE TABLE customers SCHEMAFULL;
 *    -- All user data is lost!
 *    ```
 *
 * 2. **ALTER RENAME** (data preserved):
 *    ```sql
 *    ALTER TABLE users RENAME TO customers;
 *    -- All data is preserved!
 *    ```
 *
 * The `.was()` method on schema builders allows you to tell smig about
 * previous names, so it can generate the correct ALTER RENAME statement
 * instead of destructive drop/create.
 *
 * ## Usage Example
 *
 * ```typescript
 * // In your schema definition
 * const customers = defineSchema({
 *   table: 'customers',
 *   was: 'users', // Previously named 'users'
 *   fields: {
 *     fullName: string().was('name'), // Field was renamed too
 *   }
 * });
 * ```
 */

import { debugLog } from '../../utils/debug-logger';

/**
 * Result of rename detection for a schema element.
 */
export interface RenameDetection {
  isRenamed: boolean;
  oldName: string | null;
  newName: string;
}

/**
 * Detects if a table has been renamed based on the `was` property.
 *
 * @param newTable - The new table definition
 * @param currentTables - Current tables in the database
 * @returns Rename detection result
 */
export function detectTableRename(
  newTable: { name: string; was?: string | string[] },
  currentTables: Array<{ name: string }>,
): RenameDetection {
  const result: RenameDetection = {
    isRenamed: false,
    oldName: null,
    newName: newTable.name,
  };

  if (!newTable.was) return result;

  const previousNames = Array.isArray(newTable.was) ? newTable.was : [newTable.was];

  for (const oldName of previousNames) {
    const existsInDb = currentTables.some((t) => t.name === oldName);
    const newNameExists = currentTables.some((t) => t.name === newTable.name);

    // If old name exists but new name doesn't, it's a rename
    if (existsInDb && !newNameExists) {
      result.isRenamed = true;
      result.oldName = oldName;
      debugLog(`Detected table rename: ${oldName} -> ${newTable.name}`);
      break;
    }
  }

  return result;
}

/**
 * Detects if a field has been renamed based on the `previousName` property.
 *
 * @param tableName - The table containing the field
 * @param newField - The new field definition
 * @param currentFields - Current fields in the database table
 * @returns Rename detection result
 */
export function detectFieldRename(
  tableName: string,
  newField: { name: string; previousName?: string | string[] },
  currentFields: Array<{ name: string }>,
): RenameDetection {
  const result: RenameDetection = {
    isRenamed: false,
    oldName: null,
    newName: newField.name,
  };

  if (!newField.previousName) return result;

  const previousNames = Array.isArray(newField.previousName)
    ? newField.previousName
    : [newField.previousName];

  for (const oldName of previousNames) {
    const existsInDb = currentFields.some((f) => f.name === oldName);
    const newNameExists = currentFields.some((f) => f.name === newField.name);

    // If old name exists but new name doesn't, it's a rename
    if (existsInDb && !newNameExists) {
      result.isRenamed = true;
      result.oldName = oldName;
      debugLog(`Detected field rename: ${tableName}.${oldName} -> ${tableName}.${newField.name}`);
      break;
    }
  }

  return result;
}

/**
 * Detects if an index has been renamed.
 */
export function detectIndexRename(
  tableName: string,
  newIndex: { name: string; previousName?: string | string[] },
  currentIndexes: Array<{ name: string }>,
): RenameDetection {
  const result: RenameDetection = {
    isRenamed: false,
    oldName: null,
    newName: newIndex.name,
  };

  if (!newIndex.previousName) return result;

  const previousNames = Array.isArray(newIndex.previousName)
    ? newIndex.previousName
    : [newIndex.previousName];

  for (const oldName of previousNames) {
    const existsInDb = currentIndexes.some((i) => i.name === oldName);
    const newNameExists = currentIndexes.some((i) => i.name === newIndex.name);

    if (existsInDb && !newNameExists) {
      result.isRenamed = true;
      result.oldName = oldName;
      debugLog(`Detected index rename: ${tableName}.${oldName} -> ${tableName}.${newIndex.name}`);
      break;
    }
  }

  return result;
}

/**
 * Detects if a function has been renamed.
 */
export function detectFunctionRename(
  newFunc: { name: string; was?: string | string[] },
  currentFunctions: Array<{ name: string }>,
): RenameDetection {
  const result: RenameDetection = {
    isRenamed: false,
    oldName: null,
    newName: newFunc.name,
  };

  if (!newFunc.was) return result;

  const previousNames = Array.isArray(newFunc.was) ? newFunc.was : [newFunc.was];

  for (const oldName of previousNames) {
    const existsInDb = currentFunctions.some((f) => f.name === oldName);
    const newNameExists = currentFunctions.some((f) => f.name === newFunc.name);

    if (existsInDb && !newNameExists) {
      result.isRenamed = true;
      result.oldName = oldName;
      debugLog(`Detected function rename: ${oldName} -> ${newFunc.name}`);
      break;
    }
  }

  return result;
}

/**
 * Detects if an analyzer has been renamed.
 */
export function detectAnalyzerRename(
  newAnalyzer: { name: string; was?: string | string[] },
  currentAnalyzers: Array<{ name: string }>,
): RenameDetection {
  const result: RenameDetection = {
    isRenamed: false,
    oldName: null,
    newName: newAnalyzer.name,
  };

  if (!newAnalyzer.was) return result;

  const previousNames = Array.isArray(newAnalyzer.was) ? newAnalyzer.was : [newAnalyzer.was];

  for (const oldName of previousNames) {
    const existsInDb = currentAnalyzers.some((a) => a.name === oldName);
    const newNameExists = currentAnalyzers.some((a) => a.name === newAnalyzer.name);

    if (existsInDb && !newNameExists) {
      result.isRenamed = true;
      result.oldName = oldName;
      debugLog(`Detected analyzer rename: ${oldName} -> ${newAnalyzer.name}`);
      break;
    }
  }

  return result;
}

/**
 * Detects if an access/scope has been renamed.
 */
export function detectAccessRename(
  newAccess: { name: string; was?: string | string[] },
  currentAccesses: Array<{ name: string }>,
): RenameDetection {
  const result: RenameDetection = {
    isRenamed: false,
    oldName: null,
    newName: newAccess.name,
  };

  if (!newAccess.was) return result;

  const previousNames = Array.isArray(newAccess.was) ? newAccess.was : [newAccess.was];

  for (const oldName of previousNames) {
    const existsInDb = currentAccesses.some((a) => a.name === oldName);
    const newNameExists = currentAccesses.some((a) => a.name === newAccess.name);

    if (existsInDb && !newNameExists) {
      result.isRenamed = true;
      result.oldName = oldName;
      debugLog(`Detected access rename: ${oldName} -> ${newAccess.name}`);
      break;
    }
  }

  return result;
}

/**
 * Generic rename detector for any entity type.
 *
 * @param newEntity - The new entity definition (must have name and optional was)
 * @param currentEntities - Current entities in the database
 * @param entityType - Type name for logging
 * @returns Rename detection result
 */
export function detectGenericRename<T extends { name: string; was?: string | string[] }>(
  newEntity: T,
  currentEntities: Array<{ name: string }>,
  entityType: string,
): RenameDetection {
  const result: RenameDetection = {
    isRenamed: false,
    oldName: null,
    newName: newEntity.name,
  };

  if (!newEntity.was) return result;

  const previousNames = Array.isArray(newEntity.was) ? newEntity.was : [newEntity.was];

  for (const oldName of previousNames) {
    const existsInDb = currentEntities.some((e) => e.name === oldName);
    const newNameExists = currentEntities.some((e) => e.name === newEntity.name);

    if (existsInDb && !newNameExists) {
      result.isRenamed = true;
      result.oldName = oldName;
      debugLog(`Detected ${entityType} rename: ${oldName} -> ${newEntity.name}`);
      break;
    }
  }

  return result;
}
