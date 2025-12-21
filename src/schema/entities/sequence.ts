/**
 * @fileoverview Sequence builder for SurrealDB.
 * @module schema/entities/sequence
 */

import { validateIdentifier } from '../common/utils';

/**
 * Sequence definition builder for SurrealDB.
 *
 * Sequences provide auto-incrementing numeric values that can be used
 * for generating unique identifiers, order numbers, and other sequential data.
 *
 * @example
 * ```typescript
 * // Simple sequence starting at 1
 * const orderNumber = sequence('order_number');
 *
 * // Sequence with custom start value
 * const invoiceNumber = sequence('invoice_number')
 *   .start(1000);
 * ```
 */
export class SurrealQLSequence {
  private sequence: Record<string, unknown> = {
    name: '',
    start: null,
    comments: [],
    previousNames: [],
    ifNotExists: false,
    overwrite: false,
  };

  constructor(name: string) {
    validateIdentifier(name, 'Sequence');
    this.sequence.name = name.trim();
  }

  /** Uses IF NOT EXISTS clause when defining the sequence */
  ifNotExists() {
    this.sequence.ifNotExists = true;
    return this;
  }

  /** Uses OVERWRITE clause when redefining the sequence */
  overwrite() {
    this.sequence.overwrite = true;
    return this;
  }

  /**
   * Sets the starting value for the sequence.
   *
   * @param value - The starting value
   * @returns The sequence instance for method chaining
   */
  start(value: number) {
    this.sequence.start = value;
    return this;
  }

  /** Adds a documentation comment */
  comment(text: string) {
    if (text && text.trim() !== '') {
      (this.sequence.comments as string[]).push(text.trim());
    }
    return this;
  }

  /** Sets documentation comments (replaces any existing) */
  comments(texts: string[]) {
    this.sequence.comments = texts.filter((t) => t && t.trim() !== '').map((t) => t.trim());
    return this;
  }

  /**
   * Tracks previous name(s) for this sequence.
   *
   * @param names - Previous sequence name(s)
   * @returns The sequence instance for method chaining
   */
  was(names: string | string[]) {
    const nameArray = Array.isArray(names) ? names : [names];
    (this.sequence.previousNames as string[]).push(...nameArray);
    return this;
  }

  /** Builds and validates the complete sequence definition */
  build() {
    return {
      name: this.sequence.name,
      start: this.sequence.start,
      comments: [...(this.sequence.comments as string[])],
      previousNames: [...(this.sequence.previousNames as string[])],
      ifNotExists: this.sequence.ifNotExists,
      overwrite: this.sequence.overwrite,
    };
  }
}
