/**
 * @fileoverview SQL generator for ANALYZER definitions.
 * @module generators/analyzer
 */

import type { GeneratorOptions } from './table';

/**
 * Analyzer definition object (from builder's build() output).
 */
export interface AnalyzerDefinition {
  name: string;
  tokenizers: string[];
  filters: string[];
  function?: string | null;
  comments?: string[];
  previousNames?: string[];
  ifNotExists?: boolean;
  overwrite?: boolean;
}

/**
 * Generates DEFINE ANALYZER SQL statement.
 */
export function generateAnalyzerDefinition(
  analyzer: AnalyzerDefinition,
  options: GeneratorOptions = {},
): string {
  const parts: string[] = ['DEFINE ANALYZER'];

  // IF NOT EXISTS / OVERWRITE
  if (options.ifNotExists || analyzer.ifNotExists) {
    parts.push('IF NOT EXISTS');
  } else if (analyzer.overwrite) {
    parts.push('OVERWRITE');
  }

  // Analyzer name
  parts.push(analyzer.name);

  // Function-based analyzer (SurrealDB 3.x)
  if (analyzer.function) {
    parts.push(`FUNCTION fn::${analyzer.function}`);
  } else {
    // Tokenizers
    if (analyzer.tokenizers?.length) {
      parts.push('TOKENIZERS', analyzer.tokenizers.join(','));
    }

    // Filters
    if (analyzer.filters?.length) {
      parts.push('FILTERS', analyzer.filters.join(','));
    }
  }

  // Comment
  if (options.includeComments && analyzer.comments?.length) {
    parts.push(`COMMENT "${analyzer.comments[0].replace(/"/g, '\\"')}"`);
  }

  return parts.join(' ') + ';';
}

/**
 * Generates ALTER ANALYZER RENAME statement.
 */
export function generateAnalyzerRename(oldName: string, newName: string): string {
  return `ALTER ANALYZER ${oldName} RENAME TO ${newName};`;
}

/**
 * Generates REMOVE ANALYZER statement.
 */
export function generateAnalyzerRemove(name: string): string {
  return `REMOVE ANALYZER ${name};`;
}
