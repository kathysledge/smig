/**
 * @fileoverview SQL generator for ACCESS definitions.
 * @module generators/access
 */

import type { AccessType, JwtAlgorithm } from '../schema/entities/access';
import type { GeneratorOptions } from './table';

/**
 * Access definition object (from builder's build() output).
 */
export interface AccessDefinition {
  name: string;
  type: AccessType;
  level: 'NAMESPACE' | 'DATABASE';
  // JWT options
  algorithm?: JwtAlgorithm | null;
  key?: string | null;
  url?: string | null;
  issuer?: string | null;
  // RECORD options
  signup?: string | null;
  signin?: string | null;
  session?: string | null;
  authenticate?: string | null;
  // BEARER options
  bearerKey?: string | null;
  bearerType?: string | null;
  // Common
  duration?: string | null;
  comments?: string[];
  previousNames?: string[];
  ifNotExists?: boolean;
  overwrite?: boolean;
}

/**
 * Generates DEFINE ACCESS SQL statement.
 */
export function generateAccessDefinition(
  access: AccessDefinition,
  options: GeneratorOptions = {},
): string {
  const parts: string[] = ['DEFINE ACCESS'];

  // IF NOT EXISTS / OVERWRITE
  if (options.ifNotExists || access.ifNotExists) {
    parts.push('IF NOT EXISTS');
  } else if (access.overwrite) {
    parts.push('OVERWRITE');
  }

  // Access name
  parts.push(access.name);

  // ON level
  parts.push('ON', access.level);

  // Type-specific options
  switch (access.type) {
    case 'JWT':
      parts.push('TYPE JWT');
      if (access.algorithm && access.key) {
        parts.push(`ALGORITHM ${access.algorithm}`);
        parts.push(`KEY "${access.key}"`);
      } else if (access.url) {
        parts.push(`URL "${access.url}"`);
      }
      if (access.issuer) {
        parts.push(`ISSUER "${access.issuer}"`);
      }
      break;

    case 'RECORD':
      parts.push('TYPE RECORD');
      if (access.signup) {
        parts.push(`SIGNUP (${access.signup})`);
      }
      if (access.signin) {
        parts.push(`SIGNIN (${access.signin})`);
      }
      if (access.authenticate) {
        parts.push(`AUTHENTICATE (${access.authenticate})`);
      }
      break;

    case 'BEARER':
      parts.push('TYPE BEARER');
      if (access.bearerKey && access.bearerType) {
        parts.push(`KEY ${access.bearerKey} TYPE ${access.bearerType}`);
      }
      break;
  }

  // Session/Duration
  if (access.session) {
    parts.push(`SESSION ${access.session}`);
  }
  if (access.duration) {
    parts.push(`DURATION ${access.duration}`);
  }

  // Comment
  if (options.includeComments && access.comments?.length) {
    parts.push(`COMMENT "${access.comments[0].replace(/"/g, '\\"')}"`);
  }

  return `${parts.join(' ')};`;
}

/**
 * Generates ALTER ACCESS RENAME statement.
 */
export function generateAccessRename(
  oldName: string,
  newName: string,
  level: 'NAMESPACE' | 'DATABASE' = 'DATABASE',
): string {
  return `ALTER ACCESS ${oldName} ON ${level} RENAME TO ${newName};`;
}

/**
 * Generates REMOVE ACCESS statement.
 */
export function generateAccessRemove(
  name: string,
  level: 'NAMESPACE' | 'DATABASE' = 'DATABASE',
): string {
  return `REMOVE ACCESS ${name} ON ${level};`;
}

/**
 * Generates DEFINE SCOPE SQL statement (deprecated in SurrealDB 3.x).
 * @deprecated Use generateAccessDefinition with type RECORD instead.
 */
export interface ScopeDefinition {
  name: string;
  session?: string | null;
  signup?: string | null;
  signin?: string | null;
  comments?: string[];
  previousNames?: string[];
  ifNotExists?: boolean;
  overwrite?: boolean;
}

/**
 * Generates DEFINE SCOPE SQL statement.
 * @deprecated Use ACCESS with RECORD type instead.
 */
export function generateScopeDefinition(
  scope: ScopeDefinition,
  options: GeneratorOptions = {},
): string {
  const parts: string[] = ['DEFINE SCOPE'];

  // IF NOT EXISTS / OVERWRITE
  if (options.ifNotExists || scope.ifNotExists) {
    parts.push('IF NOT EXISTS');
  } else if (scope.overwrite) {
    parts.push('OVERWRITE');
  }

  // Scope name
  parts.push(scope.name);

  // Session duration
  if (scope.session) {
    parts.push(`SESSION ${scope.session}`);
  }

  // Signup
  if (scope.signup) {
    parts.push(`SIGNUP (${scope.signup})`);
  }

  // Signin
  if (scope.signin) {
    parts.push(`SIGNIN (${scope.signin})`);
  }

  // Comment
  if (options.includeComments && scope.comments?.length) {
    parts.push(`COMMENT "${scope.comments[0].replace(/"/g, '\\"')}"`);
  }

  return `${parts.join(' ')};`;
}

/**
 * Generates REMOVE SCOPE statement.
 * @deprecated Use ACCESS instead.
 */
export function generateScopeRemove(name: string): string {
  return `REMOVE SCOPE ${name};`;
}
