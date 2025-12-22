# Minimal example

The simplest possible schema to help you understand **smig’s** core concepts. This is a basic task list application—perfect as a starting point or for quick prototyping.

## What you'll learn

This example demonstrates the essential building blocks of a **smig** schema without any advanced features. If you're new to **smig**, start here before exploring the more complex examples.

## Schema

A single `task` table with just four fields—title, description, completion status, and a timestamp:

```typescript
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
```

### Breaking it down

Let's examine each part of this schema to understand what's happening:

**The `defineSchema` function** creates a table definition. Every table in your database starts with this function call.

**The `table` property** sets the table name in SurrealDB. Using lowercase, singular names ("task" not "Tasks") follows **smig** conventions.

**The `fields` object** defines each column in your table:

- **`title`** — A required string with length validation. The two `.assert()` calls ensure the value isn't empty and stays under 200 characters.
- **`description`** — An optional string (no assertions means it can be empty or omitted entirely).
- **`completed`** — A boolean that defaults to `false` when you create a new task.
- **`createdAt`** — Uses the `cf.timestamp()` common field helper, which creates a datetime field with `time::now()` as the default.

**The `composeSchema` function** combines table definitions into a complete database schema that **smig** can migrate.

## Generated SurrealQL

Running `bun smig migrate` generates this SurrealQL (SQL):

```surql
DEFINE TABLE task TYPE NORMAL SCHEMAFULL;
DEFINE FIELD title ON TABLE task TYPE string
  ASSERT ($value != NONE) AND (string::len($value) >= 1 AND string::len($value) <= 200);
DEFINE FIELD description ON TABLE task TYPE string;
DEFINE FIELD completed ON TABLE task TYPE bool DEFAULT false;
DEFINE FIELD createdAt ON TABLE task TYPE datetime DEFAULT time::now();
```

## Example queries

Once your schema is migrated, here are some common operations you might perform:

### Create a task

```surql
CREATE task SET
  title = "Learn SurrealDB",
  description = "Complete the getting started guide";
```

### List incomplete tasks

```surql
SELECT * FROM task
WHERE completed = false
ORDER BY createdAt DESC;
```

### Complete a task

```surql
UPDATE task:abc123 SET completed = true;
```

### Delete completed tasks

```surql
DELETE task WHERE completed = true;
```

## Extending this example

This minimal schema is intentionally simple. Here are some ways you might extend it for a real application:

### Add a due date

```typescript
dueDate: option('datetime'),
```

### Add priority levels

```typescript
priority: string().default('medium').assert('$value IN ["low", "medium", "high"]'),
```

### Add user ownership

```typescript
owner: record('user').required(),
```

### Add an index for faster queries

```typescript
indexes: {
  byCompleted: index(['completed', 'createdAt']),
}
```

## See also

- [Simple blog](/examples/blog) — A more complete example with multiple tables
- [Your first migration](/getting-started/first-migration) — Step-by-step migration walkthrough
- [Fields reference](/schema-reference/fields) — All available field types
