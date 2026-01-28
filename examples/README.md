# **smig** Schema Examples

This directory contains example schemas demonstrating various features and best practices of **smig**. Each example is tested and ready to use as a starting point for your own projects.

## Examples Overview

| Example | Description | Features |
|---------|-------------|----------|
| [Minimal](#minimal-example) | Simplest possible schema | Basic fields, validation |
| [Blog](#blog-example) | Users, posts, comments | Full-text search, events |
| [Social Network](#social-network-example) | Follows, posts, likes | Graph relations, counters |
| [E-commerce](#e-commerce-example) | Products, orders, inventory | Sequences, permissions, events |
| [AI Embeddings](#ai-embeddings-example) | Semantic search system | HNSW vectors, functions |
| [Social Platform](#social-platform-example) | Full-featured platform | Scopes, analyzers, computed fields |

---

## Minimal Example

**File:** `minimal-example.ts`

The simplest possible **smig** schema—perfect for understanding the basics.

**Features:**
- Single table definition
- Basic field types (`string`, `bool`)
- Field validation with assertions
- Common field patterns (`cf.timestamp()`)

**Run it:**
```zsh
bun smig generate --schema examples/minimal-example.ts
bun smig migrate --schema examples/minimal-example.ts
```

---

## Blog Example

**File:** `blog-example.ts`

A realistic blogging platform with users, posts, nested comments, and social interactions.

**Features:**
- Multiple table definitions with common field patterns (`cf`, `ci`)
- Email and length validation with stacked assertions
- Optional fields with `option()`
- Full-text search on post content
- Events for automation (`publishedAt` timestamp)
- Graph relations for likes and follows

**Tables:** `user`, `post`, `comment`
**Relations:** `like`, `follow`

**Run it:**
```zsh
bun smig generate --schema examples/blog-example.ts
bun smig migrate --schema examples/blog-example.ts
```

---

## Social Network Example

**File:** `social-network-schema.ts`

A social media platform with user follows, posts, and likes.

**Features:**
- Graph relations (`follows`, `likes`)
- Counter automation with events
- User profiles with follower/following counts
- Reply and repost tracking

**Tables:** `user`, `post`
**Relations:** `follows`, `likes`

**Run it:**
```zsh
bun smig generate --schema examples/social-network-schema.ts
bun smig migrate --schema examples/social-network-schema.ts
```

---

## E-commerce Example

**File:** `ecommerce-example.ts`

An online store with products, orders, and inventory management.

**Features:**
- Sequences for order numbers
- Inventory events (stock reduction, low stock alerts)
- Order completion events
- Row-level permissions
- Category hierarchies

**Tables:** `category`, `product`, `customer`, `order`
**Sequences:** `order_number`

**Run it:**
```zsh
bun smig generate --schema examples/ecommerce-example.ts
bun smig migrate --schema examples/ecommerce-example.ts
```

---

## AI Embeddings Example

**File:** `ai-embeddings-example.ts`

A semantic search system with vector embeddings for AI applications.

**Features:**
- HNSW vector indexes (1536 dimensions for OpenAI)
- Custom database functions for search
- Hybrid search (vector + keyword)
- Custom analyzers for technical content
- Document similarity caching

**Tables:** `document`, `search_history`, `document_similarity`
**Functions:** `fn::semantic_search`, `fn::hybrid_search`, `fn::find_similar`
**Analyzers:** `tech`

**Run it:**
```zsh
bun smig generate --schema examples/ai-embeddings-example.ts
bun smig migrate --schema examples/ai-embeddings-example.ts
```

---

## Social Platform Example

**File:** `social-platform-schema.ts`

A comprehensive social platform demonstrating advanced **smig** capabilities.

**Features:**
- Schemaless tables for flexibility
- Computed fields with expressions
- Union type records (polymorphic references)
- Topic-based content organization
- User roles and permissions

**Tables:** `user`, `topic`, `post`, `thread`, `comment`, `notification`

**Run it:**
```zsh
bun smig generate --schema examples/social-platform-schema.ts
bun smig migrate --schema examples/social-platform-schema.ts
```

---

## Key Features Demonstrated

### Field Types & Validation

```typescript
// Basic types
name: string().required(),
age: int().default(0),
isActive: bool().default(true),
createdAt: datetime().default('time::now()'),

// Validation with stacked assertions
email: string()
  .required()
  .assert('string::is_email($value)'),

username: string()
  .assert('string::len($value) >= 3')
  .assert('string::len($value) <= 30'),
```

### Indexes

```typescript
indexes: {
  // Unique index
  email: index(['email']).unique(),

  // Composite index
  authorDate: index(['author', 'createdAt']),

  // Full-text search (single column)
  contentSearch: index(['content']).search().analyzer('english'),

  // Vector index for AI
  semantic: index(['embedding']).hnsw().dimension(1536).dist('COSINE'),
}
```

### Events

```typescript
events: {
  // Automatic timestamp
  updateTimestamp: event('post_updated')
    .onUpdate()
    .then('UPDATE $after.id SET updatedAt = time::now()'),

  // Conditional trigger
  setPublishedAt: event('set_published')
    .onUpdate()
    .when('$before.published = false AND $after.published = true')
    .then('UPDATE $after.id SET publishedAt = time::now()'),
}
```

### Relations

```typescript
// User-to-user relation
const follows = defineRelation({
  name: 'follows',
  from: 'user',
  to: 'user',
  fields: {
    followedAt: datetime().default('time::now()'),
  },
});

// User-to-post relation
const likes = defineRelation({
  name: 'likes',
  from: 'user',
  to: 'post',
  fields: {
    likedAt: datetime().default('time::now()'),
  },
});
```

### Functions

```typescript
const searchFn = fn('fn::search')
  .param('query', 'string')
  .param('limit', 'option<int>')
  .returns('array')
  .body(`{
    LET $max = $limit ?? 10;
    RETURN SELECT * FROM document
    WHERE content @@ $query
    LIMIT $max;
  }`);
```

---

## Quick Start

1. Copy an example as your starting point:
```zsh
cp examples/blog-example.ts schema.ts
```

2. Run migrations:
```zsh
bun smig migrate
```

3. Customize for your needs!

---

## Best Practices

These examples showcase **smig** best practices:

1. **Singular table names** — `user`, `post`, not `users`, `posts`
2. **Always timestamp** — Include `createdAt` and optionally `updatedAt`
3. **Validate critical fields** — Emails, usernames, content length
4. **Index for performance** — Based on your actual query patterns
5. **Automate with events** — Counters, timestamps, audit trails
6. **Use common patterns** — Leverage `cf` and `ci` helpers

---

## Need Help?

- 📖 [Documentation](https://smig.build/)
- 💬 [GitHub Issues](https://github.com/kathysledge/smig/issues)
- 📦 [npm Package](https://www.npmjs.com/package/smig)

Happy schema building with **smig**! 🚀
