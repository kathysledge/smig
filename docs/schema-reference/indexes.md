# Indexes

Indexes make queries faster. They also let you enforce uniqueness, perform full-text search, and run similarity searches on vector embeddings.

## Why use indexes?

Indexes are data structures that help SurrealDB find records quickly. Without an index, the database must scan every record in a table to find matches. With an index, it can jump directly to the right records.

Common reasons to add an index:

- **Speed up queries** — Any field you filter or sort by frequently
- **Enforce uniqueness** — Emails, usernames, or any value that must be unique
- **Full-text search** — Searching through text content
- **Vector similarity** — Finding similar items by embedding (for AI/ML)

## Basic usage

The `index()` function creates an index builder. Pass it an array of field names to index, then add it to your schema's `indexes` object:

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

SurrealDB supports several index types, each optimised for different query patterns.

### BTREE (default)

The B-tree is the workhorse of database indexing. It's good for exact matches, range queries, and sorting:

```typescript
// Speeds up: WHERE email = 'x'
emailIndex: index(['email'])

// Composite index: WHERE author = x AND createdAt > y
authorDate: index(['author', 'createdAt'])
```

### UNIQUE

A unique index prevents duplicate values. Attempting to insert a duplicate will fail:

```typescript
email: index(['email']).unique()
username: index(['username']).unique()

// Composite unique: pair must be unique
userRole: index(['userId', 'roleId']).unique()
```

### HASH

Hash indexes are faster than B-trees for exact equality lookups, but they can't handle range queries or sorting:

```typescript
apiKey: index(['apiKey']).hash()
```

Use when you only ever query with `=`, never `<`, `>`, or `BETWEEN`.

## Full-text search

Full-text search indexes let you search for words and phrases within text content. They support stemming (matching "running" to "run"), stopword removal, and relevance scoring:

```typescript
// Basic full-text search
content: index(['title', 'body']).search()

// With a specific analyzer
content: index(['title', 'body']).search('english')

// With highlights (for showing matched terms)
content: index(['title', 'body']).search('english').highlights()
```

### BM25 scoring

BM25 is the algorithm that ranks search results by relevance. You can tune its parameters to adjust how much weight is given to term frequency and document length:

```typescript
content: index(['title', 'body'])
  .search('english')
  .bm25(1.2, 0.75)  // k1, b parameters
```

### Caching options

For better search performance on large datasets, configure how much index data to keep in memory:

```typescript
content: index(['title', 'body'])
  .search('english')
  .docIdsCache(1000000)
  .docLengthsCache(1000000)
  .postingsCache(1000000)
  .termsCache(1000000)
```

## Vector indexes (AI/ML)

Vector indexes enable similarity search on embeddings—numerical representations of text, images, or other data. This is the foundation of semantic search and recommendation systems.

SurrealDB supports two vector index algorithms:

### HNSW (recommended for most cases)

HNSW (Hierarchical Navigable Small World) is the go-to algorithm for high-dimensional embeddings like those from OpenAI or Cohere:

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

M-Tree works better for lower-dimensional vectors (under 100 dimensions) and can provide exact results rather than approximate ones:

```typescript
// 3D coordinates
location: index(['coordinates'])
  .mtree(3)
  .dist('EUCLIDEAN')
  .capacity(40)
```

### Distance metrics

The distance metric determines how similarity is calculated. Choose based on your embedding type:

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

A common pattern is combining vector search (for semantic similarity) with full-text search (for keyword matching). Here's how:

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

A composite index covers multiple fields and can speed up queries that filter or sort by those fields in combination:

```typescript
// For queries: WHERE author = x AND createdAt > y
authorDate: index(['author', 'createdAt'])

// For queries: WHERE category = x AND isPublished = true ORDER BY createdAt
categoryPublished: index(['category', 'isPublished', 'createdAt'])
```

The field order matters. Put the most selective field first.

## Index modifiers

These options control how indexes are created and documented.

### Concurrent creation

By default, creating an index locks the table. For large tables, use concurrent creation to avoid blocking writes:

```typescript
email: index(['email']).unique().concurrently()
```

### If not exists

Avoid errors when re-running migrations on an existing database:

```typescript
email: index(['email']).ifNotExists()
```

### Comments

Explain why an index exists—this helps future developers understand its purpose:

```typescript
email: index(['email'])
  .unique()
  .comment('Ensures unique email addresses')
```

## Rename tracking

Tell **smig** about previous index names so it generates a rename instead of drop-and-create:

```typescript
// Previously named 'emailIndex'
userEmail: index(['email']).unique().was('emailIndex')
```

This generates:

```surql
ALTER INDEX emailIndex ON TABLE user RENAME TO userEmail;
```

## What to index

Indexing is about trade-offs. Here's a quick guide to help you decide.

### Do index

- Fields used in `WHERE` clauses
- Fields used in `ORDER BY`
- Fields used in `GROUP BY`
- Unique constraints (emails, usernames)
- Foreign keys you query frequently

### Don’t index

- Fields rarely queried
- Fields with very few distinct values (e.g., boolean flags on large tables)
- Large text fields (use full-text search instead)

### Trade-offs

Every index you create has costs: more storage, slower writes, and maintenance overhead. Only add indexes that directly support your query patterns.

## Complete example

Here's a post table demonstrating multiple index types working together—unique constraints, query optimisation, full-text search, and vector similarity:

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
