# Tables

Define database tables with `defineSchema()`.

---

## Basic usage

```javascript
import { defineSchema, string, datetime } from 'smig';

const userSchema = defineSchema({
  table: 'user',
  fields: {
    name: string(),
    createdAt: datetime().default('time::now()'),
  },
});
```

**Generated SurrealQL:**

```sql
DEFINE TABLE user TYPE NORMAL SCHEMAFULL;
DEFINE FIELD name ON TABLE user TYPE string;
DEFINE FIELD createdAt ON TABLE user TYPE datetime DEFAULT time::now();
```

---

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `table` | `string` | Required | Table name |
| `fields` | `object` | Required | Field definitions |
| `schemaless` | `boolean` | `false` | Allow undefined fields |
| `type` | `string` | `'normal'` | Table type: `'normal'`, `'any'` |
| `drop` | `boolean` | `false` | Auto-delete old data |
| `changefeed` | `object` | - | Enable change tracking |
| `permissions` | `object` | - | Access control rules |
| `indexes` | `object` | - | Index definitions |
| `events` | `object` | - | Event triggers |
| `comments` | `string[]` | - | Documentation |

---

## Schema modes

### Schemafull (default)

Only defined fields are allowed:

```javascript
defineSchema({
  table: 'user',
  // schemaless: false (default)
  fields: { name: string() },
});
```

```sql
DEFINE TABLE user TYPE NORMAL SCHEMAFULL;
```

### Schemaless

Any fields are allowed:

```javascript
defineSchema({
  table: 'user',
  schemaless: true,
  fields: { name: string() },
});
```

```sql
DEFINE TABLE user TYPE NORMAL SCHEMALESS;
```

---

## Table types

### Normal (default)

Standard data table:

```javascript
defineSchema({
  table: 'user',
  type: 'normal',
  fields: { /* ... */ },
});
```

### Any

Accepts any record type:

```javascript
defineSchema({
  table: 'audit_log',
  type: 'any',
  fields: { /* ... */ },
});
```

---

## Permissions

Control access per operation:

```javascript
defineSchema({
  table: 'post',
  fields: { /* ... */ },
  permissions: {
    select: 'true',  // Anyone can read
    create: '$auth.id != NONE',  // Must be logged in
    update: 'author = $auth.id',  // Only author
    delete: 'author = $auth.id OR $auth.role = "admin"',
  },
});
```

**Generated:**

```sql
DEFINE TABLE post TYPE NORMAL SCHEMAFULL
  PERMISSIONS
    FOR select FULL,
    FOR create WHERE $auth.id != NONE,
    FOR update WHERE author = $auth.id,
    FOR delete WHERE author = $auth.id OR $auth.role = "admin";
```

---

## Drop tables

Auto-delete records after a duration:

```javascript
defineSchema({
  table: 'session',
  drop: true,
  fields: {
    expiresAt: datetime(),
  },
});
```

---

## Changefeed

Enable change data capture:

```javascript
defineSchema({
  table: 'order',
  changefeed: {
    expiry: '7d',
    includeOriginal: true,
  },
  fields: { /* ... */ },
});
```

**Generated:**

```sql
DEFINE TABLE order TYPE NORMAL SCHEMAFULL CHANGEFEED 7d INCLUDE ORIGINAL;
```

---

## Complete example

```javascript
const postSchema = defineSchema({
  table: 'post',
  fields: {
    author: record('user').required(),
    title: string().required().length(1, 200),
    content: string().required(),
    published: bool().default(false),
    createdAt: datetime().default('time::now()'),
    updatedAt: datetime().value('time::now()'),
  },
  indexes: {
    author: index(['author']),
    published: index(['published', 'createdAt']),
    search: index(['title', 'content']).fulltext().analyzer('english'),
  },
  events: {
    notifyFollowers: event('notify_followers')
      .onUpdate()
      .when('$before.published = false AND $after.published = true')
      .thenDo('/* notification logic */'),
  },
  permissions: {
    select: 'published = true OR author = $auth.id',
    create: '$auth.id != NONE',
    update: 'author = $auth.id',
    delete: 'author = $auth.id',
  },
  comments: ['Blog post content with full-text search'],
});
```

---

## See also

- [Fields](fields.md) - Field type definitions
- [Indexes](indexes.md) - Index options
- [Events](events.md) - Event triggers
- [Relations](relations.md) - For graph edges

