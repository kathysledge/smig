# Schema design

Best practices for designing effective SurrealDB schemas with **smig**.

## Schema organisation

How you structure your schema files affects maintainability as your project grows. **smig** is flexible—you can start simple and reorganise later without affecting your database.

### Single file vs. multiple files

For small projects, a single `schema.ts` works well:

```typescript
// schema.ts
import { defineSchema, composeSchema } from 'smig';

const userSchema = defineSchema({ /* ... */ });
const postSchema = defineSchema({ /* ... */ });

export default composeSchema({
  models: { user: userSchema, post: postSchema },
});
```

For larger projects, split by domain:

```typescript
// schema/user.ts
export const userSchema = defineSchema({ /* ... */ });

// schema/blog.ts
export const postSchema = defineSchema({ /* ... */ });
export const commentSchema = defineSchema({ /* ... */ });

// schema/index.ts
import { composeSchema } from 'smig';
import { userSchema } from './user';
import { postSchema, commentSchema } from './blog';

export default composeSchema({
  models: { user: userSchema, post: postSchema, comment: commentSchema },
});
```

## Naming conventions

Consistent naming makes your schema easier to read and maintain. These conventions align with SurrealDB's own style and help avoid common pitfalls.

### Tables

Use **singular, lowercase** names:

```typescript
// ✓ Good
defineSchema({ table: 'user' });
defineSchema({ table: 'blog_post' });

// ✗ Avoid
defineSchema({ table: 'Users' });
defineSchema({ table: 'BlogPosts' });
```

### Fields

Field names appear frequently in your application code, so choose names that are clear and consistent. Use **camelCase** for multi-word fields:

```typescript
fields: {
  email: string(),
  firstName: string(),      // ✓ camelCase
  createdAt: datetime(),    // ✓ camelCase
  first_name: string(),     // ✗ snake_case (inconsistent)
}
```

### Indexes

Good index names describe what the index is for, not just which columns it covers. This makes it easier to understand query plans and debug performance issues:

```typescript
indexes: {
  email: index(['email']).unique(),           // Simple: field name
  byAuthorDate: index(['author', 'createdAt']), // Composite: descriptive
  searchContent: index(['content']).fulltext(), // Purpose: search
}
```

## Field patterns

These patterns cover the most common field design decisions you'll face. Understanding when to use each option helps you build schemas that are both flexible and safe.

### Required vs. optional

Every field in your schema can either require a value or allow `NONE` (null). Choose whether a field can be null:

```typescript
fields: {
  // Required: must have a value
  email: string().required(),
  
  // Optional: can be null/undefined (default)
  bio: string(),
  
  // Optional with explicit type
  avatar: option('string'),
}
```

### Defaults and computed values

Defaults reduce the amount of data your application needs to provide when creating records. Computed values take this further by calculating values from other fields or SurrealDB functions:

```typescript
fields: {
  // Static default
  isActive: bool().default(true),
  role: string().default('user'),
  
  // Dynamic default (evaluated on create)
  id: uuid().default('rand::uuid::v7()'),
  createdAt: datetime().default('time::now()'),
  
  // Computed value (evaluated on every write)
  updatedAt: datetime().value('time::now()'),
  
  // Computed from other fields
  fullName: string().computed('string::concat(firstName, " ", lastName)'),
}
```

### Validation with assertions

Assertions enforce data integrity at the database level, ensuring invalid data is rejected regardless of which application or query creates it. Think of them as your last line of defence:

```typescript
fields: {
  // Single assertion
  email: string().assert('string::is_email($value)'),
  
  // Multiple assertions (combined with AND)
  username: string()
    .assert('$value != NONE')
    .assert('string::len($value) >= 3')
    .assert('string::len($value) <= 20')
    .assert('$value = /^[a-z0-9_]+$/'),
  
  // Range validation
  age: int().range(0, 150),
  
  // Length validation
  title: string().length(1, 200),
}
```

## Relationships

SurrealDB offers multiple ways to connect records. Choosing the right approach depends on whether you need simple foreign keys, optional links, or rich graph-style relationships with their own data.

### Record references

The simplest way to connect tables is with record references. These are like foreign keys in traditional databases:

```typescript
fields: {
  // Single table reference
  author: record('user').required(),
  
  // Optional reference
  parentComment: option('record<comment>'),
  
  // Union type (multiple possible tables)
  target: record(['post', 'comment', 'user']),
  
  // Any record
  subject: record(),
}
```

### Foreign key constraints

SurrealDB 3.x supports referential integrity, which means you can control what happens when a referenced record is deleted. This prevents orphaned data and enforces relationship rules at the database level:

```typescript
fields: {
  // Cascade delete: when user is deleted, delete this record
  author: record('user')
    .required()
    .reference()
    .onDelete('cascade'),
  
  // Reject delete: prevent deleting user if posts exist
  author: record('user')
    .required()
    .reference()
    .onDelete('reject'),
  
  // Other options: 'ignore', 'unset', or custom expression
}
```

### Graph relations

When a relationship needs its own data (like "when did this user follow that user?") or you need many-to-many connections, use graph relations. These create edge tables that SurrealDB can traverse efficiently:

```typescript
import { defineRelation } from 'smig';

const followsRelation = defineRelation({
  name: 'follows',
  from: 'user',
  to: 'user',
  enforced: true,
  fields: {
    followedAt: datetime().default('time::now()'),
    notifications: bool().default(true),
  },
});

const likesRelation = defineRelation({
  name: 'likes',
  from: 'user',
  to: 'post',
  fields: {
    likedAt: datetime().default('time::now()'),
  },
  indexes: {
    unique: index(['in', 'out']).unique(), // One like per user per post
  },
});
```

## Index strategies

Indexes speed up queries but come with storage and write-time costs. Creating the right indexes—and avoiding unnecessary ones—is key to good performance.

### When to create indexes

Not every field needs an index. Focus on fields that appear in `WHERE` clauses, `ORDER BY`, or need uniqueness constraints:

```typescript
indexes: {
  // Unique constraints
  email: index(['email']).unique(),
  
  // Frequently filtered fields
  status: index(['status']),
  
  // Frequently sorted fields
  createdAt: index(['createdAt']),
  
  // Composite for common queries
  byUserStatus: index(['userId', 'status', 'createdAt']),
}
```

### Index types

SurrealDB supports several specialised index types beyond the standard B-tree. Choosing the right type for your data and query patterns can dramatically improve performance:

```typescript
indexes: {
  // Standard B-tree (default)
  email: index(['email']).unique(),
  
  // Vector search (HNSW)
  embedding: index(['embedding'])
    .hnsw()
    .dimension(384)
    .dist('cosine'),
  
  // Full-text search
  content: index(['title', 'body'])
    .fulltext()
    .analyzer('english')
    .highlights(),
  
  // Count index (for aggregations)
  byStatus: index(['status']).count(),
}
```

## Events and triggers

Events let you run SurrealQL automatically when records are created, updated, or deleted. They're useful for maintaining derived data, enforcing complex rules, and creating audit trails.

### Common patterns

Here are the most frequently used event patterns. Each combines a trigger condition with an action:

```typescript
events: {
  // Update timestamp on modification
  updateTimestamp: event('update_timestamp')
    .onUpdate()
    .when('$event = "UPDATE"')
    .then('UPDATE $after.id SET updatedAt = time::now()'),
  
  // Cascade updates
  updateCounts: event('update_counts')
    .onCreate()
    .when('$event = "CREATE"')
    .then('UPDATE $after.author SET postCount += 1'),
  
  // Validation
  validateStatus: event('validate_status')
    .onUpdate()
    .when('$before.status = "published" AND $after.status = "draft"')
    .then('THROW "Cannot unpublish"'),
}
```

## See also

- [Tables reference](../schema-reference/tables.md)
- [Fields reference](../schema-reference/fields.md)
- [Indexes reference](../schema-reference/indexes.md)
- [Relations reference](../schema-reference/relations.md)

