# Relations

Relations are how you connect records in SurrealDB. Unlike traditional foreign keys, SurrealDB relations are first-class graph edges — they can have their own fields and be queried in either direction.

## What is a relation?

If you're familiar with SQL databases, you know that many-to-many relationships require a junction table. SurrealDB elevates this concept with first-class relations that can be traversed in both directions using graph queries.

In a social network, users follow other users. In a traditional database, you'd create a junction table:

```surql
CREATE TABLE follows (
  follower_id INT,
  following_id INT,
  created_at TIMESTAMP
);
```

In SurrealDB, this becomes a **relation** — a special kind of table that connects two records:

```typescript
import { defineRelation, datetime } from 'smig';

const follows = defineRelation({
  name: 'follows',
  from: 'user',
  to: 'user',
  fields: {
    since: datetime().default('time::now()'),
  },
});
```

The power of relations is that you can traverse them:

```surql
-- Who does Alice follow?
SELECT ->follows->user FROM user WHERE name = 'Alice';

-- Who follows Alice?
SELECT <-follows<-user FROM user WHERE name = 'Alice';
```

## Creating relations

Use `defineRelation()` instead of `defineSchema()` when you want graph-style connections between records.

### Basic relation

At minimum, a relation needs a name and the table types it connects:

```typescript
import { defineRelation } from 'smig';

const likes = defineRelation({
  name: 'likes',
  from: 'user',
  to: 'post',
});
```

This generates:

```surql
DEFINE TABLE likes TYPE RELATION IN user OUT post SCHEMAFULL;
DEFINE FIELD in ON TABLE likes TYPE record<user> ASSERT $value != NONE;
DEFINE FIELD out ON TABLE likes TYPE record<post> ASSERT $value != NONE;
```

### Relation with fields

Unlike simple foreign keys, relations can carry their own data—like when the relationship was created, or attributes of the connection:

```typescript
const reviewed = defineRelation({
  name: 'reviewed',
  from: 'user',
  to: 'product',
  fields: {
    rating: int().required().assert('$value >= 1 AND $value <= 5'),
    comment: string(),
    createdAt: datetime().default('time::now()'),
  },
});
```

### Self-referential relations

Relations can connect records of the same table type—useful for follows, friendships, or hierarchies:

```typescript
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

### Multiple target types

A relation's "to" side can accept multiple table types, useful for polymorphic relationships:

```typescript
const mentions = defineRelation({
  name: 'mentions',
  from: 'comment',
  to: ['user', 'post', 'product'],  // Can mention any of these
});
```

## Creating relation records

Create relation records using the RELATE statement with arrow syntax. This is more expressive than CREATE for graph data:

```surql
-- Alice follows Bob
RELATE user:alice->follows->user:bob SET since = time::now();

-- With fields
RELATE user:alice->reviewed->product:laptop SET rating = 5, comment = 'Great laptop!';
```

Or using CREATE:

```surql
CREATE follows SET in = user:alice, out = user:bob, since = time::now();
```

## Querying relations

The real power of relations is graph traversal. SurrealDB's arrow syntax lets you navigate relationships in queries without joins.

### Outbound traversal

Follow relations forward (from the starting record outward) with the `->` arrow:

```surql
-- Posts that Alice likes
SELECT ->likes->post FROM user:alice;

-- Users that Alice follows
SELECT ->follows->user.name FROM user:alice;
```

### Inbound traversal

Follow relations backward (from the target back to the source) with the `<-` arrow:

```surql
-- Users who like this post
SELECT <-likes<-user FROM post:xyz;

-- Users who follow Alice
SELECT <-follows<-user.name FROM user:alice;
```

### Get the relation itself

Sometimes you need data from the relation record itself, not just the connected records:

```surql
-- All follow relationships for Alice
SELECT ->follows FROM user:alice;

-- With relation fields
SELECT ->reviewed.rating, ->reviewed.comment, ->reviewed->product.name FROM user:alice;
```

### Filter by relation fields

You can filter traversals based on relation field values:

```surql
-- 5-star reviews from Alice
SELECT ->reviewed WHERE rating = 5 ->product FROM user:alice;
```

## Relation options

These options control relation behaviour and security.

### Enforced referential integrity

With `enforced: true`, SurrealDB automatically deletes relations when either connected record is deleted:

```typescript
const follows = defineRelation({
  name: 'follows',
  from: 'user',
  to: 'user',
  enforced: true,  // Delete relation if user is deleted
});
```

### Permissions

Relation permissions work like table permissions. A common pattern is allowing users to only create relations from themselves:

```typescript
const follows = defineRelation({
  name: 'follows',
  from: 'user',
  to: 'user',
  permissions: `
    FOR select FULL
    FOR create, delete WHERE in = $auth.id
  `,
});
```

This allows:
- Anyone can see who follows who
- Users can only create/delete follows from themselves

### Indexes on relations

If you query relations by their fields, add indexes for performance:

```typescript
const follows = defineRelation({
  name: 'follows',
  from: 'user',
  to: 'user',
  fields: {
    since: datetime().default('time::now()'),
  },
  indexes: {
    since: index(['since']),
  },
});
```

### Events on relations

Relations support events just like regular tables—useful for notifications or syncing counts:

```typescript
const follows = defineRelation({
  name: 'follows',
  from: 'user',
  to: 'user',
  events: {
    notify: event('on_follow')
      .onCreate()
      .then('CREATE notification SET user = $after.out, message = "New follower!"'),
  },
});
```

## Common patterns

These patterns cover typical relation use cases. Copy and adapt them for your schema.

### Social follow

A complete follow system with timestamps, mute options, and proper permissions:

```typescript
const follows = defineRelation({
  name: 'follows',
  from: 'user',
  to: 'user',
  fields: {
    since: datetime().default('time::now()'),
    muted: bool().default(false),
    notifications: bool().default(true),
  },
  indexes: {
    since: index(['since']),
  },
  permissions: `
    FOR select FULL
    FOR create WHERE in = $auth.id AND out != $auth.id
    FOR update, delete WHERE in = $auth.id
  `,
});
```

### Purchase history

Track purchases with rich metadata about each transaction:

```typescript
const purchased = defineRelation({
  name: 'purchased',
  from: 'user',
  to: 'product',
  fields: {
    quantity: int().default(1),
    price: decimal().required(),
    purchasedAt: datetime().default('time::now()'),
    orderId: record('order'),
  },
});
```

### Hierarchical data

Self-referential relations can model trees and hierarchies:

```typescript
const parentOf = defineRelation({
  name: 'parent_of',
  from: 'category',
  to: 'category',
});

// Query: Get all descendants
// SELECT ->parent_of->category.* FROM category:electronics;
```

### Weighted edges

For recommendation systems, track interaction strength on relation edges:

```typescript
const interacted = defineRelation({
  name: 'interacted',
  from: 'user',
  to: 'item',
  fields: {
    weight: float().default(1.0),
    type: string(),  // 'view', 'click', 'purchase'
    timestamp: datetime().default('time::now()'),
  },
});
```

## Relations vs. record fields

Choosing between a relation and a simple record reference depends on your query patterns and data model.

### Use a relation when:

- You need to traverse in both directions
- The connection has its own data (rating, timestamp, etc.)
- You want to query the connections as a collection
- The relationship is many-to-many

### Use a record field when:

- It’s a simple parent-child reference
- You only query in one direction
- It’s a one-to-many relationship with no extra data

```typescript
// Record field: Post has one author
fields: {
  author: record('user').required(),
}

// Relation: User likes many posts, post is liked by many users
const likes = defineRelation({
  name: 'likes',
  from: 'user',
  to: 'post',
});
```

## Renaming relations

Like tables and fields, relations support rename tracking to preserve data during migrations:

```typescript
const connections = defineRelation({
  name: 'connections',
  was: 'follows',  // Renamed from 'follows'
  from: 'user',
  to: 'user',
});
```

## Complete example

Here's a social network schema demonstrating tables, relations, and how they work together:

```typescript
import { defineSchema, defineRelation, string, datetime, int, bool, index, event, composeSchema } from 'smig';

const user = defineSchema({
  table: 'user',
  fields: {
    name: string().required(),
    avatar: string(),
  },
});

const post = defineSchema({
  table: 'post',
  fields: {
    content: string().required(),
    author: record('user').required(),
    createdAt: datetime().default('time::now()'),
  },
});

const follows = defineRelation({
  name: 'follows',
  from: 'user',
  to: 'user',
  fields: {
    since: datetime().default('time::now()'),
  },
});

const likes = defineRelation({
  name: 'likes',
  from: 'user',
  to: 'post',
  fields: {
    likedAt: datetime().default('time::now()'),
  },
});

export default composeSchema({
  models: { user, post },
  relations: { follows, likes },
});
```

## Related

- [Tables](/schema-reference/tables) — The records being connected
- [Fields](/schema-reference/fields) — Record reference fields
- [Social network example](/examples/social-network) — Complete social app schema
