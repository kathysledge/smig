# Tables

Tables are the foundation of your database schema. Every piece of data lives in a table.

## What is a table?

A table is a collection of records with a shared structure. In a blog application, you might have:

- A `user` table (people who can log in)
- A `post` table (blog posts)
- A `comment` table (comments on posts)

Each table has fields (columns), and can have indexes, events, and permissions.

## Creating a table

Use `defineSchema` to create a table with fields, indexes, and events:

```typescript
import { defineSchema, string, datetime } from 'smig';

const users = defineSchema({
  table: 'user',
  fields: {
    email: string().required(),
    name: string(),
    createdAt: datetime().default('time::now()'),
  },
});
```

This generates:

```surql
DEFINE TABLE user TYPE NORMAL SCHEMAFULL;
DEFINE FIELD email ON TABLE user TYPE string ASSERT $value != NONE;
DEFINE FIELD name ON TABLE user TYPE string;
DEFINE FIELD createdAt ON TABLE user TYPE datetime DEFAULT time::now();
```

## Table options

### Schema modes

By default, tables are **schemafull** — only defined fields are allowed.

```typescript
// Schemafull (default) — strict typing
const strictTable = defineSchema({
  table: 'user',
  fields: { ... },
});

// Schemaless — allow any fields
const flexibleTable = defineSchema({
  table: 'logs',
  schemaless: true,
  fields: { ... },  // These are optional hints
});
```

Use schemaless for:
- Log data with varying fields
- Unstructured imports
- Prototyping

Use schemafull (default) for:
- User data
- Core application tables
- Anything where you want type safety

### Table types

SurrealDB supports different table types for different use cases:

```typescript
// Normal table (default)
defineSchema({
  table: 'user',
  type: 'NORMAL',
  fields: { ... },
});

// Relation table (graph edge)
// Use defineRelation() instead - see Relations
defineRelation({
  name: 'follows',
  from: 'user',
  to: 'user',
});

// Any record type
defineSchema({
  table: 'mixed',
  type: 'ANY',
  fields: { ... },
});
```

### Drop (auto-delete)

Records are automatically deleted after their TTL:

```typescript
defineSchema({
  table: 'session',
  drop: true,
  fields: {
    expiresAt: datetime(),
  },
});
```

With drop enabled, records without an expiry are deleted immediately.

### Changefeed

Enable change data capture for real-time sync:

```typescript
defineSchema({
  table: 'orders',
  changefeed: '7d',  // Keep changes for 7 days
  changefeedIncludeOriginal: true,  // Include before/after values
  fields: { ... },
});
```

Use changefeeds for:
- Audit logs
- Real-time dashboards
- Syncing to external systems

### Views

Define a table as a query result:

```typescript
defineSchema({
  table: 'active_users',
  view: 'SELECT * FROM user WHERE lastLogin > time::now() - 7d',
  fields: { ... },  // Define expected shape
});
```

Views are read-only and computed on query.

### Comments

Document your table:

```typescript
defineSchema({
  table: 'user',
  comments: ['Registered user accounts'],
  fields: { ... },
});
```

## Permissions

Control who can do what:

```typescript
defineSchema({
  table: 'post',
  permissions: `
    FOR select WHERE isPublished = true OR author = $auth.id
    FOR create WHERE $auth.id != NONE
    FOR update WHERE author = $auth.id
    FOR delete WHERE author = $auth.id
  `,
  fields: { ... },
});
```

### Permission levels

| Level | Meaning |
|-------|---------|
| `FULL` | Anyone can do this operation |
| `NONE` | No one can do this operation |
| `WHERE ...` | Allow if condition is true |

### Common patterns

Here are frequently used permission patterns:

```typescript
// Public read, authenticated write
permissions: `
  FOR select FULL
  FOR create, update, delete WHERE $auth.id != NONE
`

// Owner-only
permissions: `
  FOR select, create, update, delete WHERE owner = $auth.id
`

// Role-based
permissions: `
  FOR select FULL
  FOR create, update WHERE $auth.role IN ['admin', 'editor']
  FOR delete WHERE $auth.role = 'admin'
`

// Private (only accessible via functions)
permissions: 'NONE'
```

## Table with everything

A complete post table demonstrating all table features:

```typescript
import { defineSchema, string, int, datetime, bool, uuid, record, index, event } from 'smig';

const posts = defineSchema({
  table: 'post',
  comments: ['Blog posts'],
  
  // Access control
  permissions: `
    FOR select WHERE isPublished = true OR author = $auth.id
    FOR create WHERE $auth.id != NONE
    FOR update, delete WHERE author = $auth.id
  `,
  
  fields: {
    // Auto-generated ID
    id: uuid().default('rand::uuid::v7()').readonly(),
    
    // Core content
    title: string().required(),
    slug: string().required(),
    content: string(),
    excerpt: string().computed('string::slice(content, 0, 200)'),
    
    // Author reference
    author: record('user').required(),
    
    // Status
    isPublished: bool().default(false),
    publishedAt: datetime(),
    
    // Metrics (readonly to protect from manipulation)
    viewCount: int().default(0).readonly(),
    
    // Timestamps
    createdAt: datetime().default('time::now()').readonly(),
    updatedAt: datetime().defaultAlways('time::now()'),
  },
  
  indexes: {
    slug: index(['slug']).unique(),
    author: index(['author']),
    published: index(['isPublished', 'publishedAt']),
    content: index(['title', 'content']).search('english').highlights(),
  },
  
  events: {
    publish: event('on_publish')
      .onUpdate()
      .when('$before.isPublished = false AND $after.isPublished = true')
      .then('UPDATE $after SET publishedAt = time::now()'),
  },
});
```

## Renaming tables

When you rename a table, use `was` so **smig** generates a rename instead of dropping data:

```typescript
const customers = defineSchema({
  table: 'customers',
  was: 'users',  // Previously called 'users'
  fields: { ... },
});
```

This generates:

```surql
ALTER TABLE users RENAME TO customers;
```

For multiple renames in history:

```typescript
was: ['clients', 'users']  // Was 'clients', then 'users'
```

## Composing tables

Individual table schemas are combined with `composeSchema`:

```typescript
import { composeSchema } from 'smig';

export default composeSchema({
  models: {
    user: userSchema,
    post: postSchema,
    comment: commentSchema,
  },
});
```

This is what you export from your schema file.

## Related

- [Fields](/schema-reference/fields) — Define what data tables hold
- [Indexes](/schema-reference/indexes) — Speed up queries
- [Events](/schema-reference/events) — Trigger logic on changes
- [Relations](/schema-reference/relations) — Connect tables with graph edges
