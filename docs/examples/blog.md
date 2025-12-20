# Simple blog

A basic blog application with users, posts, and comments.

---

## Schema

```javascript
import {
  defineSchema,
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
    email: string().required().assert('string::is_email($value)'),
    name: string().required().length(2, 100),
    bio: option('string'),
    isActive: bool().default(true),
    createdAt: datetime().default('time::now()'),
  },
  indexes: {
    email: index(['email']).unique(),
    active: index(['isActive']),
  },
});

// Posts
const postSchema = defineSchema({
  table: 'post',
  fields: {
    author: record('user').required(),
    title: string().required().length(1, 200),
    slug: string().required(),
    content: string().required(),
    excerpt: option('string'),
    tags: array('string').default([]),
    published: bool().default(false),
    publishedAt: option('datetime'),
    viewCount: int().default(0),
    createdAt: datetime().default('time::now()'),
    updatedAt: datetime().value('time::now()'),
  },
  indexes: {
    slug: index(['slug']).unique(),
    author: index(['author', 'createdAt']),
    published: index(['published', 'publishedAt']),
    tags: index(['tags']),
    search: index(['title', 'content']).fulltext().analyzer('english'),
  },
  events: {
    setPublishedAt: event('set_published_at')
      .onUpdate()
      .when('$before.published = false AND $after.published = true')
      .thenDo('UPDATE $after.id SET publishedAt = time::now()'),
  },
});

// Comments
const commentSchema = defineSchema({
  table: 'comment',
  fields: {
    post: record('post').required(),
    author: record('user').required(),
    parent: option(record('comment')),  // For nested comments
    content: string().required().length(1, 5000),
    createdAt: datetime().default('time::now()'),
    updatedAt: datetime().value('time::now()'),
  },
  indexes: {
    post: index(['post', 'createdAt']),
    author: index(['author', 'createdAt']),
    parent: index(['parent']),
  },
});

export default composeSchema({
  models: {
    user: userSchema,
    post: postSchema,
    comment: commentSchema,
  },
});
```

---

## Generated SurrealQL

```sql
-- Users
DEFINE TABLE user TYPE NORMAL SCHEMAFULL;
DEFINE FIELD email ON TABLE user TYPE string 
  ASSERT ($value != NONE) AND (string::is_email($value));
DEFINE FIELD name ON TABLE user TYPE string 
  ASSERT ($value != NONE) AND (string::len($value) >= 2) AND (string::len($value) <= 100);
DEFINE FIELD bio ON TABLE user TYPE option<string>;
DEFINE FIELD isActive ON TABLE user TYPE bool DEFAULT true;
DEFINE FIELD createdAt ON TABLE user TYPE datetime DEFAULT time::now();
DEFINE INDEX email ON TABLE user FIELDS email UNIQUE;
DEFINE INDEX active ON TABLE user FIELDS isActive;

-- Posts
DEFINE TABLE post TYPE NORMAL SCHEMAFULL;
DEFINE FIELD author ON TABLE post TYPE record<user> ASSERT $value != NONE;
DEFINE FIELD title ON TABLE post TYPE string 
  ASSERT ($value != NONE) AND (string::len($value) >= 1) AND (string::len($value) <= 200);
DEFINE FIELD slug ON TABLE post TYPE string ASSERT $value != NONE;
DEFINE FIELD content ON TABLE post TYPE string ASSERT $value != NONE;
DEFINE FIELD excerpt ON TABLE post TYPE option<string>;
DEFINE FIELD tags ON TABLE post TYPE array<string> DEFAULT [];
DEFINE FIELD published ON TABLE post TYPE bool DEFAULT false;
DEFINE FIELD publishedAt ON TABLE post TYPE option<datetime>;
DEFINE FIELD viewCount ON TABLE post TYPE int DEFAULT 0;
DEFINE FIELD createdAt ON TABLE post TYPE datetime DEFAULT time::now();
DEFINE FIELD updatedAt ON TABLE post TYPE datetime VALUE time::now();
DEFINE INDEX slug ON TABLE post FIELDS slug UNIQUE;
DEFINE INDEX author ON TABLE post FIELDS author, createdAt;
DEFINE INDEX published ON TABLE post FIELDS published, publishedAt;
DEFINE INDEX tags ON TABLE post FIELDS tags;
DEFINE INDEX search ON TABLE post FIELDS title, content FULLTEXT ANALYZER english;
DEFINE EVENT set_published_at ON TABLE post 
  WHEN $before.published = false AND $after.published = true 
  THEN UPDATE $after.id SET publishedAt = time::now();

-- Comments
DEFINE TABLE comment TYPE NORMAL SCHEMAFULL;
DEFINE FIELD post ON TABLE comment TYPE record<post> ASSERT $value != NONE;
DEFINE FIELD author ON TABLE comment TYPE record<user> ASSERT $value != NONE;
DEFINE FIELD parent ON TABLE comment TYPE option<record<comment>>;
DEFINE FIELD content ON TABLE comment TYPE string 
  ASSERT ($value != NONE) AND (string::len($value) >= 1) AND (string::len($value) <= 5000);
DEFINE FIELD createdAt ON TABLE comment TYPE datetime DEFAULT time::now();
DEFINE FIELD updatedAt ON TABLE comment TYPE datetime VALUE time::now();
DEFINE INDEX post ON TABLE comment FIELDS post, createdAt;
DEFINE INDEX author ON TABLE comment FIELDS author, createdAt;
DEFINE INDEX parent ON TABLE comment FIELDS parent;
```

---

## Example queries

### Create a user

```sql
CREATE user SET
  email = "author@example.com",
  name = "Jane Doe",
  bio = "Tech blogger and coffee enthusiast";
```

### Create and publish a post

```sql
CREATE post SET
  author = user:author,
  title = "Getting Started with SurrealDB",
  slug = "getting-started-surrealdb",
  content = "SurrealDB is a multi-model database...",
  tags = ["surrealdb", "database", "tutorial"];

-- Publish (triggers the event to set publishedAt)
UPDATE post:abc123 SET published = true;
```

### Search posts

```sql
SELECT * FROM post
WHERE content @@ "SurrealDB database"
ORDER BY search::score(1) DESC
LIMIT 10;
```

### Get post with comments

```sql
SELECT 
  *,
  (SELECT * FROM comment WHERE post = $parent.id ORDER BY createdAt) AS comments
FROM post
WHERE slug = "getting-started-surrealdb";
```

### Threaded comments

```sql
-- Get top-level comments with replies
SELECT 
  *,
  (SELECT * FROM comment WHERE parent = $parent.id ORDER BY createdAt) AS replies
FROM comment
WHERE post = post:abc123 AND parent = NONE
ORDER BY createdAt;
```

---

## See also

- [Social network](social-network.md) - Graph relationships
- [Schema design](../guides/schema-design.md) - Best practices

