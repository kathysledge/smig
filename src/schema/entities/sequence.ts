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
 * SurrealDB 3.x feature.
 *
 * @example
 * ```typescript
 * // Simple sequence starting at 1
 * const orderNumber = sequence('order_number');
 *
 * // Sequence with custom start and increment
 * const invoiceNumber = sequence('invoice_number')
 *   .start(1000)
 *   .step(1);
 *
 * // Sequence with min/max bounds
 * const limitedSeq = sequence('limited_seq')
 *   .start(1)
 *   .min(1)
 *   .max(9999)
 *   .cycle(); // Restart when max is reached
 * ```
 */
export class SurrealQLSequence {
  private sequence: Record<string, unknown> = {
    name: '',
    start: null,
    step: null,
    min: null,
    max: null,
    cycle: false,
    cache: null,
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

  /**
   * Sets the increment step for the sequence.
   *
   * @param value - The increment value (can be negative)
   * @returns The sequence instance for method chaining
   */
  step(value: number) {
    this.sequence.step = value;
    return this;
  }

  /**
   * Sets the minimum value for the sequence.
   *
   * @param value - The minimum value
   * @returns The sequence instance for method chaining
   */
  min(value: number) {
    this.sequence.min = value;
    return this;
  }

  /**
   * Sets the maximum value for the sequence.
   *
   * @param value - The maximum value
   * @returns The sequence instance for method chaining
   */
  max(value: number) {
    this.sequence.max = value;
    return this;
  }

  /**
   * Enables cycling when min/max is reached.
   * When the sequence reaches the limit, it restarts from the opposite bound.
   *
   * @returns The sequence instance for method chaining
   */
  cycle() {
    this.sequence.cycle = true;
    return this;
  }

  /**
   * Disables cycling (sequence will error when limit is reached).
   *
   * @returns The sequence instance for method chaining
   */
  noCycle() {
    this.sequence.cycle = false;
    return this;
  }

  /**
   * Sets how many values to cache for performance.
   *
   * @param size - Number of values to cache
   * @returns The sequence instance for method chaining
   */
  cache(size: number) {
    this.sequence.cache = size;
    return this;
  }

  /** Adds a documentation comment */
  comment(text: string) {
    if (text && text.trim() !== '') {
      // biome-ignore lint/suspicious/noExplicitAny: Dynamic comment array
      (this.sequence.comments as any[]).push(text.trim());
    }
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
      step: this.sequence.step,
      min: this.sequence.min,
      max: this.sequence.max,
      cycle: this.sequence.cycle,
      cache: this.sequence.cache,
      comments: [...(this.sequence.comments as string[])],
      previousNames: [...(this.sequence.previousNames as string[])],
      ifNotExists: this.sequence.ifNotExists,
      overwrite: this.sequence.overwrite,
    };
  }
}
