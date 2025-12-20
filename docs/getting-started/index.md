# Quick start

Get up and running with **smig** in under 5 minutes.

---

## Prerequisites

- **Node.js 18+** or **Bun 1.0+**
- **SurrealDB 3.0+** running locally or remotely

---

## Step 1: Install smig

```bash
# Using bun (recommended)
bun add -D smig

# Using npm
npm install -D smig

# Using pnpm  
pnpm add -D smig
```

See [Installation](installation.md) for additional options.

---

## Step 2: Initialize your project

```bash
smig init
```

This creates two files:

**`schema.js`** - Your schema definition:

```javascript
import {
  string,
  datetime,
  bool,
  index,
  defineSchema,
  composeSchema,
} from 'smig';

const userSchema = defineSchema({
  table: 'user',
  fields: {
    name: string().required(),
    email: string().assert('string::is_email($value)'),
    isActive: bool().default(true),
    createdAt: datetime().default('time::now()'),
  },
  indexes: {
    email: index(['email']).unique(),
  },
});

export default composeSchema({
  models: { user: userSchema },
});
```

**`smig.config.js`** - Your database configuration:

```javascript
export default {
  url: 'ws://localhost:8000',
  namespace: 'test',
  database: 'test',
  username: 'root',
  password: 'root',
  schema: './schema.js',
};
```

---

## Step 3: Start SurrealDB

If you don't have SurrealDB running:

```bash
surreal start --user root --pass root memory
```

---

## Step 4: Generate your first migration

```bash
smig diff --message "Initial schema"
```

You'll see output like:

```
Generating migration...

-- New table: user
DEFINE TABLE user TYPE NORMAL SCHEMAFULL;
DEFINE FIELD name ON TABLE user TYPE string ASSERT $value != NONE;
DEFINE FIELD email ON TABLE user TYPE string ASSERT string::is_email($value);
DEFINE FIELD isActive ON TABLE user TYPE bool DEFAULT true;
DEFINE FIELD createdAt ON TABLE user TYPE datetime DEFAULT time::now();
DEFINE INDEX email ON TABLE user FIELDS email UNIQUE;

Migration generated successfully!
```

---

## Step 5: Apply the migration

```bash
smig push
```

Output:

```
Applying migration...
Migration applied successfully!

Current state:
  Tables: user
  Migrations: 1 applied
```

---

## What's next?

- [Your first migration](first-migration.md) - Deeper dive into the migration workflow
- [Schema design](../guides/schema-design.md) - Learn to design effective schemas
- [CLI commands](../guides/cli-commands.md) - Master the command-line tools
- [Schema reference](../schema-reference/index.md) - Explore all schema options

---

## Common commands

| Command | Description |
|---------|-------------|
| `smig init` | Initialize a new project |
| `smig diff` | Generate migration from schema changes |
| `smig push` | Apply pending migrations |
| `smig status` | Show migration status |
| `smig rollback` | Undo the last migration |
| `smig mermaid` | Generate ER diagram |

See [CLI commands](../guides/cli-commands.md) for the complete reference.

