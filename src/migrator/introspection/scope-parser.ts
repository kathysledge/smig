/**
 * @fileoverview Scope/Access definition parser for SurrealDB schema introspection.
 * @module migrator/introspection/scope-parser
 */

import { debugLog } from '../../utils/debug-logger';

/**
 * Parses a scope/access definition from INFO FOR DB result.
 *
 * Handles both the legacy SCOPE syntax and the new ACCESS syntax (SurrealDB 3.x).
 *
 * @param scopeName - The name of the scope/access
 * @param scopeDef - The definition string from INFO FOR DB
 * @returns Parsed scope object
 */
export function parseScopeDefinition(scopeName: string, scopeDef: string): Record<string, unknown> {
  debugLog(`Parsing scope definition for ${scopeName}:`, scopeDef);

  // Determine if this is ACCESS or SCOPE syntax
  const isAccess = scopeDef.includes('DEFINE ACCESS');

  // Extract session duration
  const sessionMatch = scopeDef.match(/SESSION\s+(\d+[smhdwy])/i);
  const session = sessionMatch ? sessionMatch[1] : null;

  // Extract signup clause
  let signup: string | null = null;
  const signupStartIndex = scopeDef.indexOf('SIGNUP');
  if (signupStartIndex !== -1) {
    // Find the matching parenthesis or block
    const afterSignup = scopeDef.substring(signupStartIndex + 6).trim();
    if (afterSignup.startsWith('(')) {
      // Extract content within parentheses, handling nested parens
      let depth = 0;
      let endIndex = 0;
      for (let i = 0; i < afterSignup.length; i++) {
        if (afterSignup[i] === '(') depth++;
        if (afterSignup[i] === ')') depth--;
        if (depth === 0) {
          endIndex = i;
          break;
        }
      }
      signup = afterSignup.substring(1, endIndex).trim();
    }
  }

  // Extract signin clause
  let signin: string | null = null;
  const signinStartIndex = scopeDef.indexOf('SIGNIN');
  if (signinStartIndex !== -1) {
    const afterSignin = scopeDef.substring(signinStartIndex + 6).trim();
    if (afterSignin.startsWith('(')) {
      let depth = 0;
      let endIndex = 0;
      for (let i = 0; i < afterSignin.length; i++) {
        if (afterSignin[i] === '(') depth++;
        if (afterSignin[i] === ')') depth--;
        if (depth === 0) {
          endIndex = i;
          break;
        }
      }
      signin = afterSignin.substring(1, endIndex).trim();
    }
  }

  // Extract authenticate clause (SurrealDB 3.x)
  let authenticate: string | null = null;
  const authStartIndex = scopeDef.indexOf('AUTHENTICATE');
  if (authStartIndex !== -1) {
    const afterAuth = scopeDef.substring(authStartIndex + 12).trim();
    if (afterAuth.startsWith('(')) {
      let depth = 0;
      let endIndex = 0;
      for (let i = 0; i < afterAuth.length; i++) {
        if (afterAuth[i] === '(') depth++;
        if (afterAuth[i] === ')') depth--;
        if (depth === 0) {
          endIndex = i;
          break;
        }
      }
      authenticate = afterAuth.substring(1, endIndex).trim();
    }
  }

  // Determine access type (JWT, RECORD, BEARER)
  let accessType: string | null = null;
  if (isAccess) {
    if (scopeDef.includes('TYPE JWT')) accessType = 'JWT';
    else if (scopeDef.includes('TYPE RECORD')) accessType = 'RECORD';
    else if (scopeDef.includes('TYPE BEARER')) accessType = 'BEARER';
  }

  return {
    name: scopeName,
    session,
    signup,
    signin,
    authenticate,
    accessType,
    isAccess,
  };
}
