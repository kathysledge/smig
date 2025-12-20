/**
 * @fileoverview Schema comparison utilities for migrations.
 * @module migrator/comparison
 */

// Entity comparison
export {
  compareAnalyzers,
  compareFunctions,
  compareScopes,
  detectEntityRename,
} from './entity-comparator';

// Field comparison
export {
  compareFields,
  detectFieldRename,
  type FieldComparisonResult,
} from './field-comparator';

// Index comparison
export {
  compareIndexes,
  detectIndexRename,
  type IndexComparisonResult,
} from './index-comparator';
// Normalization utilities
export {
  normalizeComment,
  normalizeDefault,
  normalizeExpression,
  normalizePermissions,
  normalizeType,
  serializeDefaultValue,
  toSurrealQuotes,
} from './normalize';

// Rename detection
export {
  detectAccessRename,
  detectAnalyzerRename,
  detectFieldRename as detectFieldRenameByWas,
  detectFunctionRename,
  detectGenericRename,
  detectIndexRename as detectIndexRenameByWas,
  detectTableRename,
  type RenameDetection,
} from './rename-detector';
