# Schema design

Best practices for designing effective SurrealDB schemas with **smig**.

## Schema organization

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
// schema/user.js
export const userSchema = defineSchema({ /* ... */ });

// schema/blog.js
export const postSchema = defineSchema({ /* ... */ });
export const commentSchema = defineSchema({ /* ... */ });

// schema/index.js
import { composeSchema } from 'smig';
import { userSchema } from './user.js';
import { postSchema, commentSchema } from './blog.js';

export default composeSchema({
  models: { user: userSchema, post: postSchema, comment: commentSchema },
});
```

## Naming conventions

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

Use **camelCase** for multi-word fields:

```typescript
fields: {
  email: string(),
  firstName: string(),      // ✓ camelCase
  createdAt: datetime(),    // ✓ camelCase
  first_name: string(),     // ✗ snake_case (inconsistent)
}
```

### Indexes

Name indexes by their purpose:

```typescript
indexes: {
  email: index(['email']).unique(),           // Simple: field name
  byAuthorDate: index(['author', 'createdAt']), // Composite: descriptive
  searchContent: index(['content']).fulltext(), // Purpose: search
}
```

## Field patterns

### Required vs. optional

Choose whether a field can be null:

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

Provide values automatically:

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

Enforce data integrity rules:

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

### Record references

Link to other tables:

```typescript
fields: {
  // Single table reference
  author: record('user').required(),
  
  // Optional reference
  parentComment: option(record('comment')),
  
  // Union type (multiple possible tables)
  target: record(['post', 'comment', 'user']),
  
  // Any record
  subject: record(),
}
```

### Foreign key constraints

Control what happens when referenced records are deleted:

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

For many-to-many or attributed relationships, use relations:

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

### When to create indexes

Create indexes for these common scenarios:

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

Choose the right index type for your use case:

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

### Common patterns

Frequently used event triggers:

```typescript
events: {
  // Update timestamp on modification
  updateTimestamp: event('update_timestamp')
    .onUpdate()
    .when('$event = "UPDATE"')
    .thenDo('UPDATE $after.id SET updatedAt = time::now()'),
  
  // Cascade updates
  updateCounts: event('update_counts')
    .onCreate()
    .when('$event = "CREATE"')
    .thenDo('UPDATE $after.author SET postCount += 1'),
  
  // Validation
  validateStatus: event('validate_status')
    .onUpdate()
    .when('$before.status = "published" AND $after.status = "draft"')
    .thenDo('THROW "Cannot unpublish"'),
}
```

## See also

- [Tables reference](../schema-reference/tables.md)
- [Fields reference](../schema-reference/fields.md)
- [Indexes reference](../schema-reference/indexes.md)
- [Relations reference](../schema-reference/relations.md)

