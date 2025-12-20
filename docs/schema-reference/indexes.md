# Indexes

Indexes make queries faster. They also let you enforce uniqueness, perform full-text search, and run similarity searches on vector embeddings.

## Why use indexes?

Without an index, finding a user by email requires scanning every record in the table. With an index, the database can jump directly to the right record.

Common reasons to add an index:

- **Speed up queries** — Any field you filter or sort by frequently
- **Enforce uniqueness** — Emails, usernames, or any value that must be unique
- **Full-text search** — Searching through text content
- **Vector similarity** — Finding similar items by embedding (for AI/ML)

## Basic usage

Create an index with the `index()` function and add it to your schema:

```typescript
import { defineSchema, string, index } from 'smig';

const users = defineSchema({
  table: 'user',
  fields: {
    email: string().required(),
    name: string(),
  },
  indexes: {
    email: index(['email']).unique(),
  },
});
```

This creates:

```surql
DEFINE INDEX email ON TABLE user FIELDS email UNIQUE;
```

## Index types

### BTREE (default)

The standard index type. Good for exact matches and range queries.

```typescript
// Speeds up: WHERE email = 'x'
emailIndex: index(['email'])

// Composite index: WHERE author = x AND createdAt > y
authorDate: index(['author', 'createdAt'])
```

### UNIQUE

Ensures no two records have the same value:

```typescript
email: index(['email']).unique()
username: index(['username']).unique()

// Composite unique: pair must be unique
userRole: index(['userId', 'roleId']).unique()
```

### HASH

Fast for exact matches, but can't do range queries:

```typescript
apiKey: index(['apiKey']).hash()
```

Use when you only ever query with `=`, never `<`, `>`, or `BETWEEN`.

## Full-text search

The SEARCH index type enables full-text searching:

```typescript
// Basic full-text search
content: index(['title', 'body']).search()

// With a specific analyzer
content: index(['title', 'body']).search('english')

// With highlights (for showing matched terms)
content: index(['title', 'body']).search('english').highlights()
```

### BM25 scoring

Fine-tune relevance ranking:

```typescript
content: index(['title', 'body'])
  .search('english')
  .bm25(1.2, 0.75)  // k1, b parameters
```

### Caching options

For large datasets, configure caching:

```typescript
content: index(['title', 'body'])
  .search('english')
  .docIdsCache(1000000)
  .docLengthsCache(1000000)
  .postingsCache(1000000)
  .termsCache(1000000)
```

## Vector indexes (AI/ML)

SurrealDB 3 supports vector similarity search with two algorithms:

### HNSW (recommended for most cases)

HNSW (Hierarchical Navigable Small World) is efficient for high-dimensional vectors:

```typescript
// OpenAI ada-002 embeddings (1536 dimensions)
embedding: index(['embedding'])
  .hnsw(1536)
  .dist('COSINE')

// With tuning parameters
embedding: index(['embedding'])
  .hnsw(1536)
  .dist('COSINE')
  .efc(200)    // efConstruction: build quality vs speed
  .m(16)      // max connections per node
```

### MTREE

M-Tree is better for lower-dimensional data or when you need exact results:

```typescript
// 3D coordinates
location: index(['coordinates'])
  .mtree(3)
  .dist('EUCLIDEAN')
  .capacity(40)
```

### Distance metrics

| Metric | Use case |
|--------|----------|
| `'COSINE'` | Text embeddings, normalized vectors |
| `'EUCLIDEAN'` | Spatial data, general purpose |
| `'MANHATTAN'` | Grid-based distances |
| `'CHEBYSHEV'` | Maximum coordinate difference |
| `'HAMMING'` | Binary vectors |
| `'JACCARD'` | Set similarity |
| `'PEARSON'` | Correlation |
| `'MINKOWSKI'` | Generalized distance |

### Complete vector search example

Here's a document table with both vector and full-text search:

```typescript
import { defineSchema, string, array, index } from 'smig';

const documents = defineSchema({
  table: 'document',
  fields: {
    title: string().required(),
    content: string(),
    embedding: array('float').comment('1536-dim OpenAI embedding'),
  },
  indexes: {
    // Vector similarity search
    semantic: index(['embedding'])
      .hnsw(1536)
      .dist('COSINE')
      .efc(200)
      .m(16)
      .comment('Semantic search index'),
    
    // Also add full-text for keyword search
    fulltext: index(['title', 'content'])
      .search('english')
      .highlights(),
  },
});
```

Query with:

```surql
SELECT * FROM document
WHERE embedding <|10,100|> $query_embedding
ORDER BY embedding <|10,100|> $query_embedding;
```

## Composite indexes

Index multiple fields together:

```typescript
// For queries: WHERE author = x AND createdAt > y
authorDate: index(['author', 'createdAt'])

// For queries: WHERE category = x AND isPublished = true ORDER BY createdAt
categoryPublished: index(['category', 'isPublished', 'createdAt'])
```

The field order matters. Put the most selective field first.

## Index modifiers

### Concurrent creation

Build the index without blocking writes:

```typescript
email: index(['email']).unique().concurrently()
```

### If not exists

Only create if the index doesn't already exist:

```typescript
email: index(['email']).ifNotExists()
```

### Comments

Document the index purpose:

```typescript
email: index(['email'])
  .unique()
  .comment('Ensures unique email addresses')
```

## Rename tracking

When renaming an index, use `.was()`:

```typescript
// Previously named 'emailIndex'
userEmail: index(['email']).unique().was('emailIndex')
```

This generates:

```surql
ALTER INDEX emailIndex ON TABLE user RENAME TO userEmail;
```

## What to index

### Do index

- Fields used in `WHERE` clauses
- Fields used in `ORDER BY`
- Fields used in `GROUP BY`
- Unique constraints (emails, usernames)
- Foreign keys you query frequently

### Don't index

- Fields rarely queried
- Fields with very few distinct values (e.g., boolean flags on large tables)
- Large text fields (use full-text search instead)

### Trade-offs

Indexes speed up reads but slow down writes (the index must be updated). Don't add indexes you don't need.

## Complete example

A post table with unique constraints, query optimization, and search indexes:

```typescript
import { defineSchema, string, int, bool, datetime, array, index } from 'smig';

const posts = defineSchema({
  table: 'post',
  fields: {
    title: string().required(),
    slug: string().required(),
    content: string(),
    author: record('user').required(),
    tags: array('string'),
    isPublished: bool().default(false),
    viewCount: int().default(0),
    embedding: array('float'),
    createdAt: datetime().default('time::now()'),
  },
  indexes: {
    // Unique constraint
    slug: index(['slug']).unique(),
    
    // Query optimization
    author: index(['author']),
    publishedDate: index(['isPublished', 'createdAt']),
    
    // Full-text search
    content: index(['title', 'content'])
      .search('english')
      .highlights(),
    
    // Vector similarity
    semantic: index(['embedding'])
      .hnsw(1536)
      .dist('COSINE'),
    
    // Tags (if you query by tag)
    tags: index(['tags']),
  },
});
```

## Related

- [Fields](/schema-reference/fields) — The data being indexed
- [Analyzers](/schema-reference/analyzers) — Configure full-text search
- [AI embeddings example](/examples/ai-embeddings) — Complete vector search setup
