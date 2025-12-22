# Tables

Tables are the foundation of your database schema. Every piece of data lives in a table.

## What is a table?

If you're coming from SQL databases, a table in SurrealDB works similarly—it's a collection of records with a shared structure. The difference is that SurrealDB tables can also participate in graph relationships and have flexible schema options.

In a blog application, you might have:

- A `user` table (people who can log in)
- A `post` table (blog posts)
- A `comment` table (comments on posts)

Each table has fields (columns), and can have indexes, events, and permissions.

## Creating a table

The `defineSchema` function is how you define a table in **smig**. It takes an object describing the table's name, fields, indexes, events, and permissions:

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

These optional settings control how your table behaves. Most tables only need fields and indexes, but these options unlock advanced features.

### Schema modes

SurrealDB supports two schema modes. Schemafull (the default) rejects fields that aren't defined in your schema. Schemaless allows any fields:

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

Most tables are "NORMAL" and hold standard records. Relation tables (for graph edges) are defined differently—see the Relations reference:

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

For temporary data like sessions or verification tokens, you can have SurrealDB automatically delete expired records:

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

Changefeeds capture every change to a table, enabling real-time subscriptions and audit trails:

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

A view is a virtual table defined by a query. The data isn't stored—it's computed each time you query the view:

```typescript
defineSchema({
  table: 'active_users',
  view: 'SELECT * FROM user WHERE lastLogin > time::now() - 7d',
  fields: { ... },  // Define expected shape
});
```

Views are read-only and computed on query.

### Comments

Add documentation that appears in database introspection tools:

```typescript
defineSchema({
  table: 'user',
  comments: ['Registered user accounts'],
  fields: { ... },
});
```

## Permissions

Permissions define who can select, create, update, and delete records. They're evaluated for every query and provide row-level security:

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

There are three permission levels:

| Level | Meaning |
|-------|---------|
| `FULL` | Anyone can do this operation |
| `NONE` | No one can do this operation |
| `WHERE ...` | Allow if condition is true |

### Common patterns

These patterns cover most permission scenarios you'll encounter:

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

Here's a comprehensive example showing fields, indexes, events, permissions, and comments working together:

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

When you rename a table, tell **smig** about the old name so it generates a rename statement instead of dropping and recreating the table (which would lose data):

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

After defining individual tables, combine them into a complete schema with `composeSchema`. This is what you export from your schema file:

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
