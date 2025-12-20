# Schema reference

This is the complete reference for everything you can define with **smig**. Each page covers one type of database entity — what it is, when you’d use it, and every option available.

## How this reference is organized

Each page follows the same structure:

1. **What is it?** — Plain explanation of the concept
2. **When would you use it?** — Practical scenarios
3. **Basic usage** — Minimal working example
4. **All options** — Complete list with examples
5. **Generated SurrealQL** — What **smig** produces
6. **Related** — Links to connected topics

## Tables and fields

The foundation of your database:

| Topic | What it covers |
|-------|----------------|
| [Tables](/schema-reference/tables) | Creating tables, schema modes, table types, changefeeds |
| [Fields](/schema-reference/fields) | Data types, defaults, validation, computed values |
| [Indexes](/schema-reference/indexes) | Unique constraints, search, vector indexes |
| [Events](/schema-reference/events) | Triggers that run on data changes |

## Relationships

SurrealDB’s graph capabilities:

| Topic | What it covers |
|-------|----------------|
| [Relations](/schema-reference/relations) | Connecting records with edge tables |

## Database logic

Reusable code and configuration:

| Topic | What it covers |
|-------|----------------|
| [Functions](/schema-reference/functions) | Custom database functions with parameters |
| [Analyzers](/schema-reference/analyzers) | Full-text search tokenizers and filters |

## Security and access

Authentication and authorization:

| Topic | What it covers |
|-------|----------------|
| [Access](/schema-reference/access) | JWT, RECORD, and BEARER authentication |

## System configuration

Database-level settings:

| Topic | What it covers |
|-------|----------------|
| [Params](/schema-reference/params) | Global configuration parameters |
| [Sequences](/schema-reference/sequences) | Auto-incrementing values |
| [Config](/schema-reference/config) | GraphQL and API configuration |

## Quick examples

### A complete table

A blog post with fields, indexes, and an event:

```typescript
import { defineSchema, string, datetime, int, bool, index, event } from 'smig';

const posts = defineSchema({
  table: 'post',
  fields: {
    title: string().required(),
    content: string(),
    author: record('user').required(),
    viewCount: int().default(0).readonly(),
    isPublished: bool().default(false),
    createdAt: datetime().default('time::now()'),
    updatedAt: datetime(),
  },
  indexes: {
    author: index(['author']),
    published: index(['isPublished', 'createdAt']),
    title: index(['title']).search('english'),
  },
  events: {
    trackViews: event('track_views')
      .onUpdate()
      .when('$before.viewCount != $after.viewCount')
      .then('CREATE analytics SET post = $after.id, views = $after.viewCount'),
  },
});
```

### A relation (graph edge)

A social follow relationship with metadata:

```typescript
import { defineRelation, datetime, int } from 'smig';

const follows = defineRelation({
  name: 'follows',
  from: 'user',
  to: 'user',
  fields: {
    since: datetime().default('time::now()'),
    notifications: bool().default(true),
  },
});
```

### Custom function

A reusable database function:

```typescript
import { fn } from 'smig';

const daysSince = fn('fn::days_since')
  .params({ date: 'datetime' })
  .returns('int')
  .body('RETURN math::floor((time::now() - $date) / 86400);');
```

### Authentication

User signup and signin:

```typescript
import { access } from 'smig';

const userAuth = access('user')
  .type('RECORD')
  .signup('CREATE user SET email = $email, password = crypto::argon2::generate($password)')
  .signin('SELECT * FROM user WHERE email = $email AND crypto::argon2::compare(password, $password)')
  .session('7d');
```

## Composing it all together

Individual schemas are combined with `composeSchema`:

```typescript
import { composeSchema } from 'smig';

export default composeSchema({
  // Tables
  models: {
    user: userSchema,
    post: postSchema,
  },
  
  // Graph relations
  relations: {
    follows: followsRelation,
    likes: likesRelation,
  },
  
  // Database functions
  functions: [daysSince, formatDate],
  
  // Full-text analyzers
  analyzers: [englishAnalyzer],
  
  // Authentication methods
  scopes: [userAuth, adminAuth],
});
```

This single export is what **smig** uses to generate migrations.
