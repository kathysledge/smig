/**
 * @fileoverview Migration diff generator using modular components.
 * @module migrator/diff-generator
 *
 * This module generates migration diffs (up and down scripts) by comparing
 * the current database schema with the desired schema definition.
 *
 * ## Key Features
 *
 * - **Rename Detection**: Uses `.was()` tracking to generate ALTER RENAME
 *   instead of DROP/CREATE (preserves data)
 * - **Modular Generation**: Uses separate generators for each entity type
 * - **Bidirectional**: Generates both forward and rollback migrations
 * - **Type-Safe**: Full TypeScript support with proper typing
 */

// Generators
import {
  alterAccessRename,
  alterAnalyzerRename,
  alterFieldAssert,
  alterFieldComment,
  alterFieldDefault,
  alterFieldReadonly,
  alterFieldRename,
  alterFieldType,
  alterFieldValue,
  alterFunctionRename,
  alterIndexRename,
  alterParamValue,
  // ALTER statements
  alterTableRename,
  generateAccessDefinition,
  generateAccessRemove,
  generateAnalyzerDefinition,
  generateAnalyzerRemove,
  generateEventDefinition,
  generateFieldDefinition,
  generateFieldRemove,
  generateFunctionDefinition,
  generateFunctionRemove,
  generateIndexDefinition,
  generateIndexRemove,
  generateParamDefinition,
  generateParamRemove,
  generateSequenceDefinition,
  generateSequenceRemove,
  generateTableDefinition,
  generateTableRemove,
  generateUserDefinition,
  generateUserRemove,
} from '../generators';
import type { SurrealDBSchema } from '../types/schema';

// Comparison utilities
import {
  compareAnalyzers,
  compareFields,
  compareFunctions,
  compareIndexes,
  compareScopes,
  detectAccessRename,
  detectAnalyzerRename,
  detectFieldRenameByWas,
  detectFunctionRename,
  detectIndexRenameByWas,
  detectTableRename,
  serializeDefaultValue,
  toSurrealQuotes,
} from './comparison';

/**
 * Result of generating a migration diff.
 */
export interface MigrationDiff {
  up: string;
  down: string;
  changes: ChangeLog[];
}

/**
 * A single change in the migration.
 */
export interface ChangeLog {
  type:
    | 'table'
    | 'relation'
    | 'field'
    | 'index'
    | 'event'
    | 'function'
    | 'analyzer'
    | 'access'
    | 'param'
    | 'sequence'
    | 'user';
  entity: string;
  operation: 'create' | 'modify' | 'remove' | 'rename';
  details: Record<string, unknown>;
}

/**
 * Generates a migration diff between current and desired schema.
 *
 * @param currentSchema - The current database schema
 * @param desiredSchema - The desired schema definition
 * @returns Migration diff with up, down, and change log
 */
export function generateMigrationDiff(
  currentSchema: SurrealDBSchema,
  desiredSchema: SurrealDBSchema,
): MigrationDiff {
  const upChanges: string[] = [];
  const downChanges: string[] = [];
  const changes: ChangeLog[] = [];

  upChanges.push(`-- Migration diff for ${new Date().toISOString()}`);
  upChanges.push('');

  // Compare tables
  compareTables(currentSchema, desiredSchema, upChanges, downChanges, changes);

  // Compare relations
  compareRelations(currentSchema, desiredSchema, upChanges, downChanges, changes);

  // Compare functions
  compareFunctionEntities(currentSchema, desiredSchema, upChanges, downChanges, changes);

  // Compare analyzers
  compareAnalyzerEntities(currentSchema, desiredSchema, upChanges, downChanges, changes);

  // Compare scopes/access
  compareScopeEntities(currentSchema, desiredSchema, upChanges, downChanges, changes);

  // Compare params
  compareParamEntities(currentSchema, desiredSchema, upChanges, downChanges, changes);

  // Compare sequences
  compareSequenceEntities(currentSchema, desiredSchema, upChanges, downChanges, changes);

  // Compare users
  compareUserEntities(currentSchema, desiredSchema, upChanges, downChanges, changes);

  // Generate rollback header
  downChanges.unshift('-- Rollback migration');
  downChanges.unshift('');

  return {
    up: upChanges.join('\n').trim(),
    down: downChanges.reverse().join('\n').trim(),
    changes,
  };
}

/**
 * Compares tables between current and desired schema.
 */
function compareTables(
  currentSchema: SurrealDBSchema,
  desiredSchema: SurrealDBSchema,
  upChanges: string[],
  downChanges: string[],
  changes: ChangeLog[],
): void {
  const currentTables = currentSchema.tables || [];
  const desiredTables = desiredSchema.tables || [];

  // Check for new and modified tables
  for (const desiredTable of desiredTables) {
    // Check for rename
    const renameResult = detectTableRename(
      desiredTable as { name: string; was?: string | string[] },
      currentTables as Array<{ name: string }>,
    );

    if (renameResult.isRenamed && renameResult.oldName) {
      // Generate rename statement
      upChanges.push(`-- Rename table: ${renameResult.oldName} -> ${desiredTable.name}`);
      upChanges.push(alterTableRename(renameResult.oldName, desiredTable.name));
      upChanges.push('');

      // Rollback = rename back
      downChanges.push(alterTableRename(desiredTable.name, renameResult.oldName));

      changes.push({
        type: 'table',
        entity: desiredTable.name,
        operation: 'rename',
        details: { oldName: renameResult.oldName, newName: desiredTable.name },
      });

      // Now compare fields/indexes/events against the renamed table
      const oldTable = currentTables.find((t) => t.name === renameResult.oldName);
      if (oldTable) {
        compareTableContents(
          oldTable,
          desiredTable,
          desiredTable.name,
          upChanges,
          downChanges,
          changes,
        );
      }
    } else {
      // Check if table exists
      const currentTable = currentTables.find((t) => t.name === desiredTable.name);

      if (!currentTable) {
        // New table
        type TableTypeVal = 'NORMAL' | 'RELATION' | 'ANY';
        upChanges.push(`-- New table: ${desiredTable.name}`);
        upChanges.push(
          generateTableDefinition({
            name: desiredTable.name,
            type:
              ((desiredTable as unknown as Record<string, unknown>).type as TableTypeVal) ||
              'NORMAL',
            schemafull: desiredTable.schemafull !== false,
            fields: desiredTable.fields,
            indexes: desiredTable.indexes,
            events: desiredTable.events,
            comments: [],
          }),
        );

        // Add fields
        for (const field of desiredTable.fields) {
          upChanges.push(
            generateFieldDefinition(desiredTable.name, {
              name: field.name,
              type: field.type,
              default: field.default ? serializeDefaultValue(field.default) : undefined,
              value: field.value || undefined,
              assert: field.assert ? toSurrealQuotes(field.assert) : undefined,
              readonly: field.readonly,
              flexible: field.flexible,
              permissions: field.permissions || undefined,
              comment: field.comment || undefined,
            }),
          );
        }

        // Add indexes
        for (const index of desiredTable.indexes) {
          const idx = index as unknown as Record<string, unknown>;
          type IndexTypeVal = 'BTREE' | 'HASH' | 'SEARCH' | 'MTREE' | 'HNSW';
          type DistVal =
            | 'EUCLIDEAN'
            | 'COSINE'
            | 'MANHATTAN'
            | 'HAMMING'
            | 'MINKOWSKI'
            | 'CHEBYSHEV'
            | 'JACCARD'
            | 'PEARSON'
            | null
            | undefined;
          upChanges.push(
            generateIndexDefinition(desiredTable.name, index.name, {
              columns: index.columns,
              unique: index.unique,
              type: (idx.type as IndexTypeVal) || 'BTREE',
              dimension: idx.dimension as number | undefined,
              dist: idx.dist as DistVal,
              analyzer: idx.analyzer as string | undefined,
              highlights: idx.highlights as boolean | undefined,
            }),
          );
        }

        // Add events
        for (const event of desiredTable.events) {
          upChanges.push(
            generateEventDefinition(desiredTable.name, {
              name: event.name,
              type: 'UPDATE', // Default type
              when: event.when || '',
              thenStatement: event.thenStatement || '',
            }),
          );
        }

        upChanges.push('');

        // Rollback = remove table
        downChanges.push(generateTableRemove(desiredTable.name));

        changes.push({
          type: 'table',
          entity: desiredTable.name,
          operation: 'create',
          details: { fields: desiredTable.fields.length, indexes: desiredTable.indexes.length },
        });
      } else {
        // Existing table - compare contents
        compareTableContents(
          currentTable,
          desiredTable,
          desiredTable.name,
          upChanges,
          downChanges,
          changes,
        );
      }
    }
  }

  // Check for removed tables
  for (const currentTable of currentTables) {
    const stillExists = desiredTables.find((t) => t.name === currentTable.name);
    const wasRenamed = desiredTables.some((t) => {
      const wasArr = (t as unknown as Record<string, unknown>).was;
      if (!wasArr) return false;
      const names = Array.isArray(wasArr) ? wasArr : [wasArr];
      return names.includes(currentTable.name);
    });

    if (!stillExists && !wasRenamed) {
      upChanges.push(`-- Remove table: ${currentTable.name}`);
      upChanges.push(generateTableRemove(currentTable.name));
      upChanges.push('');

      // Rollback = recreate table (simplified - full recreation would need more data)
      type TableTypeVal = 'NORMAL' | 'RELATION' | 'ANY';
      downChanges.push(`-- Recreate table: ${currentTable.name}`);
      downChanges.push(
        generateTableDefinition({
          name: currentTable.name,
          type:
            ((currentTable as unknown as Record<string, unknown>).type as TableTypeVal) || 'NORMAL',
          schemafull: currentTable.schemafull !== false,
          fields: currentTable.fields || [],
          indexes: currentTable.indexes || [],
          events: currentTable.events || [],
          comments: [],
        }),
      );

      changes.push({
        type: 'table',
        entity: currentTable.name,
        operation: 'remove',
        details: {},
      });
    }
  }
}

/**
 * Compares the contents (fields, indexes, events) of two tables.
 */
function compareTableContents(
  currentTable: SurrealDBSchema['tables'][0],
  desiredTable: SurrealDBSchema['tables'][0],
  tableName: string,
  upChanges: string[],
  downChanges: string[],
  changes: ChangeLog[],
): void {
  const currentFields = currentTable.fields || [];
  const desiredFields = desiredTable.fields || [];
  const currentIndexes = currentTable.indexes || [];
  const desiredIndexes = desiredTable.indexes || [];
  const _currentEvents = currentTable.events || [];
  const _desiredEvents = desiredTable.events || [];

  // Compare fields
  for (const desiredField of desiredFields) {
    const renameResult = detectFieldRenameByWas(
      tableName,
      desiredField as { name: string; previousName?: string | string[] },
      currentFields as Array<{ name: string }>,
    );

    if (renameResult.isRenamed && renameResult.oldName) {
      upChanges.push(
        `-- Rename field: ${tableName}.${renameResult.oldName} -> ${desiredField.name}`,
      );
      upChanges.push(alterFieldRename(tableName, renameResult.oldName, desiredField.name));
      downChanges.push(alterFieldRename(tableName, desiredField.name, renameResult.oldName));

      changes.push({
        type: 'field',
        entity: `${tableName}.${desiredField.name}`,
        operation: 'rename',
        details: { oldName: renameResult.oldName },
      });
    } else {
      const currentField = currentFields.find((f) => f.name === desiredField.name);

      if (!currentField) {
        // New field
        upChanges.push(`-- New field: ${tableName}.${desiredField.name}`);
        upChanges.push(
          generateFieldDefinition(tableName, {
            name: desiredField.name,
            type: desiredField.type,
            default: desiredField.default ? serializeDefaultValue(desiredField.default) : undefined,
            value: desiredField.value || undefined,
            assert: desiredField.assert ? toSurrealQuotes(desiredField.assert) : undefined,
            readonly: desiredField.readonly,
            flexible: desiredField.flexible,
          }),
        );
        downChanges.push(generateFieldRemove(tableName, desiredField.name));

        changes.push({
          type: 'field',
          entity: `${tableName}.${desiredField.name}`,
          operation: 'create',
          details: { type: desiredField.type },
        });
      } else {
        // Check for modifications
        const comparison = compareFields(
          tableName,
          desiredField as unknown as Record<string, unknown>,
          currentField as unknown as Record<string, unknown>,
        );

        if (comparison.hasChanges) {
          upChanges.push(`-- Modified field: ${tableName}.${desiredField.name}`);

          // Use granular ALTER statements when possible
          const changeDetails = comparison.changeDetails || {};
          const changedProperties = Object.keys(changeDetails);

          // Determine if we can use granular ALTER or need full OVERWRITE
          const canUseGranularAlter =
            changedProperties.length <= 3 &&
            changedProperties.every((prop) =>
              ['type', 'default', 'value', 'assert', 'readonly', 'comment'].includes(prop),
            );

          if (canUseGranularAlter && changedProperties.length > 0) {
            // Use individual ALTER statements for each changed property
            for (const prop of changedProperties) {
              switch (prop) {
                case 'type':
                  upChanges.push(alterFieldType(tableName, desiredField.name, desiredField.type));
                  downChanges.push(alterFieldType(tableName, currentField.name, currentField.type));
                  break;
                case 'default':
                  upChanges.push(
                    alterFieldDefault(
                      tableName,
                      desiredField.name,
                      desiredField.default ? serializeDefaultValue(desiredField.default) : null,
                    ),
                  );
                  downChanges.push(
                    alterFieldDefault(
                      tableName,
                      currentField.name,
                      currentField.default ? serializeDefaultValue(currentField.default) : null,
                    ),
                  );
                  break;
                case 'value':
                  upChanges.push(
                    alterFieldValue(tableName, desiredField.name, desiredField.value || null),
                  );
                  downChanges.push(
                    alterFieldValue(tableName, currentField.name, currentField.value || null),
                  );
                  break;
                case 'assert':
                  upChanges.push(
                    alterFieldAssert(
                      tableName,
                      desiredField.name,
                      desiredField.assert ? toSurrealQuotes(desiredField.assert) : null,
                    ),
                  );
                  downChanges.push(
                    alterFieldAssert(
                      tableName,
                      currentField.name,
                      currentField.assert ? toSurrealQuotes(currentField.assert) : null,
                    ),
                  );
                  break;
                case 'readonly':
                  if (desiredField.readonly) {
                    upChanges.push(alterFieldReadonly(tableName, desiredField.name, true));
                  }
                  // Note: Removing readonly requires full redefinition
                  if (currentField.readonly) {
                    downChanges.push(alterFieldReadonly(tableName, currentField.name, true));
                  }
                  break;
                case 'comment':
                  upChanges.push(
                    alterFieldComment(tableName, desiredField.name, desiredField.comment || null),
                  );
                  downChanges.push(
                    alterFieldComment(tableName, currentField.name, currentField.comment || null),
                  );
                  break;
              }
            }
          } else {
            // Fall back to full OVERWRITE for complex changes
            upChanges.push(
              generateFieldDefinition(tableName, {
                name: desiredField.name,
                type: desiredField.type,
                default: desiredField.default
                  ? serializeDefaultValue(desiredField.default)
                  : undefined,
                value: desiredField.value || undefined,
                assert: desiredField.assert ? toSurrealQuotes(desiredField.assert) : undefined,
                readonly: desiredField.readonly,
                flexible: desiredField.flexible,
                overwrite: true,
              }),
            );
            // Rollback = restore original
            downChanges.push(
              generateFieldDefinition(tableName, {
                name: currentField.name,
                type: currentField.type,
                default: currentField.default
                  ? serializeDefaultValue(currentField.default)
                  : undefined,
                value: currentField.value || undefined,
                assert: currentField.assert ? toSurrealQuotes(currentField.assert) : undefined,
                readonly: currentField.readonly,
                flexible: currentField.flexible,
                overwrite: true,
              }),
            );
          }

          changes.push({
            type: 'field',
            entity: `${tableName}.${desiredField.name}`,
            operation: 'modify',
            details: comparison.changeDetails,
          });
        }
      }
    }
  }

  // Check for removed fields
  for (const currentField of currentFields) {
    const stillExists = desiredFields.find((f) => f.name === currentField.name);
    if (!stillExists) {
      // Skip auto-generated fields
      if (currentField.name.endsWith('.*')) continue;
      if (currentField.name === 'in' || currentField.name === 'out') continue;

      upChanges.push(`-- Remove field: ${tableName}.${currentField.name}`);
      upChanges.push(generateFieldRemove(tableName, currentField.name));
      downChanges.push(
        generateFieldDefinition(tableName, {
          name: currentField.name,
          type: currentField.type,
        }),
      );

      changes.push({
        type: 'field',
        entity: `${tableName}.${currentField.name}`,
        operation: 'remove',
        details: {},
      });
    }
  }

  // Compare indexes
  for (const desiredIndex of desiredIndexes) {
    const renameResult = detectIndexRenameByWas(
      tableName,
      desiredIndex as { name: string; previousName?: string | string[] },
      currentIndexes as Array<{ name: string }>,
    );

    if (renameResult.isRenamed && renameResult.oldName) {
      upChanges.push(
        `-- Rename index: ${tableName}.${renameResult.oldName} -> ${desiredIndex.name}`,
      );
      upChanges.push(alterIndexRename(tableName, renameResult.oldName, desiredIndex.name));
      downChanges.push(alterIndexRename(tableName, desiredIndex.name, renameResult.oldName));

      changes.push({
        type: 'index',
        entity: `${tableName}.${desiredIndex.name}`,
        operation: 'rename',
        details: { oldName: renameResult.oldName },
      });
    } else {
      const currentIndex = currentIndexes.find((i) => i.name === desiredIndex.name);
      type IndexTypeVal = 'BTREE' | 'HASH' | 'SEARCH' | 'MTREE' | 'HNSW';
      type DistVal =
        | 'EUCLIDEAN'
        | 'COSINE'
        | 'MANHATTAN'
        | 'HAMMING'
        | 'MINKOWSKI'
        | 'CHEBYSHEV'
        | 'JACCARD'
        | 'PEARSON'
        | null
        | undefined;

      if (!currentIndex) {
        const idx = desiredIndex as unknown as Record<string, unknown>;
        upChanges.push(`-- New index: ${tableName}.${desiredIndex.name}`);
        upChanges.push(
          generateIndexDefinition(tableName, desiredIndex.name, {
            columns: desiredIndex.columns,
            unique: desiredIndex.unique,
            type: (idx.type as IndexTypeVal) || 'BTREE',
            dimension: idx.dimension as number | undefined,
            dist: idx.dist as DistVal,
            analyzer: idx.analyzer as string | undefined,
            highlights: idx.highlights as boolean | undefined,
          }),
        );
        downChanges.push(generateIndexRemove(tableName, desiredIndex.name));

        changes.push({
          type: 'index',
          entity: `${tableName}.${desiredIndex.name}`,
          operation: 'create',
          details: { columns: desiredIndex.columns },
        });
      } else {
        const comparison = compareIndexes(
          desiredIndex as unknown as Record<string, unknown>,
          currentIndex as unknown as Record<string, unknown>,
        );

        if (comparison.hasChanges) {
          const idx = desiredIndex as unknown as Record<string, unknown>;
          const curIdx = currentIndex as unknown as Record<string, unknown>;
          // Indexes must be recreated, not modified
          upChanges.push(`-- Recreate index: ${tableName}.${desiredIndex.name}`);
          upChanges.push(generateIndexRemove(tableName, desiredIndex.name));
          upChanges.push(
            generateIndexDefinition(tableName, desiredIndex.name, {
              columns: desiredIndex.columns,
              unique: desiredIndex.unique,
              type: (idx.type as IndexTypeVal) || 'BTREE',
              dimension: idx.dimension as number | undefined,
              dist: idx.dist as DistVal,
              analyzer: idx.analyzer as string | undefined,
              highlights: idx.highlights as boolean | undefined,
            }),
          );
          downChanges.push(generateIndexRemove(tableName, desiredIndex.name));
          downChanges.push(
            generateIndexDefinition(tableName, currentIndex.name, {
              columns: currentIndex.columns,
              unique: currentIndex.unique,
              type: (curIdx.type as IndexTypeVal) || 'BTREE',
              dimension: curIdx.dimension as number | undefined,
              dist: curIdx.dist as DistVal,
              analyzer: curIdx.analyzer as string | undefined,
              highlights: curIdx.highlights as boolean | undefined,
            }),
          );

          changes.push({
            type: 'index',
            entity: `${tableName}.${desiredIndex.name}`,
            operation: 'modify',
            details: comparison.changes,
          });
        }
      }
    }
  }

  // Check for removed indexes
  for (const currentIndex of currentIndexes) {
    const stillExists = desiredIndexes.find((i) => i.name === currentIndex.name);
    if (!stillExists) {
      const curIdx = currentIndex as unknown as Record<string, unknown>;
      type IndexTypeVal = 'BTREE' | 'HASH' | 'SEARCH' | 'MTREE' | 'HNSW';
      type DistVal =
        | 'EUCLIDEAN'
        | 'COSINE'
        | 'MANHATTAN'
        | 'HAMMING'
        | 'MINKOWSKI'
        | 'CHEBYSHEV'
        | 'JACCARD'
        | 'PEARSON'
        | null
        | undefined;
      upChanges.push(`-- Remove index: ${tableName}.${currentIndex.name}`);
      upChanges.push(generateIndexRemove(tableName, currentIndex.name));
      downChanges.push(
        generateIndexDefinition(tableName, currentIndex.name, {
          columns: currentIndex.columns,
          unique: currentIndex.unique,
          type: (curIdx.type as IndexTypeVal) || 'BTREE',
          dimension: curIdx.dimension as number | undefined,
          dist: curIdx.dist as DistVal,
          analyzer: curIdx.analyzer as string | undefined,
          highlights: curIdx.highlights as boolean | undefined,
        }),
      );

      changes.push({
        type: 'index',
        entity: `${tableName}.${currentIndex.name}`,
        operation: 'remove',
        details: {},
      });
    }
  }
}

/**
 * Compares relations between current and desired schema.
 */
function compareRelations(
  currentSchema: SurrealDBSchema,
  desiredSchema: SurrealDBSchema,
  upChanges: string[],
  downChanges: string[],
  changes: ChangeLog[],
): void {
  // Relations are compared similarly to tables
  // (simplified implementation - full version would handle from/to changes)
  const currentRelations = currentSchema.relations || [];
  const desiredRelations = desiredSchema.relations || [];

  for (const desiredRelation of desiredRelations) {
    const currentRelation = currentRelations.find((r) => r.name === desiredRelation.name);

    if (!currentRelation) {
      upChanges.push(`-- New relation: ${desiredRelation.name}`);
      upChanges.push(
        generateTableDefinition({
          name: desiredRelation.name,
          type: 'RELATION',
          schemafull: desiredRelation.schemafull !== false,
          fields: desiredRelation.fields,
          indexes: desiredRelation.indexes || [],
          events: desiredRelation.events || [],
          comments: [],
        }),
      );

      for (const field of desiredRelation.fields) {
        upChanges.push(
          generateFieldDefinition(desiredRelation.name, {
            name: field.name,
            type: field.type,
          }),
        );
      }

      upChanges.push('');
      downChanges.push(generateTableRemove(desiredRelation.name));

      changes.push({
        type: 'relation',
        entity: desiredRelation.name,
        operation: 'create',
        details: {},
      });
    }
  }
}

/**
 * Compares functions between current and desired schema.
 */
function compareFunctionEntities(
  currentSchema: SurrealDBSchema,
  desiredSchema: SurrealDBSchema,
  upChanges: string[],
  downChanges: string[],
  changes: ChangeLog[],
): void {
  const currentFuncs = currentSchema.functions || [];
  const desiredFuncs = desiredSchema.functions || [];

  for (const desiredFunc of desiredFuncs) {
    const renameResult = detectFunctionRename(
      desiredFunc as { name: string; was?: string | string[] },
      currentFuncs as Array<{ name: string }>,
    );

    if (renameResult.isRenamed && renameResult.oldName) {
      upChanges.push(`-- Rename function: ${renameResult.oldName} -> ${desiredFunc.name}`);
      upChanges.push(alterFunctionRename(renameResult.oldName, desiredFunc.name));
      downChanges.push(alterFunctionRename(desiredFunc.name, renameResult.oldName));

      changes.push({
        type: 'function',
        entity: desiredFunc.name,
        operation: 'rename',
        details: { oldName: renameResult.oldName },
      });
    } else {
      const currentFunc = currentFuncs.find((f) => f.name === desiredFunc.name);

      if (!currentFunc) {
        upChanges.push(`-- New function: ${desiredFunc.name}`);
        upChanges.push(
          generateFunctionDefinition({
            name: desiredFunc.name,
            parameters: desiredFunc.parameters,
            returnType: desiredFunc.returnType,
            body: desiredFunc.body,
          }),
        );
        downChanges.push(generateFunctionRemove(desiredFunc.name));

        changes.push({
          type: 'function',
          entity: desiredFunc.name,
          operation: 'create',
          details: {},
        });
      } else if (compareFunctions(currentFunc, desiredFunc)) {
        upChanges.push(`-- Modified function: ${desiredFunc.name}`);
        upChanges.push(
          generateFunctionDefinition({
            name: desiredFunc.name,
            parameters: desiredFunc.parameters,
            returnType: desiredFunc.returnType,
            body: desiredFunc.body,
            overwrite: true,
          }),
        );
        downChanges.push(
          generateFunctionDefinition({
            name: currentFunc.name,
            parameters: currentFunc.parameters,
            returnType: currentFunc.returnType,
            body: currentFunc.body,
            overwrite: true,
          }),
        );

        changes.push({
          type: 'function',
          entity: desiredFunc.name,
          operation: 'modify',
          details: {},
        });
      }
    }
  }

  // Check for removed functions
  for (const currentFunc of currentFuncs) {
    const stillExists = desiredFuncs.find((f) => f.name === currentFunc.name);
    if (!stillExists) {
      upChanges.push(`-- Remove function: ${currentFunc.name}`);
      upChanges.push(generateFunctionRemove(currentFunc.name));
      downChanges.push(
        generateFunctionDefinition({
          name: currentFunc.name,
          parameters: currentFunc.parameters,
          returnType: currentFunc.returnType,
          body: currentFunc.body,
        }),
      );

      changes.push({
        type: 'function',
        entity: currentFunc.name,
        operation: 'remove',
        details: {},
      });
    }
  }
}

/**
 * Compares analyzers between current and desired schema.
 */
function compareAnalyzerEntities(
  currentSchema: SurrealDBSchema,
  desiredSchema: SurrealDBSchema,
  upChanges: string[],
  downChanges: string[],
  changes: ChangeLog[],
): void {
  const currentAnalyzers = currentSchema.analyzers || [];
  const desiredAnalyzers = desiredSchema.analyzers || [];

  for (const desiredAnalyzer of desiredAnalyzers) {
    const renameResult = detectAnalyzerRename(
      desiredAnalyzer as { name: string; was?: string | string[] },
      currentAnalyzers as Array<{ name: string }>,
    );

    if (renameResult.isRenamed && renameResult.oldName) {
      upChanges.push(`-- Rename analyzer: ${renameResult.oldName} -> ${desiredAnalyzer.name}`);
      upChanges.push(alterAnalyzerRename(renameResult.oldName, desiredAnalyzer.name));
      downChanges.push(alterAnalyzerRename(desiredAnalyzer.name, renameResult.oldName));

      changes.push({
        type: 'analyzer',
        entity: desiredAnalyzer.name,
        operation: 'rename',
        details: { oldName: renameResult.oldName },
      });
    } else {
      const currentAnalyzer = currentAnalyzers.find((a) => a.name === desiredAnalyzer.name);

      if (!currentAnalyzer) {
        upChanges.push(`-- New analyzer: ${desiredAnalyzer.name}`);
        upChanges.push(
          generateAnalyzerDefinition({
            name: desiredAnalyzer.name,
            tokenizers: desiredAnalyzer.tokenizers,
            filters: desiredAnalyzer.filters,
          }),
        );
        downChanges.push(generateAnalyzerRemove(desiredAnalyzer.name));

        changes.push({
          type: 'analyzer',
          entity: desiredAnalyzer.name,
          operation: 'create',
          details: {},
        });
      } else if (compareAnalyzers(currentAnalyzer, desiredAnalyzer)) {
        upChanges.push(`-- Modified analyzer: ${desiredAnalyzer.name}`);
        upChanges.push(
          generateAnalyzerDefinition({
            name: desiredAnalyzer.name,
            tokenizers: desiredAnalyzer.tokenizers,
            filters: desiredAnalyzer.filters,
            overwrite: true,
          }),
        );
        downChanges.push(
          generateAnalyzerDefinition({
            name: currentAnalyzer.name,
            tokenizers: currentAnalyzer.tokenizers,
            filters: currentAnalyzer.filters,
            overwrite: true,
          }),
        );

        changes.push({
          type: 'analyzer',
          entity: desiredAnalyzer.name,
          operation: 'modify',
          details: {},
        });
      }
    }
  }
}

/**
 * Compares scopes/access between current and desired schema.
 */
function compareScopeEntities(
  currentSchema: SurrealDBSchema,
  desiredSchema: SurrealDBSchema,
  upChanges: string[],
  downChanges: string[],
  changes: ChangeLog[],
): void {
  const currentScopes = currentSchema.scopes || [];
  const desiredScopes = desiredSchema.scopes || [];

  for (const desiredScope of desiredScopes) {
    const renameResult = detectAccessRename(
      desiredScope as { name: string; was?: string | string[] },
      currentScopes as Array<{ name: string }>,
    );

    if (renameResult.isRenamed && renameResult.oldName) {
      upChanges.push(`-- Rename access: ${renameResult.oldName} -> ${desiredScope.name}`);
      upChanges.push(alterAccessRename(renameResult.oldName, desiredScope.name));
      downChanges.push(alterAccessRename(desiredScope.name, renameResult.oldName));

      changes.push({
        type: 'access',
        entity: desiredScope.name,
        operation: 'rename',
        details: { oldName: renameResult.oldName },
      });
    } else {
      const currentScope = currentScopes.find((s) => s.name === desiredScope.name);

      if (!currentScope) {
        upChanges.push(`-- New access: ${desiredScope.name}`);
        upChanges.push(
          generateAccessDefinition({
            name: desiredScope.name,
            type: 'RECORD',
            level: 'DATABASE',
            signup: desiredScope.signup,
            signin: desiredScope.signin,
            session: desiredScope.session,
          }),
        );
        downChanges.push(generateAccessRemove(desiredScope.name));

        changes.push({
          type: 'access',
          entity: desiredScope.name,
          operation: 'create',
          details: {},
        });
      } else if (compareScopes(currentScope, desiredScope)) {
        upChanges.push(`-- Modified access: ${desiredScope.name}`);
        upChanges.push(
          generateAccessDefinition({
            name: desiredScope.name,
            type: 'RECORD',
            level: 'DATABASE',
            signup: desiredScope.signup,
            signin: desiredScope.signin,
            session: desiredScope.session,
            overwrite: true,
          }),
        );
        downChanges.push(
          generateAccessDefinition({
            name: currentScope.name,
            type: 'RECORD',
            level: 'DATABASE',
            signup: currentScope.signup,
            signin: currentScope.signin,
            session: currentScope.session,
            overwrite: true,
          }),
        );

        changes.push({
          type: 'access',
          entity: desiredScope.name,
          operation: 'modify',
          details: {},
        });
      }
    }
  }
}

/**
 * Compares params between current and desired schema.
 */
function compareParamEntities(
  currentSchema: SurrealDBSchema,
  desiredSchema: SurrealDBSchema,
  upChanges: string[],
  downChanges: string[],
  changes: ChangeLog[],
): void {
  const currentParams =
    ((currentSchema as unknown as Record<string, unknown>).params as Array<
      Record<string, unknown>
    >) || [];
  const desiredParams =
    ((desiredSchema as unknown as Record<string, unknown>).params as Array<
      Record<string, unknown>
    >) || [];

  for (const desiredParam of desiredParams) {
    const name = desiredParam.name as string;
    const currentParam = currentParams.find((p) => p.name === name);

    if (!currentParam) {
      upChanges.push(`-- New param: ${name}`);
      upChanges.push(
        generateParamDefinition({
          name,
          value: desiredParam.value as string,
          comments: desiredParam.comment ? [desiredParam.comment as string] : undefined,
        }),
      );
      downChanges.push(generateParamRemove(name));

      changes.push({
        type: 'param',
        entity: name,
        operation: 'create',
        details: {},
      });
    } else if (currentParam.value !== desiredParam.value) {
      upChanges.push(`-- Modified param: ${name}`);
      // Use ALTER PARAM VALUE for efficient value change
      upChanges.push(alterParamValue(name, desiredParam.value as string));
      downChanges.push(alterParamValue(name, currentParam.value as string));

      changes.push({
        type: 'param',
        entity: name,
        operation: 'modify',
        details: { oldValue: currentParam.value, newValue: desiredParam.value },
      });
    }
  }

  // Check for removed params
  for (const currentParam of currentParams) {
    const name = currentParam.name as string;
    const stillExists = desiredParams.find((p) => p.name === name);
    if (!stillExists) {
      upChanges.push(`-- Remove param: ${name}`);
      upChanges.push(generateParamRemove(name));
      downChanges.push(
        generateParamDefinition({
          name,
          value: currentParam.value as string,
        }),
      );

      changes.push({
        type: 'param',
        entity: name,
        operation: 'remove',
        details: {},
      });
    }
  }
}

/**
 * Compares sequences between current and desired schema.
 */
function compareSequenceEntities(
  currentSchema: SurrealDBSchema,
  desiredSchema: SurrealDBSchema,
  upChanges: string[],
  downChanges: string[],
  changes: ChangeLog[],
): void {
  const currentSeqs =
    ((currentSchema as unknown as Record<string, unknown>).sequences as Array<
      Record<string, unknown>
    >) || [];
  const desiredSeqs =
    ((desiredSchema as unknown as Record<string, unknown>).sequences as Array<
      Record<string, unknown>
    >) || [];

  for (const desiredSeq of desiredSeqs) {
    const name = desiredSeq.name as string;
    const currentSeq = currentSeqs.find((s) => s.name === name);

    if (!currentSeq) {
      upChanges.push(`-- New sequence: ${name}`);
      upChanges.push(
        generateSequenceDefinition({
          name,
          start: desiredSeq.start as number | undefined,
          comments: desiredSeq.comments as string[] | undefined,
        }),
      );
      downChanges.push(generateSequenceRemove(name));

      changes.push({
        type: 'sequence',
        entity: name,
        operation: 'create',
        details: {},
      });
    }
    // Sequences generally don't get modified - they're dropped and recreated
  }

  // Check for removed sequences
  for (const currentSeq of currentSeqs) {
    const name = currentSeq.name as string;
    const stillExists = desiredSeqs.find((s) => s.name === name);
    if (!stillExists) {
      upChanges.push(`-- Remove sequence: ${name}`);
      upChanges.push(generateSequenceRemove(name));
      downChanges.push(
        generateSequenceDefinition({
          name,
          start: currentSeq.start as number | undefined,
        }),
      );

      changes.push({
        type: 'sequence',
        entity: name,
        operation: 'remove',
        details: {},
      });
    }
  }
}

/**
 * Compares users between current and desired schema.
 */
function compareUserEntities(
  currentSchema: SurrealDBSchema,
  desiredSchema: SurrealDBSchema,
  upChanges: string[],
  downChanges: string[],
  changes: ChangeLog[],
): void {
  const currentUsers =
    ((currentSchema as unknown as Record<string, unknown>).users as Array<
      Record<string, unknown>
    >) || [];
  const desiredUsers =
    ((desiredSchema as unknown as Record<string, unknown>).users as Array<
      Record<string, unknown>
    >) || [];

  for (const desiredUser of desiredUsers) {
    const name = desiredUser.name as string;
    const currentUser = currentUsers.find((u) => u.name === name);

    if (!currentUser) {
      const level = (desiredUser.level as 'ROOT' | 'NAMESPACE' | 'DATABASE') || 'DATABASE';
      upChanges.push(`-- New user: ${name}`);
      upChanges.push(
        generateUserDefinition({
          name,
          level,
          password: desiredUser.password as string | undefined,
          roles: desiredUser.roles as Array<'OWNER' | 'EDITOR' | 'VIEWER'> | undefined,
        }),
      );
      downChanges.push(generateUserRemove(name, level));

      changes.push({
        type: 'user',
        entity: name,
        operation: 'create',
        details: {},
      });
    }
    // User modifications would require more complex comparison
  }

  // Check for removed users
  for (const currentUser of currentUsers) {
    const name = currentUser.name as string;
    const stillExists = desiredUsers.find((u) => u.name === name);
    if (!stillExists) {
      const level = (currentUser.level as 'ROOT' | 'NAMESPACE' | 'DATABASE') || 'DATABASE';
      upChanges.push(`-- Remove user: ${name}`);
      upChanges.push(generateUserRemove(name, level));
      downChanges.push(
        generateUserDefinition({
          name,
          level,
          password: currentUser.password as string | undefined,
          roles: currentUser.roles as Array<'OWNER' | 'EDITOR' | 'VIEWER'> | undefined,
        }),
      );

      changes.push({
        type: 'user',
        entity: name,
        operation: 'remove',
        details: {},
      });
    }
  }
}

/**
 * Checks if there are any pending changes.
 */
export function hasSchemaChanges(
  currentSchema: SurrealDBSchema,
  desiredSchema: SurrealDBSchema,
): boolean {
  const diff = generateMigrationDiff(currentSchema, desiredSchema);
  return diff.changes.length > 0;
}
