# Social network

A social platform with follows, posts, and likes using graph relations.

---

## Schema

```javascript
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
    username: string().required().length(3, 30),
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
    content: string().required().length(1, 280),
    media: array('string').default([]),
    replyTo: option(record('post')),
    repostOf: option(record('post')),
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
});

// Follow relation
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
    byFollower: index(['in', 'followedAt']),
    byFollowed: index(['out', 'followedAt']),
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

// Like relation
const likesRelation = defineRelation({
  name: 'likes',
  from: 'user',
  to: 'post',
  enforced: true,
  fields: {
    likedAt: datetime().default('time::now()'),
  },
  indexes: {
    unique: index(['in', 'out']).unique(),
    byUser: index(['in', 'likedAt']),
    byPost: index(['out', 'likedAt']),
  },
  events: {
    incrementLikes: event('increment_likes')
      .onCreate()
      .when('$event = "CREATE"')
      .thenDo('UPDATE $after.out SET likeCount += 1'),
    decrementLikes: event('decrement_likes')
      .onDelete()
      .when('$event = "DELETE"')
      .thenDo('UPDATE $before.out SET likeCount -= 1'),
  },
});

// Post events
const postEvents = {
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
};

// Add events to post
postSchema.events = postEvents;

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

---

## Graph queries

### Follow a user

```sql
RELATE user:alice -> follows -> user:bob;
```

### Unfollow

```sql
DELETE follows WHERE in = user:alice AND out = user:bob;
```

### Get followers

```sql
SELECT * FROM user:bob <- follows <- user;
```

### Get following

```sql
SELECT * FROM user:alice -> follows -> user;
```

### Check if following

```sql
SELECT * FROM follows 
WHERE in = user:alice AND out = user:bob;
```

### Like a post

```sql
RELATE user:alice -> likes -> post:123;
```

### Unlike

```sql
DELETE likes WHERE in = user:alice AND out = post:123;
```

### Get user's liked posts

```sql
SELECT * FROM user:alice -> likes -> post
ORDER BY likedAt DESC
LIMIT 20;
```

### Timeline (posts from followed users)

```sql
SELECT * FROM post 
WHERE author IN (SELECT VALUE out FROM follows WHERE in = user:alice)
ORDER BY createdAt DESC
LIMIT 50;
```

### Mutual follows (friends)

```sql
LET $following = (SELECT VALUE out FROM follows WHERE in = user:alice);
LET $followers = (SELECT VALUE in FROM follows WHERE out = user:alice);
RETURN array::intersect($following, $followers);
```

### Friends of friends

```sql
SELECT DISTINCT out FROM user:alice -> follows -> user -> follows -> user
WHERE out != user:alice 
AND out NOT IN (SELECT VALUE out FROM follows WHERE in = user:alice);
```

---

## See also

- [Relations reference](../schema-reference/relations.md) - Relation options
- [Events reference](../schema-reference/events.md) - Event triggers
- [AI embeddings](ai-embeddings.md) - Recommendation feeds

