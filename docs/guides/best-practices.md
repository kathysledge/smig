# Best practices

Production-ready patterns for using **smig** effectively.

---

## Schema management

### Keep schema in version control

Your `schema.js` is the source of truth. Always commit it:

```bash
git add schema.js
git commit -m "Add user authentication fields"
```

### Use meaningful migration messages

```bash
# ✓ Good
smig diff --message "Add user email verification fields"
smig diff --message "Create product catalog tables"

# ✗ Avoid
smig diff --message "update"
smig diff --message "fix"
```

### Review before pushing

Always review generated SQL before applying:

```bash
smig diff --message "Big change" --dry-run
# Review the output carefully
smig push
```

---

## Field design

### Use appropriate types

```javascript
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

```javascript
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

```javascript
fields: {
  // Good: derived from other fields
  fullName: string().computed('string::concat(firstName, " ", lastName)'),
  
  // Good: always current timestamp
  updatedAt: datetime().value('time::now()'),
  
  // Caution: complex queries can slow writes
  followerCount: int().computed('array::len(followers)'),
}
```

---

## Index optimization

### Index what you query

```javascript
// If you query: SELECT * FROM post WHERE author = $user AND published = true ORDER BY createdAt DESC
indexes: {
  byAuthorPublished: index(['author', 'published', 'createdAt']),
}
```

### Don't over-index

Each index:
- Increases write latency
- Uses storage space
- Must be maintained

```javascript
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

---

## Relation design

### Use relations for many-to-many

```javascript
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

```javascript
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

---

## Migration safety

### Test in lower environments first

```bash
# 1. Apply to dev
smig push

# 2. Test thoroughly

# 3. Apply to staging
smig push --config smig.staging.config.js

# 4. QA approval

# 5. Apply to production
smig push --config smig.production.config.js
```

### Backup before major changes

```bash
# Before risky migrations
surreal export --conn ws://localhost:8000 backup-$(date +%Y%m%d).surql

# Apply migration
smig push

# If something goes wrong
surreal import --conn ws://localhost:8000 backup-20240115.surql
```

### Use transactions

**smig** uses transactions by default. If any statement fails, the entire migration is rolled back.

---

## Team workflows

### One schema, multiple developers

```bash
# Developer A
git pull
smig diff --message "Add feature A"
git add schema.js
git commit -m "Schema: Add feature A"
git push

# Developer B
git pull  # Gets A's changes
smig push # Apply A's migration locally
smig diff --message "Add feature B"
git add schema.js
git commit -m "Schema: Add feature B"
git push
```

### Resolve schema conflicts

If two developers modify the schema simultaneously:

1. Git merge as normal
2. Review the merged `schema.js`
3. Run `smig diff --dry-run` to verify
4. Apply the combined changes

---

## Error handling

### Check status before operations

```javascript
// In deployment scripts
const { execSync } = require('child_process');

try {
  // Check connection
  execSync('smig status', { stdio: 'inherit' });
  
  // Apply migrations
  execSync('smig push --force', { stdio: 'inherit' });
} catch (error) {
  console.error('Migration failed:', error.message);
  process.exit(1);
}
```

### Handle rollback failures

If a rollback fails:

1. Check `smig status` for current state
2. Manually fix any partial changes
3. Run `smig diff --dry-run` to sync state
4. Apply fresh migration if needed

---

## Performance considerations

### Large tables

For tables with millions of rows:

```javascript
// Use concurrent index creation
indexes: {
  email: index(['email']).unique().concurrently(),
}
```

### Vector indexes

For HNSW indexes, tune parameters based on your data:

```javascript
indexes: {
  embedding: index(['embedding'])
    .hnsw()
    .dimension(384)
    .dist('cosine')
    .m(16)           // Higher = better recall, more memory
    .efConstruction(100), // Higher = better quality, slower build
}
```

---

## See also

- [Schema design](schema-design.md)
- [Multi-environment workflows](multi-environment.md)
- [CLI commands](cli-commands.md)

