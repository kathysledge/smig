/**
 * @fileoverview SQL generators for all SurrealDB schema entities.
 * @module generators
 *
 * This module provides functions to generate SurrealQL DEFINE, ALTER,
 * and REMOVE statements for all schema entities.
 */

// Access
export {
  type AccessDefinition,
  generateAccessDefinition,
  generateAccessRemove,
  generateAccessRename,
  generateScopeDefinition,
  generateScopeRemove,
  type ScopeDefinition,
} from './access';
// ALTER statements (SurrealDB 3.x)
export {
  generateAccessAuthenticateChange as alterAccessAuthenticate,
  generateAccessCommentChange as alterAccessComment,
  generateAccessDurationChange as alterAccessDuration,
  // Access
  generateAccessRename as alterAccessRename,
  // Index
  generateAlterIndexRename as alterIndexRename,
  generateAnalyzerCommentChange as alterAnalyzerComment,
  // Analyzer
  generateAnalyzerRename as alterAnalyzerRename,
  generateEventCommentChange as alterEventComment,
  // Event
  generateEventRename as alterEventRename,
  generateEventThenChange as alterEventThen,
  generateEventWhenChange as alterEventWhen,
  generateFieldAssertChange as alterFieldAssert,
  generateFieldCommentChange as alterFieldComment,
  generateFieldDefaultChange as alterFieldDefault,
  generateFieldFlexibleChange as alterFieldFlexible,
  generateFieldPermissionsChange as alterFieldPermissions,
  generateFieldReadonlyChange as alterFieldReadonly,
  generateFieldReferenceChange as alterFieldReference,
  // Field
  generateFieldRename as alterFieldRename,
  generateFieldTypeChange as alterFieldType,
  generateFieldValueChange as alterFieldValue,
  generateFunctionCommentChange as alterFunctionComment,
  generateFunctionPermissionsChange as alterFunctionPermissions,
  // Function
  generateFunctionRename as alterFunctionRename,
  generateIndexCommentChange as alterIndexComment,
  generateParamCommentChange as alterParamComment,
  generateParamPermissionsChange as alterParamPermissions,
  // Param
  generateParamRename as alterParamRename,
  generateParamValueChange as alterParamValue,
  generateSequenceCacheChange as alterSequenceCache,
  generateSequenceCommentChange as alterSequenceComment,
  // Sequence
  generateSequenceRename as alterSequenceRename,
  generateSequenceRestartChange as alterSequenceRestart,
  generateTableChangefeedChange as alterTableChangefeed,
  generateTableCommentChange as alterTableComment,
  generateTableDropChange as alterTableDrop,
  generateTablePermissionsChange as alterTablePermissions,
  // Table
  generateTableRename as alterTableRename,
  generateTableTypeChange as alterTableType,
  generateUserCommentChange as alterUserComment,
  generateUserPasswordChange as alterUserPassword,
  // User
  generateUserRename as alterUserRename,
  generateUserRolesChange as alterUserRoles,
} from './alter';
// Analyzer
export {
  type AnalyzerDefinition,
  generateAnalyzerDefinition,
  generateAnalyzerRemove,
  generateAnalyzerRename,
} from './analyzer';
// Config
export {
  type ConfigDefinition,
  generateConfigDefinition,
  generateConfigRemove,
} from './config';
// Event
export {
  type EventDefinition,
  generateEventDefinition,
  generateEventRemove,
  generateEventRename,
} from './event';
// Field
export {
  type FieldDefinition,
  generateFieldAlter,
  generateFieldDefinition,
  generateFieldRemove,
  generateFieldRename,
} from './field';
// Function
export {
  type FunctionDefinition,
  type FunctionParameter,
  generateFunctionDefinition,
  generateFunctionRemove,
  generateFunctionRename,
} from './function';
// Index
export {
  generateIndexDefinition,
  generateIndexRemove,
  generateIndexRename,
  type IndexDefinition,
} from './index-gen';
// Model
export {
  generateModelDefinition,
  generateModelRemove,
  type ModelDefinition,
} from './model';
// Param
export {
  generateParamDefinition,
  generateParamRemove,
  generateParamRename,
  type ParamDefinition,
} from './param';
// Sequence
export {
  generateSequenceDefinition,
  generateSequenceRemove,
  generateSequenceRename,
  type SequenceDefinition,
} from './sequence';
// Table
export {
  type GeneratorOptions,
  generateTableDefinition,
  generateTableRemove,
  generateTableRename,
} from './table';
// User
export {
  generateUserDefinition,
  generateUserRemove,
  generateUserRename,
  type UserDefinition,
} from './user';
