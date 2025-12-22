import { bool, cf, composeSchema, defineSchema, string } from 'smig';

/**
 * Minimal Example Schema
 *
 * The simplest possible schema to get you started with smig.
 */

const taskSchema = defineSchema({
  table: 'task',
  fields: {
    title: string()
      .assert('$value != NONE')
      .assert('string::len($value) >= 1 AND string::len($value) <= 200'),
    description: string(),
    completed: bool().default(false),
    createdAt: cf.timestamp(),
  },
});

export default composeSchema({
  models: {
    task: taskSchema,
  },
  relations: {},
});
