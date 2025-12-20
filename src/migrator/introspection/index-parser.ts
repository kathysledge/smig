/**
 * @fileoverview Index definition parser for SurrealDB schema introspection.
 * @module migrator/introspection/index-parser
 */

import type { DistanceMetric, IndexType } from '../../schema/indexes';

/**
 * Extracts column names from an index definition.
 */
export function extractIndexColumns(indexDef: string): string[] {
  // SurrealDB uses FIELDS instead of COLUMNS in index definitions
  // Match FIELDS followed by column names, stopping before UNIQUE or other keywords
  const fieldsMatch = indexDef.match(
    /FIELDS\s+([^;]+?)(?:\s+(?:UNIQUE|SEARCH|BTREE|HASH|MTREE|HNSW|$))/,
  );
  if (!fieldsMatch) {
    // Fallback: try to match everything after FIELDS until semicolon
    const fallbackMatch = indexDef.match(/FIELDS\s+([^;]+)/);
    if (!fallbackMatch) {
      return [];
    }
    // Remove keywords that might be at the end
    const columnsStr = fallbackMatch[1]
      .replace(/\s+(UNIQUE|SEARCH|BTREE|HASH|MTREE|HNSW)\s*.*$/, '')
      .trim();
    return columnsStr
      .split(',')
      .map((col) => col.trim())
      .filter((col) => col.length > 0);
  }
  return fieldsMatch[1]
    .split(',')
    .map((col) => col.trim())
    .filter((col) => col.length > 0);
}

/**
 * Checks if an index is unique.
 */
export function isIndexUnique(indexDef: string): boolean {
  return indexDef.includes('UNIQUE');
}

/**
 * Extracts the index type from a definition.
 */
export function extractIndexType(indexDef: string): IndexType {
  if (indexDef.includes('HNSW')) return 'HNSW';
  if (indexDef.includes('MTREE')) return 'MTREE';
  if (indexDef.includes('SEARCH')) return 'SEARCH';
  if (indexDef.includes('HASH')) return 'HASH';
  return 'BTREE';
}

/**
 * Extracts the DIMENSION value for vector indexes.
 */
export function extractIndexDimension(indexDef: string): number | null {
  const match = indexDef.match(/DIMENSION\s+(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Extracts the DIST (distance metric) for vector indexes.
 */
export function extractIndexDist(indexDef: string): DistanceMetric | null {
  const match = indexDef.match(
    /DIST\s+(COSINE|EUCLIDEAN|MANHATTAN|MINKOWSKI|CHEBYSHEV|HAMMING|JACCARD|PEARSON)/i,
  );
  return match ? (match[1].toUpperCase() as DistanceMetric) : null;
}

/**
 * Extracts the CAPACITY for MTREE indexes.
 */
export function extractIndexCapacity(indexDef: string): number | null {
  const match = indexDef.match(/CAPACITY\s+(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Extracts the EFC (efConstruction) for HNSW indexes.
 */
export function extractIndexEfc(indexDef: string): number | null {
  const match = indexDef.match(/EFC\s+(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Extracts the M (maxConnections) for HNSW indexes.
 */
export function extractIndexM(indexDef: string): number | null {
  const match = indexDef.match(/\bM\s+(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Extracts the analyzer name for SEARCH indexes.
 */
export function extractIndexAnalyzer(indexDef: string): string | null {
  const match = indexDef.match(/ANALYZER\s+(\w+)/i);
  return match ? match[1] : null;
}

/**
 * Checks if a SEARCH index has HIGHLIGHTS enabled.
 */
export function hasIndexHighlights(indexDef: string): boolean {
  return /\bHIGHLIGHTS\b/i.test(indexDef);
}

/**
 * Parses a complete index definition string into a structured object.
 */
export function parseIndexDefinition(indexName: string, indexDef: string): Record<string, unknown> {
  const type = extractIndexType(indexDef);

  const parsed: Record<string, unknown> = {
    name: indexName,
    columns: extractIndexColumns(indexDef),
    unique: isIndexUnique(indexDef),
    type,
  };

  // Add type-specific properties
  if (type === 'SEARCH') {
    parsed.analyzer = extractIndexAnalyzer(indexDef);
    parsed.highlights = hasIndexHighlights(indexDef);
  }

  if (type === 'MTREE' || type === 'HNSW') {
    parsed.dimension = extractIndexDimension(indexDef);
    parsed.dist = extractIndexDist(indexDef);
  }

  if (type === 'MTREE') {
    parsed.capacity = extractIndexCapacity(indexDef);
  }

  if (type === 'HNSW') {
    parsed.efc = extractIndexEfc(indexDef);
    parsed.m = extractIndexM(indexDef);
  }

  return parsed;
}
