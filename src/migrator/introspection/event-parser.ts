/**
 * @fileoverview Event definition parser for SurrealDB schema introspection.
 * @module migrator/introspection/event-parser
 */

/**
 * Extracts the WHEN clause from an event definition.
 */
export function extractEventWhen(eventDef: string): string {
  const whenMatch = eventDef.match(/WHEN\s+([^;]+?)(?:\s+THEN)/i);
  return whenMatch ? whenMatch[1].trim() : '';
}

/**
 * Extracts the THEN clause from an event definition.
 */
export function extractEventThen(eventDef: string): string {
  const thenMatch = eventDef.match(/THEN\s+(.+)$/i);
  return thenMatch ? thenMatch[1].trim() : '';
}

/**
 * Extracts the event type (CREATE, UPDATE, DELETE) from the WHEN clause.
 */
export function extractEventType(eventDef: string): 'CREATE' | 'UPDATE' | 'DELETE' | null {
  const whenClause = extractEventWhen(eventDef);
  if (whenClause.includes('"CREATE"') || whenClause.includes("'CREATE'")) return 'CREATE';
  if (whenClause.includes('"UPDATE"') || whenClause.includes("'UPDATE'")) return 'UPDATE';
  if (whenClause.includes('"DELETE"') || whenClause.includes("'DELETE'")) return 'DELETE';
  return null;
}

/**
 * Parses a complete event definition string into a structured object.
 */
export function parseEventDefinition(eventName: string, eventDef: string): Record<string, unknown> {
  return {
    name: eventName,
    when: extractEventWhen(eventDef),
    then: extractEventThen(eventDef),
    type: extractEventType(eventDef),
  };
}
