# Social network

A social platform with follows, posts, and likes using graph relations.

## Schema

A social platform with users, posts, follows, and likes using SurrealDB’s graph relations:

```typescript
import {
  defineSchema,
  defineRelation,
  composeSchema,
  string,
  int,
  bool,
  datetime,
  array,
  record,
  option,
  index,
  event,
} from 'smig';

// Users
const userSchema = defineSchema({
  table: 'user',
  fields: {
    username: string()
      .required()
      .assert('string::len($value) >= 3')
      .assert('string::len($value) <= 30'),
    email: string().required().assert('string::is_email($value)'),
    displayName: string().required(),
    bio: option('string'),
    avatar: option('string'),
    isVerified: bool().default(false),
    followerCount: int().default(0),
    followingCount: int().default(0),
    postCount: int().default(0),
    createdAt: datetime().default('time::now()'),
    updatedAt: datetime().value('time::now()'),
  },
  indexes: {
    username: index(['username']).unique(),
    email: index(['email']).unique(),
  },
});

// Posts
const postSchema = defineSchema({
  table: 'post',
  fields: {
    author: record('user').required(),
    content: string()
      .required()
      .assert('string::len($value) >= 1')
      .assert('string::len($value) <= 280'),
    media: array('string').default([]),
    replyTo: option('record<post>'),
    repostOf: option('record<post>'),
    likeCount: int().default(0),
    repostCount: int().default(0),
    replyCount: int().default(0),
    createdAt: datetime().default('time::now()'),
  },
  indexes: {
    author: index(['author', 'createdAt']),
    replyTo: index(['replyTo']),
    timeline: index(['createdAt']),
  },
  events: {
    incrementPostCount: event('increment_post_count')
      .onCreate()
      .when('$event = "CREATE" AND $after.replyTo = NONE AND $after.repostOf = NONE')
      .thenDo('UPDATE $after.author SET postCount += 1'),

    incrementReplyCount: event('increment_reply_count')
      .onCreate()
      .when('$event = "CREATE" AND $after.replyTo != NONE')
      .thenDo('UPDATE $after.replyTo SET replyCount += 1'),

    incrementRepostCount: event('increment_repost_count')
      .onCreate()
      .when('$event = "CREATE" AND $after.repostOf != NONE')
      .thenDo('UPDATE $after.repostOf SET repostCount += 1'),
  },
});

// Follow relation
const followsRelation = defineRelation({
  name: 'follows',
  from: 'user',
  to: 'user',
  fields: {
    followedAt: datetime().default('time::now()'),
    notifications: bool().default(true),
  },
});

// Like relation
const likesRelation = defineRelation({
  name: 'likes',
  from: 'user',
  to: 'post',
  fields: {
    likedAt: datetime().default('time::now()'),
  },
});

export default composeSchema({
  models: {
    user: userSchema,
    post: postSchema,
  },
  relations: {
    follows: followsRelation,
    likes: likesRelation,
  },
});
```

## Graph queries

### Follow a user

Create a follow relationship between two users:

```surql
RELATE user:alice -> follows -> user:bob;
```

### Unfollow

Remove a follow relationship:

```surql
DELETE follows WHERE in = user:alice AND out = user:bob;
```

### Get followers

Get all users who follow a specific user:

```surql
SELECT * FROM user:bob <- follows <- user;
```

### Get following

Get all users that a user follows:

```surql
SELECT * FROM user:alice -> follows -> user;
```

### Check if following

Check if one user follows another:

```surql
SELECT * FROM follows
WHERE in = user:alice AND out = user:bob;
```

### Like a post

Create a like relationship:

```surql
RELATE user:alice -> likes -> post:123;
```

### Unlike

Remove a like:

```surql
DELETE likes WHERE in = user:alice AND out = post:123;
```

### Get user's liked posts

Get all posts a user has liked:

```surql
SELECT * FROM user:alice -> likes -> post
ORDER BY likedAt DESC
LIMIT 20;
```

### Timeline (posts from followed users)

Build a chronological feed of posts from people a user follows:

```surql
SELECT * FROM post
WHERE author IN (SELECT VALUE out FROM follows WHERE in = user:alice)
ORDER BY createdAt DESC
LIMIT 50;
```

### Mutual follows (friends)

Find users who both follow each other:

```surql
LET $following = (SELECT VALUE out FROM follows WHERE in = user:alice);
LET $followers = (SELECT VALUE in FROM follows WHERE out = user:alice);
RETURN array::intersect($following, $followers);
```

### Friends of friends

Discover new people through your network:

```surql
SELECT DISTINCT out FROM user:alice -> follows -> user -> follows -> user
WHERE out != user:alice
AND out NOT IN (SELECT VALUE out FROM follows WHERE in = user:alice);
```

## See also

- [Relations reference](../schema-reference/relations.md) - Relation options
- [Events reference](../schema-reference/events.md) - Event triggers
- [AI embeddings](ai-embeddings.md) - Recommendation feeds
