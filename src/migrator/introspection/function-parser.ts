/**
 * @fileoverview Function definition parser for SurrealDB schema introspection.
 * @module migrator/introspection/function-parser
 */

import { debugLog } from '../../utils/debug-logger';

/**
 * Parses a function definition from INFO FOR DB result.
 *
 * Extracts function parameters, return type, and body from the definition string.
 *
 * @param funcName - The name of the function
 * @param funcDef - The function definition string from INFO FOR DB
 * @returns Parsed function object
 */
export function parseFunctionDefinition(
  funcName: string,
  funcDef: string,
): Record<string, unknown> {
  debugLog(`Parsing function definition for ${funcName}:`, funcDef);

  // Extract the full function name from the definition (e.g., fn::days_since)
  const funcNameMatch = funcDef.match(/DEFINE FUNCTION\s+(fn::\w+)/);
  const fullFuncName = funcNameMatch ? funcNameMatch[1] : funcName;

  // Extract parameters (between parentheses after function name)
  // Format: ($param1: type1, $param2: type2, ...)
  const paramsMatch = funcDef.match(/\(([^)]*)\)/);
  const parameters: Array<{ name: string; type: string }> = [];

  if (paramsMatch && paramsMatch[1].trim()) {
    const paramStrs = paramsMatch[1].split(',');
    for (const paramStr of paramStrs) {
      // Parse $name: type format
      const paramMatch = paramStr.trim().match(/\$(\w+)\s*:\s*(.+)/);
      if (paramMatch) {
        parameters.push({
          name: paramMatch[1],
          type: paramMatch[2].trim(),
        });
      }
    }
  }

  // Extract return type (after ->)
  const returnMatch = funcDef.match(/->\s*(\w+(?:<[^>]+>)?)/);
  const returnType = returnMatch ? returnMatch[1] : null;

  // Extract body (between { and })
  // This is tricky because the body can contain nested braces
  const bodyStartIndex = funcDef.indexOf('{');
  let bodyEndIndex = -1;
  if (bodyStartIndex !== -1) {
    let braceDepth = 0;
    for (let i = bodyStartIndex; i < funcDef.length; i++) {
      if (funcDef[i] === '{') braceDepth++;
      if (funcDef[i] === '}') braceDepth--;
      if (braceDepth === 0) {
        bodyEndIndex = i;
        break;
      }
    }
  }

  let body = '';
  if (bodyStartIndex !== -1 && bodyEndIndex !== -1) {
    body = funcDef.substring(bodyStartIndex + 1, bodyEndIndex).trim();
  }

  // Check for PERMISSIONS clause (after the body)
  let permissions: string | null = null;
  if (bodyEndIndex !== -1) {
    const afterBody = funcDef.substring(bodyEndIndex + 1);
    const permMatch = afterBody.match(/PERMISSIONS\s+(.+?)(?:;|$)/i);
    if (permMatch) {
      permissions = permMatch[1].trim();
    }
  }

  return {
    name: fullFuncName,
    parameters,
    returnType,
    body,
    permissions,
  };
}
