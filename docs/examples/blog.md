# Simple blog

A complete blogging application with users, posts, nested comments, and social interactions like likes and follows.

## What you'll learn

This example demonstrates several key **smig** concepts:

- Defining multiple related tables
- Field validation with stacked assertions
- Full-text search indexes
- Events for automating timestamps
- Graph relations for social interactions
- Common field patterns (`cf`, `ci`)

## Complete schema

The blog schema includes three tables (users, posts, comments) and two graph relations (likes, follows). Each section is annotated to explain the patterns used.

<<< @/../examples/blog-example.ts

## Schema breakdown

### User table

The user table stores author information with email validation. The `cf.timestamp()` helper automatically creates a `createdAt` field with a default of `time::now()`.

<<< @/../examples/blog-example.ts#user

### Post table

Posts are linked to users via a `record<user>` reference. The full-text search index on `content` enables queries like `WHERE content @@ "search terms"`.

<<< @/../examples/blog-example.ts#post

### Comment table

Comments support threading via the optional `parent` field—a self-referencing `record<comment>`. This allows nested comment structures without a separate table.

<<< @/../examples/blog-example.ts#comment

### Relations

Graph relations enable many-to-many relationships with metadata. The `like` relation tracks when users liked posts, and the `follow` relation tracks user-to-user follows with notification preferences.

<<< @/../examples/blog-example.ts#relations

## Generated SurrealQL

Running `bun smig migrate` generates this SurrealQL (SQL):

```surql
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
DEFINE INDEX contentSearch ON TABLE post FIELDS content SEARCH ANALYZER english;
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

-- Like relation (graph edge)
DEFINE TABLE like TYPE RELATION FROM user TO post SCHEMAFULL ENFORCED;
DEFINE FIELD likedAt ON TABLE like TYPE datetime DEFAULT time::now();
DEFINE INDEX unique ON TABLE like FIELDS in, out UNIQUE;

-- Follow relation (graph edge)
DEFINE TABLE follow TYPE RELATION FROM user TO user SCHEMAFULL ENFORCED;
DEFINE FIELD followedAt ON TABLE follow TYPE datetime DEFAULT time::now();
DEFINE FIELD notifications ON TABLE follow TYPE bool DEFAULT true;
```

## Example queries

These queries show how to work with the blog schema in SurrealQL.

### Create a user

Register a new author:

```surql
CREATE user SET
  email = "author@example.com",
  name = "Jane Doe",
  bio = "Tech blogger and coffee enthusiast";
```

### Create and publish a post

Create a draft and then publish it (triggers the `publishedAt` event):

```surql
CREATE post SET
  author = user:author,
  title = "Getting Started with SurrealDB",
  slug = "getting-started-surrealdb",
  content = "SurrealDB is a multi-model database...",
  tags = ["surrealdb", "database", "tutorial"];

-- Publish (triggers the event to set publishedAt)
UPDATE post:abc123 SET published = true;
```

### Like a post

Create a graph edge between user and post:

```surql
RELATE user:jane->like->post:abc123 SET likedAt = time::now();
```

### Follow a user

Create a follow relationship:

```surql
RELATE user:jane->follow->user:john SET notifications = true;
```

### Search posts

Use full-text search on content:

```surql
SELECT * FROM post
WHERE content @@ "SurrealDB database"
ORDER BY search::score(1) DESC
LIMIT 10;
```

### Get post with comments

Fetch a post with all its comments in one query:

```surql
SELECT
  *,
  (SELECT * FROM comment WHERE post = $parent.id ORDER BY createdAt) AS comments
FROM post
WHERE slug = "getting-started-surrealdb";
```

### Threaded comments

Get top-level comments with their nested replies:

```surql
-- Get top-level comments with replies
SELECT
  *,
  (SELECT * FROM comment WHERE parent = $parent.id ORDER BY createdAt) AS replies
FROM comment
WHERE post = post:abc123 AND parent = NONE
ORDER BY createdAt;
```

### Get user's feed

Get posts from users someone follows:

```surql
SELECT * FROM post
WHERE author IN (SELECT out FROM follow WHERE in = user:jane)
AND published = true
ORDER BY publishedAt DESC
LIMIT 20;
```

## See also

- [Social network](social-network.md) — More complex graph relationships
- [Schema design](../guides/schema-design.md) — Best practices
