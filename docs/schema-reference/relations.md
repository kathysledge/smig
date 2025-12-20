# Relations

Define graph edges between records with `defineRelation()`.

---

## When to use relations

| Use case | Solution |
|----------|----------|
| One-to-one | Record field: `author: record('user')` |
| One-to-many | Record field: `author: record('user')` |
| Many-to-many | **Relation table** |
| Edge with data | **Relation table** |
| Graph traversal | **Relation table** |

---

## Basic usage

```javascript
import { defineRelation, datetime } from 'smig';

const followsRelation = defineRelation({
  name: 'follows',
  from: 'user',
  to: 'user',
});
```

**Generated SurrealQL:**

```sql
DEFINE TABLE follows TYPE RELATION IN user OUT user SCHEMAFULL;
DEFINE FIELD in ON TABLE follows TYPE record<user> ASSERT $value != NONE;
DEFINE FIELD out ON TABLE follows TYPE record<user> ASSERT $value != NONE;
```

---

## Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `name` | `string` | Yes | Relation table name |
| `from` | `string` | Yes | Source table |
| `to` | `string` | Yes | Target table |
| `enforced` | `boolean` | No | Enforce referential integrity |
| `fields` | `object` | No | Additional edge fields |
| `indexes` | `object` | No | Relation indexes |
| `events` | `object` | No | Relation events |

---

## Enforced relations

Ensure referenced records exist:

```javascript
const followsRelation = defineRelation({
  name: 'follows',
  from: 'user',
  to: 'user',
  enforced: true,  // Cannot follow non-existent users
});
```

**Generated:**

```sql
DEFINE TABLE follows TYPE RELATION IN user OUT user ENFORCED SCHEMAFULL;
```

---

## Edge attributes

Add data to the relationship itself:

```javascript
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

## Relation indexes

```javascript
const followsRelation = defineRelation({
  name: 'follows',
  from: 'user',
  to: 'user',
  fields: {
    followedAt: datetime().default('time::now()'),
  },
  indexes: {
    // Prevent duplicate follows
    unique: index(['in', 'out']).unique(),
    
    // Query followers efficiently
    byFollower: index(['in', 'followedAt']),
    byFollowed: index(['out', 'followedAt']),
  },
});
```

---

## Relation events

```javascript
const followsRelation = defineRelation({
  name: 'follows',
  from: 'user',
  to: 'user',
  fields: {
    followedAt: datetime().default('time::now()'),
  },
  events: {
    updateCounts: event('update_counts')
      .onCreate()
      .when('$event = "CREATE"')
      .thenDo(`{
        UPDATE $after.in SET followingCount += 1;
        UPDATE $after.out SET followerCount += 1;
      }`),
      
    decrementCounts: event('decrement_counts')
      .onDelete()
      .when('$event = "DELETE"')
      .thenDo(`{
        UPDATE $before.in SET followingCount -= 1;
        UPDATE $before.out SET followerCount -= 1;
      }`),
  },
});
```

---

## Creating relations in queries

Once defined, create relations using the `RELATE` statement:

```sql
-- User 1 follows User 2
RELATE user:1 -> follows -> user:2;

-- With edge data
RELATE user:1 -> likes -> post:5 SET reaction = "love";
```

---

## Querying relations

```sql
-- Get all users that user:1 follows
SELECT * FROM user:1 -> follows -> user;

-- Get all followers of user:1
SELECT * FROM user <- follows <- user:1;

-- Get posts liked by user:1 with reaction
SELECT *, <-likes<-user.reaction FROM post WHERE <-likes<-user CONTAINS user:1;

-- Graph traversal: friends of friends
SELECT * FROM user:1 -> follows -> user -> follows -> user;
```

---

## Common patterns

### Follow/unfollow

```javascript
const followsRelation = defineRelation({
  name: 'follows',
  from: 'user',
  to: 'user',
  enforced: true,
  fields: {
    followedAt: datetime().default('time::now()'),
    notifications: bool().default(true),
  },
  indexes: {
    unique: index(['in', 'out']).unique(),
  },
});
```

### Likes with reactions

```javascript
const likesRelation = defineRelation({
  name: 'likes',
  from: 'user',
  to: ['post', 'comment'],  // Can like posts or comments
  fields: {
    reaction: string().default('like'),
    likedAt: datetime().default('time::now()'),
  },
  indexes: {
    unique: index(['in', 'out']).unique(),
  },
});
```

### Membership with roles

```javascript
const memberOfRelation = defineRelation({
  name: 'member_of',
  from: 'user',
  to: 'organization',
  fields: {
    role: string().default('member'),
    joinedAt: datetime().default('time::now()'),
    invitedBy: option(record('user')),
  },
  indexes: {
    unique: index(['in', 'out']).unique(),
    byRole: index(['out', 'role']),
  },
});
```

---

## Complete example

```javascript
import { defineRelation, defineSchema, composeSchema } from 'smig';

const userSchema = defineSchema({
  table: 'user',
  fields: {
    name: string().required(),
    followerCount: int().default(0),
    followingCount: int().default(0),
  },
});

const postSchema = defineSchema({
  table: 'post',
  fields: {
    author: record('user').required(),
    content: string().required(),
    likeCount: int().default(0),
  },
});

const followsRelation = defineRelation({
  name: 'follows',
  from: 'user',
  to: 'user',
  enforced: true,
  fields: {
    followedAt: datetime().default('time::now()'),
  },
  indexes: {
    unique: index(['in', 'out']).unique(),
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
    unique: index(['in', 'out']).unique(),
  },
  events: {
    incrementLikes: event('increment_likes')
      .onCreate()
      .when('$event = "CREATE"')
      .thenDo('UPDATE $after.out SET likeCount += 1'),
  },
});

export default composeSchema({
  models: { user: userSchema, post: postSchema },
  relations: { follows: followsRelation, likes: likesRelation },
});
```

---

## See also

- [Tables](tables.md) - Regular table definitions
- [Fields](fields.md) - Record references
- [Social network example](../examples/social-network.md)

