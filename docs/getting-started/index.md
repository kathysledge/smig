# Getting started

This section helps you go from zero to working migrations. By the end, you'll have **smig** installed, configured, and running against your SurrealDB database.

## What you'll learn

1. **[Installation](/getting-started/installation)** — How to add **smig** to your project
2. **[Your first migration](/getting-started/first-migration)** — Creating and applying your first schema

If you just want to see it work, here's the shortest path:

```bash
# Install smig
bun add -D smig

# Create starter files
bun smig init

# Start SurrealDB (if not running)
surreal start --user root --pass root memory

# Apply the example schema
bun smig migrate
```

Done! You now have a `user` and `post` table in your database.

## Before you begin

### You'll need

- **Node.js 18+** or **Bun 1.0+** (we recommend Bun — it's faster)
- **SurrealDB 3.0+** installed and accessible

### Checking your setup

Verify your environment is ready:

```bash
# Check Node.js or Bun
node --version   # Should be 18.0.0 or higher
bun --version    # Should be 1.0.0 or higher

# Check SurrealDB
surreal version  # Should be 3.0.0 or higher
```

If you don't have SurrealDB, see [surrealdb.com/install](https://surrealdb.com/install).

## Quick overview

**smig** works in three steps:

### 1. Define your schema

You describe your database structure in a JavaScript file:

```typescript
// schema.ts
import { defineSchema, string, datetime, composeSchema } from 'smig';

const users = defineSchema({
  table: 'user',
  fields: {
    email: string().required(),
    name: string(),
    createdAt: datetime().default('time::now()'),
  },
});

export default composeSchema({
  models: { user: users },
});
```

### 2. Configure your connection

A config file tells **smig** how to connect:

```typescript
// smig.config.ts
export default {
  url: 'ws://localhost:8000',
  namespace: 'test',
  database: 'test',
  username: 'root',
  password: 'root',
  schema: './schema.ts',
};
```

### 3. Run migrations

Apply your schema to the database:

```bash
bun smig migrate
```

**smig** compares your schema to the database, generates the necessary SQL, and applies it.

## Next steps

Ready to set things up properly?

<div class="vp-card-container">

[**Installation** ›](/getting-started/installation)

All the ways to install **smig** and configure your project.

[**Your first migration** ›](/getting-started/first-migration)

A detailed walkthrough of creating, previewing, and applying migrations.

</div>

## Common questions

### Do I need TypeScript?

No. **smig** works with plain JavaScript. TypeScript is supported and gives you better autocomplete, but it's optional.

### Does smig work with existing databases?

Yes! When you run `bun smig migrate` against an existing database, it only generates changes for what's different. It won't duplicate tables that already exist.

### What if I make a mistake?

Every migration is reversible. Run `bun smig rollback` to undo the last migration. See [Understanding migrations](/guides/migrations) for details.

### Can I see what SQL will run before applying?

Yes. Run `bun smig diff` to preview the SQL without applying it. When you're happy, run `bun smig migrate` to apply.
