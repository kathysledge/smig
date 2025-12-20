/**
 * @fileoverview Analyzer builder for SurrealDB full-text search.
 * @module schema/entities/analyzer
 */

import { validateIdentifier } from '../common/utils';

/**
 * Analyzer definition builder for full-text search.
 *
 * Analyzers process text for full-text search indexes, defining how text
 * is tokenized (split into terms) and filtered (normalized, stemmed, etc.)
 * for search operations.
 *
 * ## Tokenizers
 *
 * - **blank**: Split on whitespace
 * - **class**: Split on character class changes (camelCase, etc.)
 * - **camel**: Split on camelCase boundaries
 * - **punct**: Split on punctuation
 *
 * ## Filters
 *
 * - **ascii**: Convert to ASCII
 * - **lowercase**: Convert to lowercase
 * - **uppercase**: Convert to uppercase
 * - **edgengram(min, max)**: Create edge n-grams
 * - **ngram(min, max)**: Create n-grams
 * - **snowball(language)**: Apply Snowball stemming (e.g., 'english', 'spanish')
 *
 * @example
 * ```typescript
 * // English text search
 * const englishSearch = analyzer('english_search')
 *   .tokenizers(['class', 'camel', 'blank'])
 *   .filters(['lowercase', 'ascii', 'snowball(english)']);
 *
 * // Autocomplete search
 * const autocomplete = analyzer('autocomplete')
 *   .tokenizers(['blank'])
 *   .filters(['lowercase', 'edgengram(2, 15)']);
 *
 * // Case-insensitive search
 * const caseInsensitive = analyzer('case_insensitive')
 *   .tokenizers(['blank'])
 *   .filters(['lowercase']);
 * ```
 */
export class SurrealQLAnalyzer {
  private analyzer: Record<string, unknown> = {
    name: '',
    tokenizers: [],
    filters: [],
    comments: [],
    previousNames: [],
    ifNotExists: false,
    overwrite: false,
    // SurrealDB 3.x: function-based analyzer
    function: null,
  };

  constructor(name: string) {
    validateIdentifier(name, 'Analyzer');
    this.analyzer.name = name.trim();
  }

  /** Uses IF NOT EXISTS clause when defining the analyzer */
  ifNotExists() {
    this.analyzer.ifNotExists = true;
    return this;
  }

  /** Uses OVERWRITE clause when redefining the analyzer */
  overwrite() {
    this.analyzer.overwrite = true;
    return this;
  }

  /**
   * Sets the tokenizers for the analyzer.
   *
   * @param tokenizers - Array of tokenizer names
   * @returns The analyzer instance for method chaining
   */
  tokenizers(tokenizers: string[]) {
    if (!tokenizers || tokenizers.length === 0) {
      throw new Error('At least one tokenizer is required');
    }
    this.analyzer.tokenizers = tokenizers;
    return this;
  }

  /**
   * Sets the filters for the analyzer.
   *
   * @param filters - Array of filter names
   * @returns The analyzer instance for method chaining
   */
  filters(filters: string[]) {
    if (!filters || filters.length === 0) {
      throw new Error('At least one filter is required');
    }
    this.analyzer.filters = filters;
    return this;
  }

  /**
   * Sets a custom function for the analyzer (SurrealDB 3.x).
   *
   * @param fnName - The function name to use for analysis
   * @returns The analyzer instance for method chaining
   */
  function(fnName: string) {
    this.analyzer.function = fnName;
    return this;
  }

  /** Adds a documentation comment for the analyzer */
  comment(text: string) {
    if (text && text.trim() !== '') {
      // biome-ignore lint/suspicious/noExplicitAny: Dynamic comment array
      (this.analyzer.comments as any[]).push(text.trim());
    }
    return this;
  }

  /**
   * Tracks previous name(s) for this analyzer (for ALTER ANALYZER RENAME operations).
   *
   * @param names - Previous analyzer name(s)
   * @returns The analyzer instance for method chaining
   */
  was(names: string | string[]) {
    const nameArray = Array.isArray(names) ? names : [names];
    (this.analyzer.previousNames as string[]).push(...nameArray);
    return this;
  }

  /** Builds and validates the complete analyzer definition */
  build() {
    // If function is set, tokenizers/filters are optional
    if (!this.analyzer.function) {
      if (!this.analyzer.tokenizers || (this.analyzer.tokenizers as string[]).length === 0) {
        throw new Error(
          `Analyzer ${this.analyzer.name} requires at least one tokenizer. Use .tokenizers(['blank']).`,
        );
      }

      if (!this.analyzer.filters || (this.analyzer.filters as string[]).length === 0) {
        throw new Error(
          `Analyzer ${this.analyzer.name} requires at least one filter. Use .filters(['lowercase']).`,
        );
      }
    }

    return {
      name: this.analyzer.name,
      tokenizers: this.analyzer.tokenizers,
      filters: this.analyzer.filters,
      function: this.analyzer.function,
      comments: [...(this.analyzer.comments as string[])],
      previousNames: [...(this.analyzer.previousNames as string[])],
      ifNotExists: this.analyzer.ifNotExists,
      overwrite: this.analyzer.overwrite,
    };
  }
}
