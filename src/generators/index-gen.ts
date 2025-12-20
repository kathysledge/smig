/**
 * @fileoverview SQL generator for INDEX definitions.
 * @module generators/index
 */

import type { DistanceMetric, IndexType } from '../schema/indexes';
import type { GeneratorOptions } from './table';

/**
 * Index definition object (from builder's build() output).
 */
export interface IndexDefinition {
  name?: string;
  columns: string[];
  unique?: boolean;
  type: IndexType;
  // Search options
  analyzer?: string | null;
  highlights?: boolean;
  bm25?: { k1?: number; b?: number } | null;
  docIdsCache?: number | null;
  docLengthsCache?: number | null;
  postingsCache?: number | null;
  termsCache?: number | null;
  // Vector options (MTREE/HNSW)
  dimension?: number | null;
  dist?: DistanceMetric | null;
  // MTREE-specific
  capacity?: number | null;
  // HNSW-specific
  efc?: number | null;
  m?: number | null;
  m0?: number | null;
  lm?: number | null;
  // Metadata
  comments?: string[];
  previousNames?: string[];
  ifNotExists?: boolean;
  overwrite?: boolean;
  concurrently?: boolean;
}

/**
 * Generates DEFINE INDEX SQL statement.
 */
export function generateIndexDefinition(
  tableName: string,
  indexName: string,
  index: IndexDefinition,
  options: GeneratorOptions = {},
): string {
  const parts: string[] = ['DEFINE INDEX'];

  // IF NOT EXISTS / OVERWRITE
  if (options.ifNotExists || index.ifNotExists) {
    parts.push('IF NOT EXISTS');
  } else if (index.overwrite) {
    parts.push('OVERWRITE');
  }

  // Index name
  parts.push(indexName);

  // ON TABLE
  parts.push('ON TABLE', tableName);

  // FIELDS/COLUMNS
  const columnsStr = index.columns.join(', ');
  parts.push('FIELDS', columnsStr);

  // Index type and options
  switch (index.type) {
    case 'BTREE':
      // BTREE is default, only add if unique
      if (index.unique) {
        parts.push('UNIQUE');
      }
      break;

    case 'HASH':
      // Note: SurrealDB 3.x doesn't support HASH as a keyword.
      // BTREE handles equality lookups efficiently, so we use that.
      // Only add UNIQUE if specified.
      if (index.unique) {
        parts.push('UNIQUE');
      }
      break;

    case 'SEARCH':
      // SurrealDB uses FULLTEXT keyword for full-text search indexes
      if (index.analyzer) {
        parts.push('FULLTEXT ANALYZER', index.analyzer);
      }
      if (index.bm25) {
        let bm25Str = 'BM25';
        if (index.bm25.k1 !== undefined || index.bm25.b !== undefined) {
          const params: string[] = [];
          if (index.bm25.k1 !== undefined) params.push(String(index.bm25.k1));
          if (index.bm25.b !== undefined) params.push(String(index.bm25.b));
          bm25Str += `(${params.join(',')})`;
        }
        parts.push(bm25Str);
      }
      if (index.highlights) {
        parts.push('HIGHLIGHTS');
      }
      // Cache options
      if (index.docIdsCache) {
        parts.push(`DOC_IDS_CACHE ${index.docIdsCache}`);
      }
      if (index.docLengthsCache) {
        parts.push(`DOC_LENGTHS_CACHE ${index.docLengthsCache}`);
      }
      if (index.postingsCache) {
        parts.push(`POSTINGS_CACHE ${index.postingsCache}`);
      }
      if (index.termsCache) {
        parts.push(`TERMS_CACHE ${index.termsCache}`);
      }
      break;

    case 'MTREE':
      parts.push('MTREE');
      if (index.dimension) {
        parts.push(`DIMENSION ${index.dimension}`);
      }
      if (index.dist) {
        parts.push(`DIST ${index.dist}`);
      }
      if (index.capacity) {
        parts.push(`CAPACITY ${index.capacity}`);
      }
      break;

    case 'HNSW':
      parts.push('HNSW');
      if (index.dimension) {
        parts.push(`DIMENSION ${index.dimension}`);
      }
      if (index.dist) {
        parts.push(`DIST ${index.dist}`);
      }
      if (index.efc) {
        parts.push(`EFC ${index.efc}`);
      }
      if (index.m) {
        parts.push(`M ${index.m}`);
      }
      if (index.m0) {
        parts.push(`M0 ${index.m0}`);
      }
      if (index.lm) {
        parts.push(`LM ${index.lm}`);
      }
      break;
  }

  // CONCURRENTLY (SurrealDB 3.x)
  if (index.concurrently) {
    parts.push('CONCURRENTLY');
  }

  // Comment
  if (options.includeComments && index.comments?.length) {
    parts.push(`COMMENT "${index.comments[0].replace(/"/g, '\\"')}"`);
  }

  return parts.join(' ') + ';';
}

/**
 * Generates ALTER INDEX RENAME statement.
 */
export function generateIndexRename(tableName: string, oldName: string, newName: string): string {
  return `ALTER INDEX ${oldName} ON TABLE ${tableName} RENAME TO ${newName};`;
}

/**
 * Generates REMOVE INDEX statement.
 */
export function generateIndexRemove(tableName: string, indexName: string): string {
  return `REMOVE INDEX ${indexName} ON TABLE ${tableName};`;
}
