/**
 * @fileoverview Analyzer definition parser for SurrealDB schema introspection.
 * @module migrator/introspection/analyzer-parser
 */

import { debugLog } from '../../utils/debug-logger';

/**
 * Parses an analyzer definition from INFO FOR DB result.
 *
 * @param analyzerName - The name of the analyzer
 * @param analyzerDef - The definition string from INFO FOR DB
 * @returns Parsed analyzer object
 */
export function parseAnalyzerDefinition(
  analyzerName: string,
  analyzerDef: string,
): Record<string, unknown> {
  debugLog(`Parsing analyzer definition for ${analyzerName}:`, analyzerDef);

  // Extract tokenizers (comma-separated list after TOKENIZERS keyword)
  const tokenizersMatch = analyzerDef.match(/TOKENIZERS?\s+([^;]+?)(?:\s+FILTERS?|$)/i);
  const tokenizers: string[] = [];
  if (tokenizersMatch) {
    tokenizers.push(
      ...tokenizersMatch[1]
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0),
    );
  }

  // Extract filters (comma-separated list after FILTERS keyword)
  const filtersMatch = analyzerDef.match(/FILTERS?\s+([^;]+?)(?:\s+FUNCTION|;|$)/i);
  const filters: string[] = [];
  if (filtersMatch) {
    filters.push(
      ...filtersMatch[1]
        .split(',')
        .map((f) => f.trim())
        .filter((f) => f.length > 0),
    );
  }

  // Check for function-based analyzer (SurrealDB 3.x)
  const functionMatch = analyzerDef.match(/FUNCTION\s+fn::(\w+)/i);
  const customFunction = functionMatch ? functionMatch[1] : null;

  return {
    name: analyzerName,
    tokenizers,
    filters,
    function: customFunction,
  };
}
