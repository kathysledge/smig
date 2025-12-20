/**
 * @fileoverview Access (authentication) builder for SurrealDB.
 * @module schema/entities/access
 *
 * SurrealDB 3.x replaced SCOPE with ACCESS for authentication definitions.
 * This module supports both the new ACCESS syntax and maintains backwards
 * compatibility with the SCOPE syntax.
 */

import { processSurrealQL, validateIdentifier } from '../common/utils';

/**
 * Access type enumeration.
 */
export type AccessType = 'JWT' | 'RECORD' | 'BEARER';

/**
 * JWT algorithm types.
 */
export type JwtAlgorithm =
  | 'HS256'
  | 'HS384'
  | 'HS512'
  | 'RS256'
  | 'RS384'
  | 'RS512'
  | 'ES256'
  | 'ES384'
  | 'ES512'
  | 'PS256'
  | 'PS384'
  | 'PS512'
  | 'EDDSA';

/**
 * Access definition builder for SurrealDB authentication.
 *
 * Access methods define how users authenticate with the database.
 * SurrealDB 3.x supports three types:
 *
 * - **JWT**: JSON Web Token authentication
 * - **RECORD**: Record-based authentication (formerly SCOPE)
 * - **BEARER**: Bearer token authentication
 *
 * @example
 * ```typescript
 * // JWT authentication
 * const jwtAccess = access('api')
 *   .jwt()
 *   .algorithm('HS256')
 *   .key('my-secret-key');
 *
 * // Record-based authentication (like old SCOPE)
 * const userAccess = access('user')
 *   .record()
 *   .signup(`
 *     CREATE user SET
 *       email = $email,
 *       password = crypto::argon2::generate($password)
 *   `)
 *   .signin(`
 *     SELECT * FROM user
 *     WHERE email = $email
 *     AND crypto::argon2::compare(password, $password)
 *   `)
 *   .session('7d');
 *
 * // Bearer token authentication
 * const bearerAccess = access('api_key')
 *   .bearer()
 *   .key('key', 'string');
 * ```
 */
export class SurrealQLAccess {
  private access: Record<string, unknown> = {
    name: '',
    type: null,
    // JWT options
    algorithm: null,
    key: null,
    url: null, // For JWKS
    issuer: null,
    // RECORD options (replaces SCOPE)
    signup: null,
    signin: null,
    session: null,
    authenticate: null,
    // BEARER options
    bearerKey: null,
    bearerType: null,
    // Common
    comments: [],
    previousNames: [],
    ifNotExists: false,
    overwrite: false,
    duration: null,
    // Level (namespace or database)
    level: 'DATABASE',
  };

  constructor(name: string) {
    validateIdentifier(name, 'Access');
    this.access.name = name.trim();
  }

  /** Uses IF NOT EXISTS clause when defining the access */
  ifNotExists() {
    this.access.ifNotExists = true;
    return this;
  }

  /** Uses OVERWRITE clause when redefining the access */
  overwrite() {
    this.access.overwrite = true;
    return this;
  }

  /** Sets access type to JWT */
  jwt() {
    this.access.type = 'JWT';
    return this;
  }

  /** Sets access type to RECORD (formerly SCOPE) */
  record() {
    this.access.type = 'RECORD';
    return this;
  }

  /** Sets access type to BEARER */
  bearer() {
    this.access.type = 'BEARER';
    return this;
  }

  /** Sets this access at namespace level */
  onNamespace() {
    this.access.level = 'NAMESPACE';
    return this;
  }

  /** Sets this access at database level (default) */
  onDatabase() {
    this.access.level = 'DATABASE';
    return this;
  }

  /**
   * Sets the JWT algorithm.
   *
   * @param alg - The algorithm to use
   * @returns The access instance for method chaining
   */
  algorithm(alg: JwtAlgorithm) {
    this.access.algorithm = alg;
    return this;
  }

  /**
   * Sets the key for JWT or BEARER authentication.
   *
   * For JWT: This is the secret or public key.
   * For BEARER: This is the key field name and type.
   *
   * @param key - The key value or field name
   * @param type - For BEARER, the field type
   * @returns The access instance for method chaining
   */
  key(key: string, type?: string) {
    if (type) {
      // BEARER key definition
      this.access.bearerKey = key;
      this.access.bearerType = type;
    } else {
      // JWT key
      this.access.key = key;
    }
    return this;
  }

  /**
   * Sets the JWKS URL for JWT authentication.
   *
   * @param url - The JWKS endpoint URL
   * @returns The access instance for method chaining
   */
  url(url: string) {
    this.access.url = url;
    return this;
  }

  /**
   * Sets the expected issuer for JWT authentication.
   *
   * @param issuer - The expected issuer claim
   * @returns The access instance for method chaining
   */
  issuer(issuer: string) {
    this.access.issuer = issuer;
    return this;
  }

  /**
   * Sets the SIGNUP query for RECORD authentication.
   *
   * @param query - SurrealQL for signup logic
   * @returns The access instance for method chaining
   */
  signup(query: string) {
    if (!query || query.trim() === '') {
      throw new Error('SIGNUP clause is required and cannot be empty');
    }
    this.access.signup = processSurrealQL(query);
    return this;
  }

  /**
   * Sets the SIGNIN query for RECORD authentication.
   *
   * @param query - SurrealQL for signin logic
   * @returns The access instance for method chaining
   */
  signin(query: string) {
    if (!query || query.trim() === '') {
      throw new Error('SIGNIN clause is required and cannot be empty');
    }
    this.access.signin = processSurrealQL(query);
    return this;
  }

  /**
   * Sets the session duration for RECORD authentication.
   *
   * @param duration - Duration string (e.g., '7d', '24h')
   * @returns The access instance for method chaining
   */
  session(duration: string) {
    this.access.session = duration;
    return this;
  }

  /**
   * Sets the AUTHENTICATE clause for custom authentication logic.
   *
   * @param query - SurrealQL for authentication logic
   * @returns The access instance for method chaining
   */
  authenticate(query: string) {
    this.access.authenticate = processSurrealQL(query);
    return this;
  }

  /**
   * Sets the token duration (for BEARER/JWT).
   *
   * @param duration - Duration string (e.g., '1h', '30d')
   * @returns The access instance for method chaining
   */
  duration(duration: string) {
    this.access.duration = duration;
    return this;
  }

  /** Adds a documentation comment */
  comment(text: string) {
    if (text && text.trim() !== '') {
      // biome-ignore lint/suspicious/noExplicitAny: Dynamic comment array
      (this.access.comments as any[]).push(text.trim());
    }
    return this;
  }

  /**
   * Tracks previous name(s) for this access (for ALTER ACCESS RENAME operations).
   *
   * @param names - Previous access name(s)
   * @returns The access instance for method chaining
   */
  was(names: string | string[]) {
    const nameArray = Array.isArray(names) ? names : [names];
    (this.access.previousNames as string[]).push(...nameArray);
    return this;
  }

  /** Builds and validates the complete access definition */
  build() {
    if (!this.access.type) {
      throw new Error('Access type must be set. Use .jwt(), .record(), or .bearer().');
    }

    return {
      name: this.access.name,
      type: this.access.type,
      level: this.access.level,
      // JWT
      algorithm: this.access.algorithm,
      key: this.access.key,
      url: this.access.url,
      issuer: this.access.issuer,
      // RECORD
      signup: this.access.signup,
      signin: this.access.signin,
      session: this.access.session,
      authenticate: this.access.authenticate,
      // BEARER
      bearerKey: this.access.bearerKey,
      bearerType: this.access.bearerType,
      // Common
      duration: this.access.duration,
      comments: [...(this.access.comments as string[])],
      previousNames: [...(this.access.previousNames as string[])],
      ifNotExists: this.access.ifNotExists,
      overwrite: this.access.overwrite,
    };
  }
}

/**
 * Scope definition builder for SurrealDB authentication.
 *
 * @deprecated Use SurrealQLAccess with .record() instead. SCOPE is deprecated in SurrealDB 3.x.
 *
 * Scopes provide session-based authentication with custom SIGNUP and SIGNIN logic.
 * They define how users authenticate, session duration, and what data is available
 * during the session.
 */
export class SurrealQLScope {
  private scope: Record<string, unknown> = {
    name: '',
    session: null,
    signup: null,
    signin: null,
    comments: [],
    previousNames: [],
    ifNotExists: false,
    overwrite: false,
  };

  constructor(name: string) {
    validateIdentifier(name, 'Scope');
    this.scope.name = name.trim();
  }

  /** Uses IF NOT EXISTS clause when defining the scope */
  ifNotExists() {
    this.scope.ifNotExists = true;
    return this;
  }

  /** Uses OVERWRITE clause when redefining the scope */
  overwrite() {
    this.scope.overwrite = true;
    return this;
  }

  /**
   * Sets the session duration for the scope.
   *
   * @param duration - Duration string (e.g., '7d', '24h', '30m', '60s')
   * @returns The scope instance for method chaining
   */
  session(duration: string) {
    this.scope.session = duration;
    return this;
  }

  /**
   * Sets the SIGNUP logic for the scope.
   *
   * @param query - SurrealQL for signup logic
   * @returns The scope instance for method chaining
   */
  signup(query: string) {
    if (!query || query.trim() === '') {
      throw new Error('SIGNUP clause is required and cannot be empty');
    }
    this.scope.signup = processSurrealQL(query);
    return this;
  }

  /**
   * Sets the SIGNIN logic for the scope.
   *
   * @param query - SurrealQL for signin logic
   * @returns The scope instance for method chaining
   */
  signin(query: string) {
    if (!query || query.trim() === '') {
      throw new Error('SIGNIN clause is required and cannot be empty');
    }
    this.scope.signin = processSurrealQL(query);
    return this;
  }

  /** Adds a documentation comment for the scope */
  comment(text: string) {
    if (text && text.trim() !== '') {
      // biome-ignore lint/suspicious/noExplicitAny: Dynamic comment array
      (this.scope.comments as any[]).push(text.trim());
    }
    return this;
  }

  /**
   * Tracks previous name(s) for this scope.
   *
   * @param names - Previous scope name(s)
   * @returns The scope instance for method chaining
   */
  was(names: string | string[]) {
    const nameArray = Array.isArray(names) ? names : [names];
    (this.scope.previousNames as string[]).push(...nameArray);
    return this;
  }

  /** Builds and validates the complete scope definition */
  build() {
    // At least one of signup or signin must be provided
    if (!this.scope.signup && !this.scope.signin) {
      throw new Error(
        `Scope ${this.scope.name} requires at least SIGNUP or SIGNIN logic. Use .signup() or .signin().`,
      );
    }

    return {
      name: this.scope.name,
      session: this.scope.session,
      signup: this.scope.signup,
      signin: this.scope.signin,
      comments: [...(this.scope.comments as string[])],
      previousNames: [...(this.scope.previousNames as string[])],
      ifNotExists: this.scope.ifNotExists,
      overwrite: this.scope.overwrite,
    };
  }
}
