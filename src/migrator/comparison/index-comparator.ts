/**
 * @fileoverview Index comparison logic for schema migrations.
 * @module migrator/comparison/index-comparator
 */

import { debugLog } from '../../utils/debug-logger';

/**
 * Represents the result of comparing two indexes.
 */
export interface IndexComparisonResult {
  hasChanges: boolean;
  changeType: 'none' | 'modified' | 'recreate';
  changes: {
    columns?: { old: string[]; new: string[] };
    unique?: { old: boolean; new: boolean };
    type?: { old: string; new: string };
    dimension?: { old: number | null; new: number | null };
    dist?: { old: string | null; new: string | null };
    analyzer?: { old: string | null; new: string | null };
  };
}

/**
 * Compares two index definitions to detect modifications.
 *
 * @param newIndex - The desired index definition
 * @param currentIndex - The current index definition from database
 * @returns Comparison result with change details
 */
export function compareIndexes(
  newIndex: Record<string, unknown>,
  currentIndex: Record<string, unknown>,
): IndexComparisonResult {
  const result: IndexComparisonResult = {
    hasChanges: false,
    changeType: 'none',
    changes: {},
  };

  // Compare columns
  const newCols = (newIndex.columns as string[]) || [];
  const currentCols = (currentIndex.columns as string[]) || [];
  if (JSON.stringify(newCols.sort()) !== JSON.stringify(currentCols.sort())) {
    result.hasChanges = true;
    result.changeType = 'recreate';
    result.changes.columns = { old: currentCols, new: newCols };
  }

  // Compare uniqueness
  const newUnique = Boolean(newIndex.unique);
  const currentUnique = Boolean(currentIndex.unique);
  if (newUnique !== currentUnique) {
    result.hasChanges = true;
    result.changeType = 'recreate';
    result.changes.unique = { old: currentUnique, new: newUnique };
  }

  // Compare type
  const newType = (newIndex.type as string) || 'BTREE';
  const currentType = (currentIndex.type as string) || 'BTREE';
  if (newType !== currentType) {
    result.hasChanges = true;
    result.changeType = 'recreate';
    result.changes.type = { old: currentType, new: newType };
  }

  // Compare vector index properties
  if (newType === 'MTREE' || newType === 'HNSW') {
    const newDim = newIndex.dimension as number | null;
    const currentDim = currentIndex.dimension as number | null;
    if (newDim !== currentDim) {
      result.hasChanges = true;
      result.changeType = 'recreate';
      result.changes.dimension = { old: currentDim, new: newDim };
    }

    const newDist = (newIndex.dist as string) || null;
    const currentDist = (currentIndex.dist as string) || null;
    if (newDist !== currentDist) {
      result.hasChanges = true;
      result.changeType = 'recreate';
      result.changes.dist = { old: currentDist, new: newDist };
    }
  }

  // Compare search index properties
  if (newType === 'SEARCH') {
    const newAnalyzer = (newIndex.analyzer as string) || null;
    const currentAnalyzer = (currentIndex.analyzer as string) || null;
    if (newAnalyzer !== currentAnalyzer) {
      result.hasChanges = true;
      result.changeType = 'recreate';
      result.changes.analyzer = { old: currentAnalyzer, new: newAnalyzer };
    }
  }

  if (result.hasChanges) {
    debugLog(`Index ${newIndex.name} has changes:`, result.changes);
  }

  return result;
}

/**
 * Detects if an index has been renamed by checking the .was() property.
 *
 * @param newIndex - The new index definition (may have previousName)
 * @param currentIndexes - All current indexes in the database
 * @returns The old index name if renamed, null otherwise
 */
export function detectIndexRename(
  newIndex: Record<string, unknown>,
  currentIndexes: Array<Record<string, unknown>>,
): string | null {
  const previousName = newIndex.previousName as string | string[] | undefined;

  if (!previousName) return null;

  const previousNames = Array.isArray(previousName) ? previousName : [previousName];

  for (const oldName of previousNames) {
    const oldIndex = currentIndexes.find((i) => i.name === oldName);
    if (oldIndex) {
      return oldName;
    }
  }

  return null;
}
