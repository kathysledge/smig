# Social network

A social platform with follows, posts, likes, and notifications using SurrealDB's graph relations. This example demonstrates how to model social interactions between users.

## What you'll learn

This example demonstrates several key **smig** concepts:

- Graph relations for user-to-user and user-to-content connections
- Counter fields for follower/following/like counts
- Composite indexes for efficient timeline queries
- Common field patterns with `cf` helpers
- Notification systems

## Complete schema

The social network schema includes four tables (users, posts, comments, notifications) and two graph relations (follows, likes). Each user has counters for followers, following, and posts.

<<< @/../examples/social-network-schema.ts

## Graph queries

Graph relations enable powerful traversal queries in SurrealQL. Here are common patterns for social features.

### Follow a user

Create a follow relationship between two users:

```surql
RELATE user:alice -> follow -> user:bob;
```

### Unfollow

Remove a follow relationship:

```surql
DELETE follow WHERE in = user:alice AND out = user:bob;
```

### Get followers

Get all users who follow a specific user:

```surql
SELECT * FROM user:bob <- follow <- user;
```

### Get following

Get all users that a user follows:

```surql
SELECT * FROM user:alice -> follow -> user;
```

### Check if following

Check if one user follows another:

```surql
SELECT * FROM follow
WHERE in = user:alice AND out = user:bob;
```

### Like a post

Create a like relationship:

```surql
RELATE user:alice -> like -> post:123;
```

### Unlike

Remove a like:

```surql
DELETE like WHERE in = user:alice AND out = post:123;
```

### Get user's liked posts

Get all posts a user has liked:

```surql
SELECT * FROM user:alice -> like -> post
ORDER BY createdAt DESC
LIMIT 20;
```

### Timeline (posts from followed users)

Build a chronological feed of posts from people a user follows:

```surql
SELECT * FROM post
WHERE author IN (SELECT VALUE out FROM follow WHERE in = user:alice)
ORDER BY createdAt DESC
LIMIT 50;
```

### Mutual follows (friends)

Find users who both follow each other:

```surql
LET $following = (SELECT VALUE out FROM follow WHERE in = user:alice);
LET $followers = (SELECT VALUE in FROM follow WHERE out = user:alice);
RETURN array::intersect($following, $followers);
```

### Friends of friends

Discover new people through your network:

```surql
SELECT DISTINCT out FROM user:alice -> follow -> user -> follow -> user
WHERE out != user:alice
AND out NOT IN (SELECT VALUE out FROM follow WHERE in = user:alice);
```

## See also

- [Relations reference](../schema-reference/relations.md) — Relation options
- [Events reference](../schema-reference/events.md) — Event triggers
- [AI embeddings](ai-embeddings.md) — Recommendation feeds
