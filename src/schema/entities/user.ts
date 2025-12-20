/**
 * @fileoverview User builder for SurrealDB.
 * @module schema/entities/user
 */

import { validateIdentifier } from '../common/utils';

/**
 * User role types.
 */
export type UserRole = 'OWNER' | 'EDITOR' | 'VIEWER';

/**
 * User definition builder for SurrealDB.
 *
 * Users define database-level or namespace-level authentication
 * with assigned roles. This is different from ACCESS (which handles
 * application-level authentication).
 *
 * @example
 * ```typescript
 * // Database owner
 * const admin = user('admin')
 *   .password('secure-password')
 *   .role('OWNER')
 *   .onDatabase();
 *
 * // Read-only user
 * const reader = user('api_reader')
 *   .password('reader-password')
 *   .role('VIEWER')
 *   .onDatabase();
 *
 * // Namespace-level editor
 * const editor = user('editor')
 *   .password('editor-password')
 *   .role('EDITOR')
 *   .onNamespace();
 * ```
 */
export class SurrealQLUser {
  private user: Record<string, unknown> = {
    name: '',
    password: null,
    passhash: null,
    role: null,
    roles: [],
    level: 'DATABASE',
    comments: [],
    previousNames: [],
    ifNotExists: false,
    overwrite: false,
    // SurrealDB 3.x: duration
    duration: null,
  };

  constructor(name: string) {
    validateIdentifier(name, 'User');
    this.user.name = name.trim();
  }

  /** Uses IF NOT EXISTS clause when defining the user */
  ifNotExists() {
    this.user.ifNotExists = true;
    return this;
  }

  /** Uses OVERWRITE clause when redefining the user */
  overwrite() {
    this.user.overwrite = true;
    return this;
  }

  /**
   * Sets the password for the user.
   *
   * @param pwd - The plaintext password (will be hashed by SurrealDB)
   * @returns The user instance for method chaining
   */
  password(pwd: string) {
    if (!pwd || pwd.trim() === '') {
      throw new Error('Password is required and cannot be empty');
    }
    this.user.password = pwd;
    return this;
  }

  /**
   * Sets the password hash for the user.
   *
   * @param hash - The pre-hashed password
   * @returns The user instance for method chaining
   */
  passhash(hash: string) {
    if (!hash || hash.trim() === '') {
      throw new Error('Password hash is required and cannot be empty');
    }
    this.user.passhash = hash;
    return this;
  }

  /**
   * Sets the role for the user.
   *
   * @param role - The role (OWNER, EDITOR, VIEWER)
   * @returns The user instance for method chaining
   */
  role(role: UserRole) {
    this.user.role = role;
    return this;
  }

  /**
   * Sets multiple roles for the user (SurrealDB 3.x).
   *
   * @param roles - Array of roles
   * @returns The user instance for method chaining
   */
  roles(roles: UserRole[]) {
    this.user.roles = roles;
    return this;
  }

  /**
   * Sets the session/token duration.
   *
   * @param duration - Duration string (e.g., '24h', '7d')
   * @returns The user instance for method chaining
   */
  duration(duration: string) {
    this.user.duration = duration;
    return this;
  }

  /** Sets this user at database level (default) */
  onDatabase() {
    this.user.level = 'DATABASE';
    return this;
  }

  /** Sets this user at namespace level */
  onNamespace() {
    this.user.level = 'NAMESPACE';
    return this;
  }

  /** Sets this user at root level */
  onRoot() {
    this.user.level = 'ROOT';
    return this;
  }

  /** Adds a documentation comment */
  comment(text: string) {
    if (text && text.trim() !== '') {
      // biome-ignore lint/suspicious/noExplicitAny: Dynamic comment array
      (this.user.comments as any[]).push(text.trim());
    }
    return this;
  }

  /**
   * Tracks previous name(s) for this user.
   *
   * @param names - Previous user name(s)
   * @returns The user instance for method chaining
   */
  was(names: string | string[]) {
    const nameArray = Array.isArray(names) ? names : [names];
    (this.user.previousNames as string[]).push(...nameArray);
    return this;
  }

  /** Builds and validates the complete user definition */
  build() {
    if (!this.user.password && !this.user.passhash) {
      throw new Error(
        `User ${this.user.name} requires a password. Use .password() or .passhash().`,
      );
    }

    if (!this.user.role && (this.user.roles as string[]).length === 0) {
      throw new Error(`User ${this.user.name} requires a role. Use .role() or .roles().`);
    }

    return {
      name: this.user.name,
      password: this.user.password,
      passhash: this.user.passhash,
      role: this.user.role,
      roles: [...(this.user.roles as string[])],
      level: this.user.level,
      duration: this.user.duration,
      comments: [...(this.user.comments as string[])],
      previousNames: [...(this.user.previousNames as string[])],
      ifNotExists: this.user.ifNotExists,
      overwrite: this.user.overwrite,
    };
  }
}
