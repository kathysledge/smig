# Social platform

A comprehensive social platform schema demonstrating schemaless tables, threaded discussions, and flexible content types. This example models a forum-style application with users, posts, topics, threads, comments, and notifications.

## What you'll learn

This example showcases several advanced patterns:

- **Schemaless tables** — Allow dynamic fields beyond your defined schema
- **Hierarchical content** — Posts and threads with reply chains
- **Topic organisation** — Categorise content into topics
- **Notification system** — Track and manage user notifications
- **Flexible relationships** — Self-referential replies and cross-table references

## Schema

The complete schema with six interconnected tables:

```typescript
import {
  array,
  bool,
  composeSchema,
  datetime,
  defineSchema,
  index,
  int,
  option,
  record,
  string,
} from 'smig';

/**
 * Social Platform Schema Example
 *
 * Demonstrates a comprehensive social platform with:
 * - Users, posts, comments
 * - Topics and voting
 * - Schemaless tables
 */

const user = defineSchema({
  table: 'user',
  schemaless: true,
  fields: {
    email: string().assert('string::is_email($value)'),
    name: string()
      .assert('$value != NONE')
      .assert('string::len($value) >= 3')
      .assert('string::len($value) <= 32'),
    link: option('string'),
    description: option('string'),
    dateJoined: datetime().default('time::now()'),
    tokens: int().default(0).assert('$value >= 0'),
    roles: array(string()).default([]),
  },
  indexes: {
    email: index(['email']).unique(),
    name: index(['name']).unique(),
  },
});

const topic = defineSchema({
  table: 'topic',
  schemaless: true,
  fields: {
    posts: array(record('post')).default([]),
    threads: array(record('thread')).default([]),
  },
});

const post = defineSchema({
  table: 'post',
  schemaless: true,
  fields: {
    user: record('user'),
    title: string().assert('$value != NONE'),
    content: string(),
    time: datetime().default('time::now()'),
    replyTo: option('record<post>'),
    topics: array(record('topic')).default([]),
    archived: bool().default(false),
    edited: bool().default(false),
    visits: int().default(0),
  },
});

const thread = defineSchema({
  table: 'thread',
  schemaless: true,
  fields: {
    user: record('user'),
    content: string().assert('$value != NONE'),
    time: datetime().default('time::now()'),
    replyTo: option('record<thread>'),
    topics: array(record('topic')).default([]),
    edited: bool().default(false),
    visits: int().default(0),
  },
});

const comment = defineSchema({
  table: 'comment',
  schemaless: true,
  fields: {
    user: record('user'),
    post: record('post'),
    content: string(),
    time: datetime().default('time::now()'),
    edited: bool().default(false),
  },
});

const notification = defineSchema({
  table: 'notification',
  schemaless: true,
  fields: {
    recipient: record('user'),
    message: string(),
    time: datetime().default('time::now()'),
    viewed: bool().default(false),
  },
});

export default composeSchema({
  models: {
    user,
    topic,
    post,
    thread,
    comment,
    notification,
  },
  relations: {},
});
```

## Understanding schemaless tables

Unlike the strict schemas in other examples, this platform uses `schemaless: true` on every table. This creates tables with `SCHEMALESS` mode in SurrealDB, which means:

**Defined fields are still validated** — The fields you specify still have their types checked and assertions enforced.

**Additional fields are allowed** — You can store extra fields that aren't in your schema definition. This is useful for:
- Storing user preferences without schema changes
- Adding experimental features gradually
- Handling varying content formats

```surql
-- This works with schemaless tables
CREATE post SET
  user = user:alice,
  title = "My first post",
  content = "Hello world!",
  customField = "This isn't in the schema but it works!",
  metadata = { views: 0, shares: 0 };
```

### When to use schemaless

Consider schemaless tables when:
- Your data structure evolves frequently
- Different records need different fields
- You're prototyping and exploring data models
- You need to store arbitrary metadata

Stick with schemafull tables when:
- Data consistency is critical
- You want to prevent unexpected fields
- Your schema is stable and well-defined

## Table relationships

This schema demonstrates several relationship patterns:

### User → Content ownership

Every piece of content links back to its author:

```typescript
user: record('user'),  // Who created this post/thread/comment
```

### Self-referential replies

Posts and threads can reply to other posts and threads of the same type:

```typescript
replyTo: option('record<post>'),   // Reply chains for posts
replyTo: option('record<thread>'), // Reply chains for threads
```

### Topic categorisation

Content can belong to multiple topics:

```typescript
topics: array(record('topic')).default([]),
```

### Cross-table notifications

Notifications reference users without coupling to specific content types:

```typescript
recipient: record('user'),
message: string(),
```

## Generated SurrealQL

Running `bun smig migrate` generates:

```surql
-- Users
DEFINE TABLE user TYPE NORMAL SCHEMALESS;
DEFINE FIELD email ON TABLE user TYPE string ASSERT string::is_email($value);
DEFINE FIELD name ON TABLE user TYPE string
  ASSERT ($value != NONE) AND (string::len($value) >= 3) AND (string::len($value) <= 32);
DEFINE FIELD link ON TABLE user TYPE option<string>;
DEFINE FIELD description ON TABLE user TYPE option<string>;
DEFINE FIELD dateJoined ON TABLE user TYPE datetime DEFAULT time::now();
DEFINE FIELD tokens ON TABLE user TYPE int DEFAULT 0 ASSERT $value >= 0;
DEFINE FIELD roles ON TABLE user TYPE array<string> DEFAULT [];
DEFINE INDEX email ON TABLE user FIELDS email UNIQUE;
DEFINE INDEX name ON TABLE user FIELDS name UNIQUE;

-- Topics
DEFINE TABLE topic TYPE NORMAL SCHEMALESS;
DEFINE FIELD posts ON TABLE topic TYPE array<record<post>> DEFAULT [];
DEFINE FIELD threads ON TABLE topic TYPE array<record<thread>> DEFAULT [];

-- Posts
DEFINE TABLE post TYPE NORMAL SCHEMALESS;
DEFINE FIELD user ON TABLE post TYPE record<user>;
DEFINE FIELD title ON TABLE post TYPE string ASSERT $value != NONE;
DEFINE FIELD content ON TABLE post TYPE string;
DEFINE FIELD time ON TABLE post TYPE datetime DEFAULT time::now();
DEFINE FIELD replyTo ON TABLE post TYPE option<record<post>>;
DEFINE FIELD topics ON TABLE post TYPE array<record<topic>> DEFAULT [];
DEFINE FIELD archived ON TABLE post TYPE bool DEFAULT false;
DEFINE FIELD edited ON TABLE post TYPE bool DEFAULT false;
DEFINE FIELD visits ON TABLE post TYPE int DEFAULT 0;

-- Threads (similar structure)
DEFINE TABLE thread TYPE NORMAL SCHEMALESS;
-- ... thread fields ...

-- Comments
DEFINE TABLE comment TYPE NORMAL SCHEMALESS;
DEFINE FIELD user ON TABLE comment TYPE record<user>;
DEFINE FIELD post ON TABLE comment TYPE record<post>;
DEFINE FIELD content ON TABLE comment TYPE string;
DEFINE FIELD time ON TABLE comment TYPE datetime DEFAULT time::now();
DEFINE FIELD edited ON TABLE comment TYPE bool DEFAULT false;

-- Notifications
DEFINE TABLE notification TYPE NORMAL SCHEMALESS;
DEFINE FIELD recipient ON TABLE notification TYPE record<user>;
DEFINE FIELD message ON TABLE notification TYPE string;
DEFINE FIELD time ON TABLE notification TYPE datetime DEFAULT time::now();
DEFINE FIELD viewed ON TABLE notification TYPE bool DEFAULT false;
```

## Example queries

### Create a user

```surql
CREATE user SET
  email = "alice@example.com",
  name = "alice",
  description = "Full-stack developer and coffee enthusiast";
```

### Create a post in topics

```surql
CREATE post SET
  user = user:alice,
  title = "Getting started with SurrealDB",
  content = "Let me share what I've learned...",
  topics = [topic:databases, topic:tutorials];
```

### Reply to a post

```surql
CREATE post SET
  user = user:bob,
  title = "RE: Getting started with SurrealDB",
  content = "Great post! I'd add that...",
  replyTo = post:original123;
```

### Get a thread with all replies

```surql
SELECT
  *,
  (SELECT * FROM post WHERE replyTo = $parent.id ORDER BY time) AS replies
FROM post
WHERE id = post:original123;
```

### Send a notification

```surql
CREATE notification SET
  recipient = user:alice,
  message = "Bob replied to your post";
```

### Get unread notifications

```surql
SELECT * FROM notification
WHERE recipient = user:alice AND viewed = false
ORDER BY time DESC;
```

### Mark notifications as read

```surql
UPDATE notification
SET viewed = true
WHERE recipient = user:alice AND viewed = false;
```

## Extending this example

### Add voting

Create a relation to track upvotes and downvotes:

```typescript
import { defineRelation } from 'smig';

const voteRelation = defineRelation({
  name: 'voted',
  from: 'user',
  to: 'post',
  fields: {
    direction: int().assert('$value IN [-1, 1]'),  // -1 = downvote, 1 = upvote
    votedAt: datetime().default('time::now()'),
  },
});
```

### Add full-text search

Add search indexes to posts:

```typescript
indexes: {
  searchTitle: index(['title']).search().analyzer('english'),
  searchContent: index(['content']).search().analyzer('english'),
}
```

### Add badges or achievements

Since tables are schemaless, you can add badges without changing the schema:

```surql
UPDATE user:alice SET badges = ["early_adopter", "helpful"];
```

## See also

- [Social network](/examples/social-network) — Graph-based follows and likes
- [Simple blog](/examples/blog) — Schemafull alternative with comments
- [Tables reference](/schema-reference/tables) — Schemafull vs schemaless

