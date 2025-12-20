/**
 * @fileoverview Parameter builder for SurrealDB.
 * @module schema/entities/param
 */

import { processSurrealQL, validateIdentifier } from '../common/utils';

/**
 * Parameter definition builder for SurrealDB.
 *
 * Parameters allow you to define global constants that can be used
 * throughout your database queries. They're useful for configuration
 * values, constants, and shared data.
 *
 * @example
 * ```typescript
 * // Simple value parameter
 * const appName = param('app_name').value('"My Application"');
 *
 * // Numeric parameter
 * const maxItems = param('max_items').value('100');
 *
 * // Complex parameter with computation
 * const defaultExpiry = param('default_expiry').value('time::now() + 30d');
 * ```
 */
export class SurrealQLParam {
  private param: Record<string, unknown> = {
    name: '',
    value: null,
    comments: [],
    previousNames: [],
    ifNotExists: false,
    overwrite: false,
  };

  constructor(name: string) {
    // Allow $ prefix in name
    const cleanName = name.startsWith('$') ? name.substring(1) : name;
    validateIdentifier(cleanName, 'Param');
    this.param.name = cleanName.trim();
  }

  /** Uses IF NOT EXISTS clause when defining the param */
  ifNotExists() {
    this.param.ifNotExists = true;
    return this;
  }

  /** Uses OVERWRITE clause when redefining the param */
  overwrite() {
    this.param.overwrite = true;
    return this;
  }

  /**
   * Sets the value for the parameter.
   *
   * @param val - The value expression (SurrealQL)
   * @returns The param instance for method chaining
   */
  value(val: string) {
    if (!val || val.trim() === '') {
      throw new Error('Parameter value is required and cannot be empty');
    }
    this.param.value = processSurrealQL(val);
    return this;
  }

  /** Adds a documentation comment */
  comment(text: string) {
    if (text && text.trim() !== '') {
      // biome-ignore lint/suspicious/noExplicitAny: Dynamic comment array
      (this.param.comments as any[]).push(text.trim());
    }
    return this;
  }

  /**
   * Tracks previous name(s) for this param.
   *
   * @param names - Previous param name(s)
   * @returns The param instance for method chaining
   */
  was(names: string | string[]) {
    const nameArray = Array.isArray(names) ? names : [names];
    (this.param.previousNames as string[]).push(...nameArray);
    return this;
  }

  /** Builds and validates the complete param definition */
  build() {
    if (!this.param.value) {
      throw new Error(`Param ${this.param.name} requires a value. Use .value("your value").`);
    }

    return {
      name: this.param.name,
      value: this.param.value,
      comments: [...(this.param.comments as string[])],
      previousNames: [...(this.param.previousNames as string[])],
      ifNotExists: this.param.ifNotExists,
      overwrite: this.param.overwrite,
    };
  }
}
