# Guides

These guides explain concepts in depth. Unlike the reference documentation (which tells you *what* you can do), these guides explain *how* and *why*.

## Understanding smig

### [Schema design](/guides/schema-design)

How to structure your schema for maintainability and performance. Covers naming conventions, organizing fields, when to use relations vs. arrays, and common patterns.

### [Understanding migrations](/guides/migrations)

What happens when you run `bun smig migrate`. How changes are detected, how rollbacks work, what gets stored in the `_migrations` table, and how to handle tricky scenarios.

## Working with smig

### [CLI commands](/guides/cli-commands)

Complete reference for the command-line interface. Every command, every flag, with examples.

### [Multi-environment](/guides/multi-environment)

Managing development, staging, and production databases. Configuration files, environment variables, and deployment workflows.

## Best practices

### [Best practices](/guides/best-practices)

Lessons learned from real projects. Performance tips, security considerations, team workflows, and common mistakes to avoid.

## Quick answers

### How do I preview changes without applying them?

Run `diff` with dry-run to see what would change:

```bash
bun smig diff
```

This shows the SQL that would run, without running it.

### How do I undo a migration?

Use the rollback command:

```bash
bun smig rollback
```

This undoes the last applied migration.

### How do I see what's been applied?

Check the migration status:

```bash
bun smig status
```

This shows all migrations and whether the database is up to date.

### How do I rename a table without losing data?

Use the `was` property:

```typescript
const customers = defineSchema({
  table: 'customers',
  was: 'users',  // Previously named 'users'
  fields: { ... },
});
```

**smig** will generate `ALTER TABLE users RENAME TO customers` instead of dropping and recreating.

### How do I connect to a remote database?

Update `smig.config.ts`:

```typescript
export default {
  url: 'wss://your-surrealdb-server.com',
  namespace: 'production',
  database: 'myapp',
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  schema: './schema.ts',
};
```

Or use command-line flags:

```bash
bun smig migrate --url wss://server.com --namespace prod --database myapp
```
