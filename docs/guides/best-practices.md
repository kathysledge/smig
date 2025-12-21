# Best practices

Production-ready patterns for using **smig** effectively.

## Schema management

### Keep schema in version control

Your `schema.ts` is the source of truth. Always commit it:

```zsh
git add schema.ts
git commit -m "Add user authentication fields"
```

### Use meaningful migration messages

Descriptive messages help you understand history:

```zsh
# ✓ Good
bun smig diff
bun smig diff

# ✗ Avoid
bun smig diff
bun smig diff
```

### Review before pushing

Always review generated SurrealQL (SQL) before applying:

```zsh
bun smig diff --dry-run
# Review the output carefully
bun smig migrate
```

## Field design

### Use appropriate types

Choose the most precise type for each field:

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

Let the database enforce your rules:

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

Computed fields are powerful but have tradeoffs:

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

## Index optimization

### Index what you query

Match your indexes to your query patterns:

```typescript
// If you query: SELECT * FROM post WHERE author = $user AND published = true ORDER BY createdAt DESC
indexes: {
  byAuthorPublished: index(['author', 'published', 'createdAt']),
}
```

### Don’t over-index

Each index:
- Increases write latency
- Uses storage space
- Must be maintained

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

### Use relations for many-to-many

Relations scale better than embedded arrays:

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

When the relationship itself has data:

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

### Test in lower environments first

Don’t push directly to production:

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

Protect your data before significant schema updates:

```zsh
# Before risky migrations
surreal export --conn ws://localhost:8000 backup-$(date +%Y%m%d).surql

# Apply migration
bun smig migrate

# If something goes wrong
surreal import --conn ws://localhost:8000 backup-20240115.surql
```

### Use transactions

**smig** uses transactions by default. If any statement fails, the entire migration is rolled back.

## Team workflows

### One schema, multiple developers

Coordinate schema changes in teams:

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

If two developers modify the schema simultaneously:

1. Git merge as normal
2. Review the merged `schema.ts`
3. Run `bun smig diff --dry-run` to verify
4. Apply the combined changes

## Error handling

### Check status before operations

Verify the connection and state before pushing:

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

If a rollback fails:

1. Check `bun smig status` for current state
2. Manually fix any partial changes
3. Run `bun smig diff --dry-run` to sync state
4. Apply fresh migration if needed

## Performance considerations

### Large tables

For tables with millions of rows:

```typescript
// Use concurrent index creation
indexes: {
  email: index(['email']).unique().concurrently(),
}
```

### Vector indexes

For HNSW indexes, tune parameters based on your data:

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
