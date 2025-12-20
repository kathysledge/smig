# Your first migration

This guide walks through creating, previewing, and applying your first migration. By the end, you’ll understand the complete workflow.

## What we’ll build

A simple user table with:
- Email (required, unique)
- Name
- Created timestamp

## Step 1: Create the schema

After running `bun smig init`, you have a `schema.ts` file. Let’s modify it:

```typescript
// schema.ts
import { 
  defineSchema, 
  composeSchema,
  string, 
  datetime, 
  index 
} from 'smig';

const users = defineSchema({
  table: 'user',
  fields: {
    email: string().required().assert('string::is_email($value)'),
    name: string(),
    createdAt: datetime().default('time::now()'),
  },
  indexes: {
    email: index(['email']).unique(),
  },
});

export default composeSchema({
  models: { user: users },
});
```

Let’s break this down:

- **`defineSchema`** — Creates a table definition
- **`string().required()`** — A text field that must have a value
- **`.assert()`** — Validation rule (must be a valid email)
- **`datetime().default()`** — A timestamp with auto-set value
- **`index(['email']).unique()`** — Ensures no duplicate emails

## Step 2: Preview the migration

Before applying changes, let’s see what SurrealQL (SQL) will be generated:

```bash
bun smig diff
```

You’ll see output like:

```
Up Migration (apply changes):
──────────────────────────────────────────────────
-- New table: user
DEFINE TABLE user TYPE NORMAL SCHEMAFULL;
DEFINE FIELD email ON TABLE user TYPE string ASSERT string::is_email($value) ASSERT $value != NONE;
DEFINE FIELD name ON TABLE user TYPE string;
DEFINE FIELD createdAt ON TABLE user TYPE datetime DEFAULT time::now();
DEFINE INDEX email ON TABLE user FIELDS email UNIQUE;

Down Migration (rollback):
──────────────────────────────────────────────────
REMOVE TABLE user;
```

This shows:
- **Up migration** — What will be created
- **Down migration** — What will be removed if you rollback

## Step 3: Apply the migration

Happy with the preview? Apply it:

```bash
bun smig migrate
```

Output:

```
✅ Migration applied successfully!

Tables created: user
Indexes created: email
```

Your database now has the `user` table.

## Step 4: Verify it worked

Check the migration status:

```bash
bun smig status
```

Output:

```
📊 Migration Status:
Applied migrations: 1

✅ Database is up to date with schema
```

You can also query SurrealDB directly:

```bash
surreal sql --endpoint ws://localhost:8000 --namespace test --database test
```

```surql
INFO FOR DB;
-- Shows: tables: { user: ... }

INFO FOR TABLE user;
-- Shows field and index definitions
```

## Step 5: Make a change

Let’s add a profile picture field. Update `schema.ts`:

```typescript
const users = defineSchema({
  table: 'user',
  fields: {
    email: string().required().assert('string::is_email($value)'),
    name: string(),
    avatar: string(),  // NEW: Profile picture URL
    createdAt: datetime().default('time::now()'),
  },
  indexes: {
    email: index(['email']).unique(),
  },
});
```

Preview the change:

```bash
bun smig diff
```

Output:

```
Up Migration (apply changes):
──────────────────────────────────────────────────
-- New field: user.avatar
DEFINE FIELD avatar ON TABLE user TYPE string;

Down Migration (rollback):
──────────────────────────────────────────────────
REMOVE FIELD avatar ON TABLE user;
```

**smig** detected only the new field — it won’t recreate existing definitions.

Apply it:

```bash
bun smig migrate
```

## Step 6: Try a rollback

Changed your mind? Roll back the last migration:

```bash
bun smig rollback
```

Output:

```
Rolling back migration...
REMOVE FIELD avatar ON TABLE user;

✅ Rollback complete
```

The `avatar` field is gone. Check with `bun smig status`:

```
📊 Migration Status:
Applied migrations: 1

⚠️  Schema has pending changes (run bun smig diff to see)
```

## What you learned

1. **Schema definition** — Tables and fields are defined in code
2. **Diffing** — `bun smig diff` shows what would change
3. **Migrations** — `bun smig migrate` applies changes
4. **Rollbacks** — `bun smig rollback` undoes changes
5. **Status** — `bun smig status` shows current state

## Common questions

### The diff shows changes I didn’t make

SurrealDB may format things differently than **smig**. This is normal for:
- Whitespace differences
- Optional type suffixes

**smig** normalizes these, but if you see unexpected diffs, please [report them](https://github.com/kathysledge/smig/issues).

### I made a mistake in my schema

1. Fix the schema file
2. Run `bun smig diff` to see the correction
3. Run `bun smig migrate` to apply

Or use `bun smig rollback` to undo the last migration first.

### Can I edit migration files?

**smig** doesn’t create migration files — it generates SQL on the fly by comparing your schema to the database. This means:
- No migration files to manage
- Always generates minimal changes
- Schema file is the single source of truth

## Next steps

Now that you understand the basics:

- [Schema design](/guides/schema-design) — Patterns for structuring schemas
- [CLI commands](/guides/cli-commands) — All the available commands
- [Schema reference](/schema-reference/) — All field types and options
