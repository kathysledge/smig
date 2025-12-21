/**
 * @fileoverview Field comparison logic for schema migrations.
 * @module migrator/comparison/field-comparator
 */

import { debugLog } from '../../utils/debug-logger';
import {
  normalizeComment,
  normalizeDefault,
  normalizeExpression,
  normalizePermissions,
  normalizeType,
} from './normalize';

/**
 * Represents the result of comparing two fields.
 */
export interface FieldComparisonResult {
  hasChanges: boolean;
  changes: string[];
  changeDetails: {
    type?: { old: string; new: string };
    readonly?: { old: boolean; new: boolean };
    flexible?: { old: boolean; new: boolean };
    default?: { old: string; new: string };
    value?: { old: string; new: string };
    assert?: { old: string; new: string };
    permissions?: { old: string; new: string };
    comment?: { old: string | null; new: string | null };
  };
}

/**
 * Compares two field definitions to detect modifications.
 *
 * @param tableName - The table containing the field
 * @param newField - The desired field definition
 * @param currentField - The current field definition from database
 * @returns Comparison result with change details
 */
export function compareFields(
  _tableName: string,
  newField: Record<string, unknown>,
  currentField: Record<string, unknown>,
): FieldComparisonResult {
  const result: FieldComparisonResult = {
    hasChanges: false,
    changes: [],
    changeDetails: {},
  };

  // Normalize and compare each property
  const newType = normalizeType(newField.type);
  const currentType = normalizeType(currentField.type);
  if (newType !== currentType) {
    result.hasChanges = true;
    result.changeDetails.type = { old: currentType, new: newType };
  }

  const newReadonly = Boolean(newField.readonly);
  const currentReadonly = Boolean(currentField.readonly);
  if (newReadonly !== currentReadonly) {
    result.hasChanges = true;
    result.changeDetails.readonly = { old: currentReadonly, new: newReadonly };
  }

  const newFlexible = Boolean(newField.flexible);
  const currentFlexible = Boolean(currentField.flexible);
  if (newFlexible !== currentFlexible) {
    result.hasChanges = true;
    result.changeDetails.flexible = { old: currentFlexible, new: newFlexible };
  }

  const newDefault = normalizeDefault(newField.default);
  const currentDefault = normalizeDefault(currentField.default);
  if (newDefault !== currentDefault) {
    result.hasChanges = true;
    result.changeDetails.default = { old: currentDefault, new: newDefault };
  }

  const newValue = normalizeExpression(newField.value);
  const currentValue = normalizeExpression(currentField.value);
  if (newValue !== currentValue) {
    result.hasChanges = true;
    result.changeDetails.value = { old: currentValue, new: newValue };
  }

  const newAssert = normalizeExpression(newField.assert);
  const currentAssert = normalizeExpression(currentField.assert);
  if (newAssert !== currentAssert) {
    result.hasChanges = true;
    result.changeDetails.assert = { old: currentAssert, new: newAssert };
  }

  const newPermissions = normalizePermissions(newField.permissions);
  const currentPermissions = normalizePermissions(currentField.permissions);
  if (newPermissions !== currentPermissions) {
    result.hasChanges = true;
    result.changeDetails.permissions = { old: currentPermissions, new: newPermissions };
  }

  const newComment = normalizeComment(newField.comment);
  const currentComment = normalizeComment(currentField.comment);
  if (newComment !== currentComment) {
    result.hasChanges = true;
    result.changeDetails.comment = { old: currentComment, new: newComment };
  }

  if (result.hasChanges) {
    debugLog(`Field ${newField.name} has changes:`, result.changeDetails);
  }

  return result;
}

/**
 * Detects if a field has been renamed by checking the .was() property.
 *
 * @param newField - The new field definition (may have previousName)
 * @param currentFields - All current fields in the database
 * @returns The old field name if renamed, null otherwise
 */
export function detectFieldRename(
  newField: Record<string, unknown>,
  currentFields: Array<Record<string, unknown>>,
): string | null {
  // Check if field has a previousName (from .was() method)
  const previousName = newField.previousName as string | string[] | undefined;

  if (!previousName) return null;

  // Handle array of previous names (field may have been renamed multiple times)
  const previousNames = Array.isArray(previousName) ? previousName : [previousName];

  // Check if any previous name exists in current fields
  for (const oldName of previousNames) {
    const oldField = currentFields.find((f) => f.name === oldName);
    if (oldField) {
      return oldName;
    }
  }

  return null;
}
