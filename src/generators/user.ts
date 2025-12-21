/**
 * @fileoverview SQL generator for USER definitions.
 * @module generators/user
 */

import type { UserRole } from '../schema/entities/user';
import type { GeneratorOptions } from './table';

/**
 * User definition object (from builder's build() output).
 */
export interface UserDefinition {
  name: string;
  password?: string | null;
  passhash?: string | null;
  role?: UserRole | null;
  roles?: UserRole[];
  level: 'ROOT' | 'NAMESPACE' | 'DATABASE';
  duration?: string | null;
  comments?: string[];
  previousNames?: string[];
  ifNotExists?: boolean;
  overwrite?: boolean;
}

/**
 * Generates DEFINE USER SQL statement.
 */
export function generateUserDefinition(
  user: UserDefinition,
  options: GeneratorOptions = {},
): string {
  const parts: string[] = ['DEFINE USER'];

  // IF NOT EXISTS / OVERWRITE
  if (options.ifNotExists || user.ifNotExists) {
    parts.push('IF NOT EXISTS');
  } else if (user.overwrite) {
    parts.push('OVERWRITE');
  }

  // User name
  parts.push(user.name);

  // ON level
  parts.push('ON', user.level);

  // Password or passhash
  if (user.password) {
    parts.push(`PASSWORD "${user.password}"`);
  } else if (user.passhash) {
    parts.push(`PASSHASH "${user.passhash}"`);
  }

  // Roles
  if (user.roles && user.roles.length > 0) {
    parts.push(`ROLES ${user.roles.join(', ')}`);
  } else if (user.role) {
    parts.push(`ROLES ${user.role}`);
  }

  // Duration
  if (user.duration) {
    parts.push(`DURATION FOR SESSION ${user.duration}`);
  }

  // Comment
  if (options.includeComments && user.comments?.length) {
    parts.push(`COMMENT "${user.comments[0].replace(/"/g, '\\"')}"`);
  }

  return `${parts.join(' ')};`;
}

/**
 * Generates ALTER USER RENAME statement.
 */
export function generateUserRename(
  oldName: string,
  newName: string,
  level: 'ROOT' | 'NAMESPACE' | 'DATABASE' = 'DATABASE',
): string {
  return `ALTER USER ${oldName} ON ${level} RENAME TO ${newName};`;
}

/**
 * Generates REMOVE USER statement.
 */
export function generateUserRemove(
  name: string,
  level: 'ROOT' | 'NAMESPACE' | 'DATABASE' = 'DATABASE',
): string {
  return `REMOVE USER ${name} ON ${level};`;
}
