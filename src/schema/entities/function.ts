/**
 * @fileoverview Function builder for SurrealDB.
 * @module schema/entities/function
 */

import { processSurrealQL, validateFunctionName } from '../common/utils';

/**
 * Function definition builder for SurrealDB custom functions.
 *
 * Functions allow you to define reusable logic that can be called throughout
 * your database queries. They support parameters, return types, and complex
 * SurrealQL expressions.
 *
 * ## Features
 *
 * - **Named parameters**: Define typed parameters for your function
 * - **Return type**: Optionally specify what type the function returns
 * - **Complex logic**: Write full SurrealQL with loops, conditionals, queries
 * - **Reusability**: Call functions anywhere in your queries
 *
 * @example
 * ```typescript
 * // Simple calculation function
 * const daysSince = fn('days_since')
 *   .param('time', 'datetime')
 *   .returns('float')
 *   .body('RETURN <float> (time::now() - $time) / 60 / 60 / 24;');
 *
 * // Complex function with multiple parameters
 * const calculateDiscount = fn('calculate_discount')
 *   .param('price', 'decimal')
 *   .param('discount_percent', 'int')
 *   .returns('decimal')
 *   .body(`
 *     LET $discount = $price * ($discount_percent / 100);
 *     RETURN $price - $discount;
 *   `);
 * ```
 */
export class SurrealQLFunction {
  private func: Record<string, unknown> = {
    name: '',
    parameters: [],
    returnType: null,
    body: '',
    comments: [],
    previousNames: [],
    ifNotExists: false,
    overwrite: false,
    // SurrealDB 3.x features
    permissions: null,
  };

  constructor(name: string) {
    validateFunctionName(name);
    this.func.name = name.trim();
  }

  /** Uses IF NOT EXISTS clause when defining the function */
  ifNotExists() {
    this.func.ifNotExists = true;
    return this;
  }

  /** Uses OVERWRITE clause when redefining the function */
  overwrite() {
    this.func.overwrite = true;
    return this;
  }

  /**
   * Adds a parameter to the function.
   *
   * @param name - Parameter name (will be prefixed with $ in SurrealQL)
   * @param type - Parameter type (e.g., 'string', 'int', 'datetime')
   * @returns The function instance for method chaining
   */
  param(name: string, type: string) {
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic parameter building
    (this.func.parameters as any[]).push({ name, type });
    return this;
  }

  /**
   * Sets the return type of the function.
   *
   * @param type - Return type (e.g., 'string', 'int', 'array<string>')
   * @returns The function instance for method chaining
   */
  returns(type: string) {
    this.func.returnType = type;
    return this;
  }

  /**
   * Sets the function body (SurrealQL code).
   *
   * @param body - SurrealQL code to execute
   * @returns The function instance for method chaining
   */
  body(code: string) {
    if (!code || code.trim() === '') {
      throw new Error('Function body is required and cannot be empty');
    }
    this.func.body = processSurrealQL(code);
    return this;
  }

  /**
   * Sets permissions for the function.
   *
   * @param perms - Permission expression (e.g., 'FULL', 'NONE', 'WHERE ...')
   * @returns The function instance for method chaining
   */
  permissions(perms: string) {
    this.func.permissions = perms;
    return this;
  }

  /** Adds a documentation comment for the function */
  comment(text: string) {
    if (text && text.trim() !== '') {
      // biome-ignore lint/suspicious/noExplicitAny: Dynamic comment array
      (this.func.comments as any[]).push(text.trim());
    }
    return this;
  }

  /**
   * Tracks previous name(s) for this function (for ALTER FUNCTION RENAME operations).
   *
   * @param names - Previous function name(s)
   * @returns The function instance for method chaining
   */
  was(names: string | string[]) {
    const nameArray = Array.isArray(names) ? names : [names];
    (this.func.previousNames as string[]).push(...nameArray);
    return this;
  }

  /** Builds and validates the complete function definition */
  build() {
    if (!this.func.body || (this.func.body as string).trim() === '') {
      throw new Error(
        `Function ${this.func.name} requires a body. Use .body("your SurrealQL here").`,
      );
    }

    return {
      name: this.func.name,
      parameters: this.func.parameters,
      returnType: this.func.returnType,
      body: this.func.body,
      comments: [...(this.func.comments as string[])],
      previousNames: [...(this.func.previousNames as string[])],
      ifNotExists: this.func.ifNotExists,
      overwrite: this.func.overwrite,
      permissions: this.func.permissions,
    };
  }
}
