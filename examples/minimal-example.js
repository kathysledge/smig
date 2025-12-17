import {
  bool,
  cf, // Common field patterns
  composeSchema,
  defineSchema,
  string,
} from 'smig';

/**
 * Minimal Example Schema
 *
 * The simplest possible schema to get you started with smig.
 * This example shows the bare essentials for a working schema.
 *
 * Run with:
 *   smig generate --schema examples/minimal-example.js
 *   smig migrate --schema examples/minimal-example.js
 */

// A simple task/todo schema
const taskSchema = defineSchema({
  table: 'task',
  schemafull: true,
  fields: {
    title: string()
      .assert('$value != NONE')
      .assert('string::len($value) >= 1 AND string::len($value) <= 200'),
    description: string(),
    completed: bool().default(false),
    createdAt: cf.timestamp(), // Automatically set to current time
  },
});

// Compose the schema (even for single tables, this is required)
const minimalSchema = composeSchema({
  models: {
    task: taskSchema,
  },
});

export default minimalSchema;
