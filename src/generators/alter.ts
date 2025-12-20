/**
 * @fileoverview ALTER statement generators for SurrealDB.
 * @module generators/alter
 *
 * SurrealDB 3.x introduced ALTER statements for modifying existing schema
 * elements without dropping and recreating them. This preserves data and
 * provides cleaner migration scripts.
 *
 * ## Why Use ALTER Instead of OVERWRITE?
 *
 * - **Renames without data loss**: ALTER ... RENAME TO changes the name while
 *   preserving all data and relationships
 * - **Cleaner diffs**: The migration shows intent (rename) rather than
 *   implementation (drop + create)
 * - **Safer rollbacks**: Easier to reverse a rename than recreate data
 * - **Performance**: No data copying required for renames
 */

// ============================================================================
// ALTER TABLE
// ============================================================================

/**
 * Generates ALTER TABLE RENAME statement.
 *
 * @example
 * generateTableRename('users', 'customers')
 * // => 'ALTER TABLE users RENAME TO customers;'
 */
export function generateTableRename(oldName: string, newName: string): string {
  return `ALTER TABLE ${oldName} RENAME TO ${newName};`;
}

/**
 * Generates ALTER TABLE to change table type.
 */
export function generateTableTypeChange(tableName: string, newType: string): string {
  return `ALTER TABLE ${tableName} TYPE ${newType};`;
}

/**
 * Generates ALTER TABLE to add/change DROP setting.
 */
export function generateTableDropChange(tableName: string, drop: boolean): string {
  if (drop) {
    return `ALTER TABLE ${tableName} DROP;`;
  }
  // To remove DROP, we'd need to redefine the table
  return `-- Cannot remove DROP via ALTER; table must be redefined`;
}

/**
 * Generates ALTER TABLE to change CHANGEFEED.
 */
export function generateTableChangefeedChange(
  tableName: string,
  duration: string | null,
  includeOriginal = false,
): string {
  if (duration === null) {
    return `ALTER TABLE ${tableName} CHANGEFEED NONE;`;
  }
  let sql = `ALTER TABLE ${tableName} CHANGEFEED ${duration}`;
  if (includeOriginal) {
    sql += ' INCLUDE ORIGINAL';
  }
  return `${sql};`;
}

// ============================================================================
// ALTER FIELD
// ============================================================================

/**
 * Generates ALTER FIELD RENAME statement.
 *
 * @example
 * generateFieldRename('user', 'userName', 'fullName')
 * // => 'ALTER FIELD userName ON TABLE user RENAME TO fullName;'
 */
export function generateFieldRename(tableName: string, oldName: string, newName: string): string {
  return `ALTER FIELD ${oldName} ON TABLE ${tableName} RENAME TO ${newName};`;
}

/**
 * Generates ALTER FIELD to change type.
 */
export function generateFieldTypeChange(
  tableName: string,
  fieldName: string,
  newType: string,
): string {
  return `ALTER FIELD ${fieldName} ON TABLE ${tableName} TYPE ${newType};`;
}

/**
 * Generates ALTER FIELD to change default value.
 */
export function generateFieldDefaultChange(
  tableName: string,
  fieldName: string,
  defaultValue: string | null,
): string {
  if (defaultValue === null) {
    return `ALTER FIELD ${fieldName} ON TABLE ${tableName} DEFAULT NONE;`;
  }
  return `ALTER FIELD ${fieldName} ON TABLE ${tableName} DEFAULT ${defaultValue};`;
}

/**
 * Generates ALTER FIELD to add/remove READONLY.
 */
export function generateFieldReadonlyChange(
  tableName: string,
  fieldName: string,
  readonly: boolean,
): string {
  if (readonly) {
    return `ALTER FIELD ${fieldName} ON TABLE ${tableName} READONLY;`;
  }
  // To remove readonly, field must be redefined
  return `-- Removing READONLY requires field redefinition`;
}

/**
 * Generates ALTER FIELD to change VALUE expression.
 */
export function generateFieldValueChange(
  tableName: string,
  fieldName: string,
  valueExpr: string | null,
): string {
  if (valueExpr === null) {
    return `ALTER FIELD ${fieldName} ON TABLE ${tableName} VALUE NONE;`;
  }
  return `ALTER FIELD ${fieldName} ON TABLE ${tableName} VALUE ${valueExpr};`;
}

/**
 * Generates ALTER FIELD to change ASSERT expression.
 */
export function generateFieldAssertChange(
  tableName: string,
  fieldName: string,
  assertExpr: string | null,
): string {
  if (assertExpr === null) {
    return `ALTER FIELD ${fieldName} ON TABLE ${tableName} ASSERT NONE;`;
  }
  return `ALTER FIELD ${fieldName} ON TABLE ${tableName} ASSERT ${assertExpr};`;
}

/**
 * Generates ALTER FIELD to add FLEXIBLE.
 */
export function generateFieldFlexibleChange(
  tableName: string,
  fieldName: string,
  flexible: boolean,
): string {
  if (flexible) {
    return `ALTER FIELD ${fieldName} ON TABLE ${tableName} FLEXIBLE;`;
  }
  // To remove flexible requires redefinition
  return `-- Removing FLEXIBLE requires field redefinition`;
}

/**
 * Generates ALTER FIELD to change PERMISSIONS.
 */
export function generateFieldPermissionsChange(
  tableName: string,
  fieldName: string,
  permissions: string | Record<string, string> | null,
): string {
  if (permissions === null) {
    return `ALTER FIELD ${fieldName} ON TABLE ${tableName} PERMISSIONS NONE;`;
  }

  if (typeof permissions === 'string') {
    return `ALTER FIELD ${fieldName} ON TABLE ${tableName} PERMISSIONS ${permissions};`;
  }

  // Object form: { select: 'WHERE ...', update: 'WHERE ...' }
  const permParts: string[] = [];
  for (const [action, condition] of Object.entries(permissions)) {
    permParts.push(`FOR ${action} ${condition}`);
  }
  return `ALTER FIELD ${fieldName} ON TABLE ${tableName} PERMISSIONS ${permParts.join(' ')};`;
}

/**
 * Generates ALTER FIELD to change COMMENT.
 */
export function generateFieldCommentChange(
  tableName: string,
  fieldName: string,
  comment: string | null,
): string {
  if (comment === null) {
    return `ALTER FIELD ${fieldName} ON TABLE ${tableName} COMMENT NONE;`;
  }
  return `ALTER FIELD ${fieldName} ON TABLE ${tableName} COMMENT "${comment}";`;
}

/**
 * Generates ALTER FIELD to change REFERENCE options.
 */
export function generateFieldReferenceChange(
  tableName: string,
  fieldName: string,
  onDelete: string | null,
): string {
  if (onDelete === null) {
    return `ALTER FIELD ${fieldName} ON TABLE ${tableName} REFERENCE NONE;`;
  }
  return `ALTER FIELD ${fieldName} ON TABLE ${tableName} REFERENCE ON DELETE ${onDelete};`;
}

// ============================================================================
// ALTER TABLE - Additional modifications
// ============================================================================

/**
 * Generates ALTER TABLE to change COMMENT.
 */
export function generateTableCommentChange(tableName: string, comment: string | null): string {
  if (comment === null) {
    return `ALTER TABLE ${tableName} COMMENT NONE;`;
  }
  return `ALTER TABLE ${tableName} COMMENT "${comment}";`;
}

/**
 * Generates ALTER TABLE to change PERMISSIONS.
 */
export function generateTablePermissionsChange(
  tableName: string,
  permissions: Record<string, string> | null,
): string {
  if (permissions === null) {
    return `ALTER TABLE ${tableName} PERMISSIONS NONE;`;
  }

  const permParts: string[] = [];
  for (const [action, condition] of Object.entries(permissions)) {
    permParts.push(`FOR ${action} ${condition}`);
  }
  return `ALTER TABLE ${tableName} PERMISSIONS ${permParts.join(' ')};`;
}

// ============================================================================
// ALTER INDEX
// ============================================================================

/**
 * Generates ALTER INDEX RENAME statement.
 *
 * @example
 * generateIndexRename('user', 'idx_email', 'idx_user_email')
 * // => 'ALTER INDEX idx_email ON TABLE user RENAME TO idx_user_email;'
 */
export function generateAlterIndexRename(
  tableName: string,
  oldName: string,
  newName: string,
): string {
  return `ALTER INDEX ${oldName} ON TABLE ${tableName} RENAME TO ${newName};`;
}

/**
 * Generates ALTER INDEX to change COMMENT.
 */
export function generateIndexCommentChange(
  tableName: string,
  indexName: string,
  comment: string | null,
): string {
  if (comment === null) {
    return `ALTER INDEX ${indexName} ON TABLE ${tableName} COMMENT NONE;`;
  }
  return `ALTER INDEX ${indexName} ON TABLE ${tableName} COMMENT "${comment}";`;
}

// ============================================================================
// ALTER EVENT
// ============================================================================

/**
 * Generates ALTER EVENT RENAME statement.
 */
export function generateEventRename(tableName: string, oldName: string, newName: string): string {
  return `ALTER EVENT ${oldName} ON TABLE ${tableName} RENAME TO ${newName};`;
}

/**
 * Generates ALTER EVENT to change WHEN condition.
 */
export function generateEventWhenChange(
  tableName: string,
  eventName: string,
  whenExpr: string,
): string {
  return `ALTER EVENT ${eventName} ON TABLE ${tableName} WHEN ${whenExpr};`;
}

/**
 * Generates ALTER EVENT to change THEN action.
 */
export function generateEventThenChange(
  tableName: string,
  eventName: string,
  thenStatement: string,
): string {
  // Wrap in braces if multiple statements
  const body = thenStatement.includes(';') ? `{ ${thenStatement} }` : thenStatement;
  return `ALTER EVENT ${eventName} ON TABLE ${tableName} THEN ${body};`;
}

/**
 * Generates ALTER EVENT to change COMMENT.
 */
export function generateEventCommentChange(
  tableName: string,
  eventName: string,
  comment: string | null,
): string {
  if (comment === null) {
    return `ALTER EVENT ${eventName} ON TABLE ${tableName} COMMENT NONE;`;
  }
  return `ALTER EVENT ${eventName} ON TABLE ${tableName} COMMENT "${comment}";`;
}

// ============================================================================
// ALTER FUNCTION
// ============================================================================

/**
 * Generates ALTER FUNCTION RENAME statement.
 */
export function generateFunctionRename(oldName: string, newName: string): string {
  return `ALTER FUNCTION ${oldName} RENAME TO ${newName};`;
}

/**
 * Generates ALTER FUNCTION to change PERMISSIONS.
 */
export function generateFunctionPermissionsChange(
  funcName: string,
  permissions: string | null,
): string {
  if (permissions === null) {
    return `ALTER FUNCTION ${funcName} PERMISSIONS NONE;`;
  }
  return `ALTER FUNCTION ${funcName} PERMISSIONS ${permissions};`;
}

/**
 * Generates ALTER FUNCTION to change COMMENT.
 */
export function generateFunctionCommentChange(funcName: string, comment: string | null): string {
  if (comment === null) {
    return `ALTER FUNCTION ${funcName} COMMENT NONE;`;
  }
  return `ALTER FUNCTION ${funcName} COMMENT "${comment}";`;
}

// ============================================================================
// ALTER ANALYZER
// ============================================================================

/**
 * Generates ALTER ANALYZER RENAME statement.
 */
export function generateAnalyzerRename(oldName: string, newName: string): string {
  return `ALTER ANALYZER ${oldName} RENAME TO ${newName};`;
}

/**
 * Generates ALTER ANALYZER to change COMMENT.
 */
export function generateAnalyzerCommentChange(name: string, comment: string | null): string {
  if (comment === null) {
    return `ALTER ANALYZER ${name} COMMENT NONE;`;
  }
  return `ALTER ANALYZER ${name} COMMENT "${comment}";`;
}

// ============================================================================
// ALTER ACCESS
// ============================================================================

/**
 * Generates ALTER ACCESS RENAME statement.
 */
export function generateAccessRename(
  oldName: string,
  newName: string,
  level: 'NAMESPACE' | 'DATABASE' = 'DATABASE',
): string {
  return `ALTER ACCESS ${oldName} ON ${level} RENAME TO ${newName};`;
}

/**
 * Generates ALTER ACCESS to change AUTHENTICATE expression.
 */
export function generateAccessAuthenticateChange(
  name: string,
  authenticateExpr: string | null,
  level: 'NAMESPACE' | 'DATABASE' = 'DATABASE',
): string {
  if (authenticateExpr === null) {
    return `ALTER ACCESS ${name} ON ${level} AUTHENTICATE NONE;`;
  }
  return `ALTER ACCESS ${name} ON ${level} AUTHENTICATE ${authenticateExpr};`;
}

/**
 * Generates ALTER ACCESS to change session DURATION.
 */
export function generateAccessDurationChange(
  name: string,
  durationType: 'SESSION' | 'TOKEN' | 'GRANT',
  duration: string | null,
  level: 'NAMESPACE' | 'DATABASE' = 'DATABASE',
): string {
  if (duration === null) {
    return `ALTER ACCESS ${name} ON ${level} DURATION FOR ${durationType} NONE;`;
  }
  return `ALTER ACCESS ${name} ON ${level} DURATION FOR ${durationType} ${duration};`;
}

/**
 * Generates ALTER ACCESS to change COMMENT.
 */
export function generateAccessCommentChange(
  name: string,
  comment: string | null,
  level: 'NAMESPACE' | 'DATABASE' = 'DATABASE',
): string {
  if (comment === null) {
    return `ALTER ACCESS ${name} ON ${level} COMMENT NONE;`;
  }
  return `ALTER ACCESS ${name} ON ${level} COMMENT "${comment}";`;
}

// ============================================================================
// ALTER USER
// ============================================================================

/**
 * Generates ALTER USER RENAME statement.
 */
export function generateUserRename(
  oldName: string,
  newName: string,
  level: 'ROOT' | 'NAMESPACE' | 'DATABASE' = 'DATABASE',
): string {
  return `ALTER USER ${oldName} ON ${level} RENAME TO ${newName};`;
}

/**
 * Generates ALTER USER to change PASSWORD.
 */
export function generateUserPasswordChange(
  name: string,
  password: string,
  level: 'ROOT' | 'NAMESPACE' | 'DATABASE' = 'DATABASE',
): string {
  return `ALTER USER ${name} ON ${level} PASSWORD "${password}";`;
}

/**
 * Generates ALTER USER to change ROLES.
 */
export function generateUserRolesChange(
  name: string,
  roles: string[],
  level: 'ROOT' | 'NAMESPACE' | 'DATABASE' = 'DATABASE',
): string {
  const rolesStr = roles.join(', ');
  return `ALTER USER ${name} ON ${level} ROLES ${rolesStr};`;
}

/**
 * Generates ALTER USER to change COMMENT.
 */
export function generateUserCommentChange(
  name: string,
  comment: string | null,
  level: 'ROOT' | 'NAMESPACE' | 'DATABASE' = 'DATABASE',
): string {
  if (comment === null) {
    return `ALTER USER ${name} ON ${level} COMMENT NONE;`;
  }
  return `ALTER USER ${name} ON ${level} COMMENT "${comment}";`;
}

// ============================================================================
// ALTER PARAM
// ============================================================================

/**
 * Generates ALTER PARAM RENAME statement.
 */
export function generateParamRename(oldName: string, newName: string): string {
  // Ensure param names have $ prefix
  const oldParam = oldName.startsWith('$') ? oldName : `$${oldName}`;
  const newParam = newName.startsWith('$') ? newName : `$${newName}`;
  return `ALTER PARAM ${oldParam} RENAME TO ${newParam};`;
}

/**
 * Generates ALTER PARAM to change VALUE.
 */
export function generateParamValueChange(name: string, value: string): string {
  const paramName = name.startsWith('$') ? name : `$${name}`;
  return `ALTER PARAM ${paramName} VALUE ${value};`;
}

/**
 * Generates ALTER PARAM to change PERMISSIONS.
 */
export function generateParamPermissionsChange(name: string, permissions: string | null): string {
  const paramName = name.startsWith('$') ? name : `$${name}`;
  if (permissions === null) {
    return `ALTER PARAM ${paramName} PERMISSIONS NONE;`;
  }
  return `ALTER PARAM ${paramName} PERMISSIONS ${permissions};`;
}

/**
 * Generates ALTER PARAM to change COMMENT.
 */
export function generateParamCommentChange(name: string, comment: string | null): string {
  const paramName = name.startsWith('$') ? name : `$${name}`;
  if (comment === null) {
    return `ALTER PARAM ${paramName} COMMENT NONE;`;
  }
  return `ALTER PARAM ${paramName} COMMENT "${comment}";`;
}

// ============================================================================
// ALTER SEQUENCE
// ============================================================================

/**
 * Generates ALTER SEQUENCE RENAME statement.
 */
export function generateSequenceRename(oldName: string, newName: string): string {
  return `ALTER SEQUENCE ${oldName} RENAME TO ${newName};`;
}

/**
 * Generates ALTER SEQUENCE to restart at a new value.
 */
export function generateSequenceRestartChange(name: string, restartValue: number): string {
  return `ALTER SEQUENCE ${name} RESTART ${restartValue};`;
}

/**
 * Generates ALTER SEQUENCE to change CACHE.
 */
export function generateSequenceCacheChange(name: string, cache: number): string {
  return `ALTER SEQUENCE ${name} CACHE ${cache};`;
}

/**
 * Generates ALTER SEQUENCE to change COMMENT.
 */
export function generateSequenceCommentChange(name: string, comment: string | null): string {
  if (comment === null) {
    return `ALTER SEQUENCE ${name} COMMENT NONE;`;
  }
  return `ALTER SEQUENCE ${name} COMMENT "${comment}";`;
}
