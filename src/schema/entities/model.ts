/**
 * @fileoverview ML Model builder for SurrealDB.
 * @module schema/entities/model
 */

import { validateIdentifier } from '../common/utils';

/**
 * Model definition builder for SurrealDB ML integration.
 *
 * Models define machine learning models that can be used for inference
 * within SurrealDB queries. SurrealDB 3.x supports integration with
 * machine learning models for predictions, embeddings, and more.
 *
 * @example
 * ```typescript
 * // Define an embedding model
 * const embedder = model('embedder')
 *   .version('1.0.0')
 *   .permission('FULL');
 *
 * // Define a classification model
 * const classifier = model('sentiment')
 *   .version('2.1.0')
 *   .comment('Sentiment analysis model');
 * ```
 */
export class SurrealQLModel {
  private model: Record<string, unknown> = {
    name: '',
    version: null,
    permission: null,
    comments: [],
    previousNames: [],
    ifNotExists: false,
    overwrite: false,
  };

  constructor(name: string) {
    validateIdentifier(name, 'Model');
    this.model.name = name.trim();
  }

  /** Uses IF NOT EXISTS clause when defining the model */
  ifNotExists() {
    this.model.ifNotExists = true;
    return this;
  }

  /** Uses OVERWRITE clause when redefining the model */
  overwrite() {
    this.model.overwrite = true;
    return this;
  }

  /**
   * Sets the version for the model.
   *
   * @param ver - The version string (e.g., '1.0.0')
   * @returns The model instance for method chaining
   */
  version(ver: string) {
    this.model.version = ver;
    return this;
  }

  /**
   * Sets the permission for the model.
   *
   * @param perm - Permission expression
   * @returns The model instance for method chaining
   */
  permission(perm: string) {
    this.model.permission = perm;
    return this;
  }

  /** Adds a documentation comment */
  comment(text: string) {
    if (text && text.trim() !== '') {
      // biome-ignore lint/suspicious/noExplicitAny: Dynamic comment array
      (this.model.comments as any[]).push(text.trim());
    }
    return this;
  }

  /**
   * Tracks previous name(s) for this model.
   *
   * @param names - Previous model name(s)
   * @returns The model instance for method chaining
   */
  was(names: string | string[]) {
    const nameArray = Array.isArray(names) ? names : [names];
    (this.model.previousNames as string[]).push(...nameArray);
    return this;
  }

  /** Builds and validates the complete model definition */
  build() {
    return {
      name: this.model.name,
      version: this.model.version,
      permission: this.model.permission,
      comments: [...(this.model.comments as string[])],
      previousNames: [...(this.model.previousNames as string[])],
      ifNotExists: this.model.ifNotExists,
      overwrite: this.model.overwrite,
    };
  }
}
