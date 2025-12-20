/**
 * @fileoverview Schema introspection utilities for SurrealDB.
 * @module migrator/introspection
 */

// Analyzer parsing
export { parseAnalyzerDefinition } from './analyzer-parser';
// Event parsing
export {
  extractEventThen,
  extractEventType,
  extractEventWhen,
  parseEventDefinition,
} from './event-parser';
// Field parsing
export {
  extractFieldAssert,
  extractFieldComment,
  extractFieldDefault,
  extractFieldOnDelete,
  extractFieldPermissions,
  extractFieldReference,
  extractFieldType,
  extractFieldValue,
  FIELD_PATTERNS,
  hasDefaultAlways,
  hasIfNotExists,
  hasOverwrite,
  isFieldFlexible,
  isFieldOptional,
  isFieldReadonly,
  parseFieldDefinition,
} from './field-parser';

// Function parsing
export { parseFunctionDefinition } from './function-parser';
// Index parsing
export {
  extractIndexAnalyzer,
  extractIndexCapacity,
  extractIndexColumns,
  extractIndexDimension,
  extractIndexDist,
  extractIndexEfc,
  extractIndexM,
  extractIndexType,
  hasIndexHighlights,
  isIndexUnique,
  parseIndexDefinition,
} from './index-parser';
// Scope/Access parsing
export { parseScopeDefinition } from './scope-parser';

// Table parsing
export {
  extractRelationInfo,
  isRelationTable,
  parseTableInfo,
} from './table-parser';
