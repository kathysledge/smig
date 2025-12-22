# Best practices

Production-ready patterns for using **smig** effectively.

## Schema management

Good schema hygiene prevents problems before they happen. These practices help you maintain a healthy codebase and avoid surprises in production.

### Keep schema in version control

Your `schema.ts` is the source of truth for your database structure. Treat it like any other critical code—commit every change:

```zsh
git add schema.ts
git commit -m "Add user authentication fields"
```

### Use meaningful commit messages

When committing schema changes, describe what changed and why. This helps when reviewing history:

```zsh
# ✓ Good
bun smig diff
bun smig diff

# ✗ Avoid
bun smig diff
bun smig diff
```

### Review before applying

Never apply migrations blindly. The `--dry-run` flag shows you exactly what will change:

```zsh
bun smig diff --dry-run
# Review the output carefully
bun smig migrate
```

## Field design

The types and constraints you choose affect data integrity, query performance, and application code. Get these right from the start to avoid painful migrations later.

### Use appropriate types

Be specific. The database can optimise storage and queries when it knows the exact type:

```typescript
// ✓ Use specific types
fields: {
  email: string().assert('string::is_email($value)'),
  age: int().range(0, 150),
  price: decimal(),  // For money
  createdAt: datetime(),
  id: uuid().default('rand::uuid::v7()'),
}

// ✗ Avoid stringly-typed data
fields: {
  age: string(),  // Should be int
  price: float(), // Use decimal for money
  date: string(), // Use datetime
}
```

### Validate at the database level

Application-level validation can be bypassed. Database constraints cannot. Use assertions for rules that must always hold:

```typescript
fields: {
  email: string()
    .required()
    .assert('string::is_email($value)'),
  
  status: string()
    .assert('$value IN ["draft", "published", "archived"]'),
  
  score: int()
    .range(0, 100),
}
```

### Use computed fields wisely

Computed fields simplify your application code but add database overhead. Use them when the computation is simple and frequently needed:

```typescript
fields: {
  // Good: derived from other fields
  fullName: string().computed('string::concat(firstName, " ", lastName)'),
  
  // Good: always current timestamp
  updatedAt: datetime().value('time::now()'),
  
  // Caution: complex queries can slow writes
  followerCount: int().computed('array::len(followers)'),
}
```

## Index optimisation

Indexes are a trade-off: they speed up reads but slow down writes. Understanding when and how to index is essential for good performance.

### Index what you query

Design indexes based on your actual query patterns, not just which fields exist:

```typescript
// If you query: SELECT * FROM post WHERE author = $user AND published = true ORDER BY createdAt DESC
indexes: {
  byAuthorPublished: index(['author', 'published', 'createdAt']),
}
```

### Don't over-index

Every index you create has costs. Before adding one, ask: "What query does this speed up?"

```typescript
// ✗ Too many indexes
indexes: {
  a: index(['field1']),
  b: index(['field2']),
  c: index(['field1', 'field2']),
  d: index(['field2', 'field1']),  // Redundant
}

// ✓ Strategic indexes
indexes: {
  primary: index(['id']).unique(),
  byField1Field2: index(['field1', 'field2']),
}
```

## Relation design

SurrealDB's graph capabilities let you model relationships that would be awkward in traditional databases. Use them wisely.

### Use relations for many-to-many

Embedded arrays work for small, bounded collections. For unbounded or queryable relationships, use graph relations:

```typescript
// ✗ Array of references (can grow unbounded)
const userSchema = defineSchema({
  table: 'user',
  fields: {
    followers: array(record('user')).default([]),  // Problematic at scale
  },
});

// ✓ Relation table
const followsRelation = defineRelation({
  name: 'follows',
  from: 'user',
  to: 'user',
  fields: {
    followedAt: datetime().default('time::now()'),
  },
});
```

### Use relations for attributed edges

When you need to store data about the relationship itself (not just that it exists), relations are the right choice:

```typescript
// When you need metadata on relationships
const likesRelation = defineRelation({
  name: 'likes',
  from: 'user',
  to: 'post',
  fields: {
    likedAt: datetime().default('time::now()'),
    reaction: string().default('like'),  // like, love, laugh, etc.
  },
});
```

## Migration safety

Migrations change your production database. A mistake here can cause downtime or data loss. These practices minimise risk.

### Test in lower environments first

Every migration should pass through development and staging before reaching production:

```zsh
# 1. Apply to dev
bun smig migrate

# 2. Test thoroughly

# 3. Apply to staging
bun smig migrate --config smig.staging.config.ts

# 4. QA approval

# 5. Apply to production
bun smig migrate --config smig.production.config.ts
```

### Backup before major changes

For migrations that modify or remove data (not just structure), create a backup first:

```zsh
# Before risky migrations
surreal export --conn ws://localhost:8000 backup-$(date +%Y%m%d).surql

# Apply migration
bun smig migrate

# If something goes wrong
surreal import --conn ws://localhost:8000 backup-20240115.surql
```

### Use transactions

**smig** wraps migrations in transactions automatically. If any statement fails, the entire migration is rolled back, leaving your database unchanged.

## Team workflows

When multiple developers modify the schema, coordination prevents conflicts and ensures everyone stays in sync.

### One schema, multiple developers

The key is to pull before making changes and push promptly after:

```zsh
# Developer A
git pull
bun smig diff
git add schema.ts
git commit -m "Schema: Add feature A"
git push

# Developer B
git pull  # Gets A's changes
bun smig migrate # Apply A's migration locally
bun smig diff
git add schema.ts
git commit -m "Schema: Add feature B"
git push
```

### Resolve schema conflicts

Git handles schema.ts like any other code file. When conflicts occur:

1. Git merge as normal
2. Review the merged `schema.ts`
3. Run `bun smig diff --dry-run` to verify
4. Apply the combined changes

## Error handling

Things go wrong. Good error handling helps you recover quickly and minimises impact.

### Check status before operations

In deployment scripts, verify the connection works before attempting migrations:

```typescript
// In deployment scripts
const { execSync } = require('child_process');

try {
  // Check connection
  execSync('bun smig status', { stdio: 'inherit' });
  
  // Apply migrations
  execSync('bun smig migrate --force', { stdio: 'inherit' });
} catch (error) {
  console.error('Migration failed:', error.message);
  process.exit(1);
}
```

### Handle rollback failures

Rollbacks can fail if the down script is invalid or the database state has changed. When this happens:

1. Check `bun smig status` for current state
2. Manually fix any partial changes
3. Run `bun smig diff --dry-run` to sync state
4. Apply fresh migration if needed

## Performance considerations

Schema changes on large databases require extra care. Some operations lock tables or rebuild indexes, which can cause downtime.

### Large tables

When adding indexes to tables with millions of rows, use concurrent creation to avoid blocking writes:

```typescript
// Use concurrent index creation
indexes: {
  email: index(['email']).unique().concurrently(),
}
```

### Vector indexes

HNSW indexes have tuneable parameters that affect build time, query speed, and memory usage. Start with defaults and adjust based on your workload:

```typescript
indexes: {
  embedding: index(['embedding'])
    .hnsw()
    .dimension(384)
    .dist('cosine')
    .m(16)           // Higher = better recall, more memory
    .efConstruction(100), // Higher = better quality, slower build
}
```

## See also

- [Schema design](schema-design.md)
- [Multi-environment workflows](multi-environment.md)
- [CLI commands](cli-commands.md)
