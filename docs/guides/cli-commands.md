# CLI commands

**smig** provides a command-line interface for all migration operations. This page covers every command and option.

## Global options

These options work with any command:

| Option | Short | Description |
|--------|-------|-------------|
| `--url <url>` | `-u` | SurrealDB server URL |
| `--namespace <ns>` | `-n` | Database namespace |
| `--database <db>` | `-d` | Database name |
| `--username <user>` | `-U` | Authentication username |
| `--password <pass>` | `-p` | Authentication password |
| `--schema <path>` | `-s` | Path to schema file |
| `--env <name>` | | Environment from config |
| `--help` | `-h` | Show help |
| `--version` | `-V` | Show version |

Example:

```bash
bun smig migrate --url ws://localhost:8000 --namespace test --database myapp
```

## Commands

### migrate

Apply pending schema changes to the database.

```bash
bun smig migrate [options]
```

| Option | Description |
|--------|-------------|
| `--dry-run` | Preview changes without applying |
| `--debug` | Write debug log to file |

**Examples:**

```bash
# Apply changes with default config
bun smig migrate

# Preview changes without applying
bun smig migrate --dry-run

# Apply to production environment
bun smig migrate --env production
```

**What it does:**

1. Loads your schema file
2. Connects to the database
3. Compares schema to current database state
4. Generates SurrealQL (SQL) for differences
5. Applies the SurrealQL
6. Records the migration in `_migrations` table

### diff

Preview what SQL would be generated, without applying it.

```bash
bun smig diff [options]
```

| Option | Description |
|--------|-------------|
| `--output <path>` | `-o` | Write SQL to file |
| `--debug` | | Write debug log to file |

**Examples:**

```bash
# Preview changes
bun smig diff

# Save to file for review
bun smig diff --output migration.sql
```

**Output:**

```
Up Migration (apply changes):
──────────────────────────────────────────────────
-- Migration diff for 2025-01-15T10:30:00.000Z

-- New field: user.avatar
DEFINE FIELD avatar ON TABLE user TYPE option<string>;

Down Migration (rollback):
──────────────────────────────────────────────────
REMOVE FIELD avatar ON TABLE user;
```

### status

Show the current migration status.

```bash
bun smig status [options]
```

**Examples:**

```bash
bun smig status
bun smig status --env production
```

**Output:**

```
📊 Migration Status:
Applied migrations: 5

Applied migrations:
  - _migrations:abc123 (2025-01-10T08:00:00.000Z)
  - _migrations:def456 (2025-01-12T14:30:00.000Z)
  - _migrations:ghi789 (2025-01-15T09:15:00.000Z)

✅ Database is up to date with schema
```

### rollback

Undo applied migrations.

```bash
bun smig rollback [options]
```

| Option | Description |
|--------|-------------|
| `--id <id>` | `-i` | Specific migration ID to rollback |
| `--to <id>` | `-t` | Rollback all migrations after this one |
| `--debug` | | Write debug log to file |

**Examples:**

```bash
# Rollback the last migration
bun smig rollback

# Rollback a specific migration
bun smig rollback --id abc123

# Rollback multiple (back to a specific point)
bun smig rollback --to def456
```

**Interactive confirmation:**

```
? Are you sure you want to rollback migration "_migrations:ghi789"? (y/N)
```

### validate

Check your schema file for errors without connecting to the database.

```bash
bun smig validate [options]
```

**Examples:**

```bash
bun smig validate
bun smig validate --schema ./schemas/main.ts
```

**Output:**

```
📋 Schema Summary:
  Tables:    5
  Relations: 2
  Functions: 3
  Analyzers: 1
  Scopes:    1
  Fields:    47
  Indexes:   12
  Events:    4

✅ Schema is valid!
```

### init

Create starter files for a new project.

```bash
bun smig init [options]
```

| Option | Description |
|--------|-------------|
| `--output <path>` | `-o` | Path for schema file (default: `./schema.ts`) |

**Examples:**

```bash
# Create default files
bun smig init

# Custom schema path
bun smig init --output ./src/db/schema.ts
```

**Creates:**

- `schema.ts` — Example schema with common patterns
- `smig.config.ts` — Configuration file

### test

Verify database connection.

```bash
bun smig test [options]
```

**Examples:**

```bash
bun smig test
bun smig test --env production
```

**Output:**

```
✅ Database connection successful
📊 Connected to: ws://localhost:8000
📁 Namespace: test
🗄️  Database: myapp
```

### config

Show current configuration.

```bash
bun smig config [options]
```

| Option | Description |
|--------|-------------|
| `--show-secrets` | | Show password values |

**Examples:**

```bash
bun smig config
bun smig config --show-secrets
bun smig config --env production
```

**Output:**

```
🔧 Current Configuration:
  Schema:    ./schema.ts
  URL:       ws://localhost:8000
  Namespace: test
  Database:  myapp
  Username:  root
  Password:  ***

🌍 Available Environments:
  development
› staging
  production

Use --env <name> to select an environment
```

### mermaid

Generate an ER diagram from your schema.

```bash
bun smig mermaid [options]
```

| Option | Description |
|--------|-------------|
| `--output <path>` | `-o` | Output file (default: `schema-diagram.mermaid`) |

**Examples:**

```bash
bun smig mermaid
bun smig mermaid --output docs/schema.mmd
```

**Interactive prompt:**

```
? Select diagram detail level:
  ○ Minimal (executive summary)
  ● Detailed (comprehensive view)
```

## Configuration file

Create `smig.config.ts` in your project root:

```typescript
export default {
  // Required
  schema: './schema.ts',
  url: 'ws://localhost:8000',
  namespace: 'test',
  database: 'myapp',
  username: 'root',
  password: 'root',
  
  // Optional: environment-specific overrides
  environments: {
    development: {
      url: 'ws://localhost:8000',
      namespace: 'dev',
      database: 'myapp_dev',
    },
    staging: {
      url: process.env.STAGING_DB_URL,
      namespace: 'staging',
      database: 'myapp_staging',
      username: process.env.STAGING_DB_USER,
      password: process.env.STAGING_DB_PASS,
    },
    production: {
      url: process.env.PROD_DB_URL,
      namespace: 'prod',
      database: 'myapp',
      username: process.env.PROD_DB_USER,
      password: process.env.PROD_DB_PASS,
    },
  },
};
```

Use with `--env`:

```bash
bun smig migrate --env production
```

## Environment variables

**smig** reads from `.env` files:

```bash
# .env
SMIG_URL=ws://localhost:8000
SMIG_NAMESPACE=test
SMIG_DATABASE=myapp
SMIG_USERNAME=root
SMIG_PASSWORD=root
SMIG_SCHEMA=./schema.ts
```

Priority (highest to lowest):

1. Command-line flags
2. `smig.config.ts`
3. Environment variables
4. Default values

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (check message) |

## Related

- [Getting started](/getting-started/) — First-time setup
- [Multi-environment](/guides/multi-environment) — Managing multiple databases
- [Understanding migrations](/guides/migrations) — How migrations work
