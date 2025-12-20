# Indexes

Define indexes for query optimization and constraints.

---

## Index types

| Type | Use case | Builder |
|------|----------|---------|
| Standard | Basic lookups and sorting | `index([...])` |
| Unique | Enforce uniqueness | `index([...]).unique()` |
| HNSW | Vector similarity search | `index([...]).hnsw()` |
| Fulltext | Text search with ranking | `index([...]).fulltext()` |
| Count | Aggregation optimization | `index([...]).count()` |

---

## Basic usage

```javascript
import { index } from 'smig';

const indexes = {
  // Simple index
  email: index(['email']),
  
  // Unique constraint
  username: index(['username']).unique(),
  
  // Composite index
  byUserDate: index(['userId', 'createdAt']),
};
```

**Generated SurrealQL:**

```sql
DEFINE INDEX email ON TABLE user FIELDS email;
DEFINE INDEX username ON TABLE user FIELDS username UNIQUE;
DEFINE INDEX byUserDate ON TABLE user FIELDS userId, createdAt;
```

---

## Unique indexes

Enforce that values are unique across all records:

```javascript
indexes: {
  email: index(['email']).unique(),
  
  // Composite unique (unique combination)
  userPost: index(['userId', 'postId']).unique(),
}
```

---

## HNSW vector indexes

For AI/ML applications with embedding vectors:

```javascript
indexes: {
  embedding: index(['embedding'])
    .hnsw()
    .dimension(384)
    .dist('cosine'),
}
```

**Generated SurrealQL:**

```sql
DEFINE INDEX embedding ON TABLE post FIELDS embedding 
  HNSW DIMENSION 384 DIST COSINE;
```

### HNSW options

| Option | Description | Default |
|--------|-------------|---------|
| `.dimension(n)` | Vector dimensions (required) | - |
| `.dist(metric)` | Distance metric | `'euclidean'` |
| `.type(vectorType)` | Element type | `'f32'` |
| `.m(n)` | Max connections per node | `12` |
| `.m0(n)` | Max connections at layer 0 | `24` |
| `.efConstruction(n)` | Build-time candidate list size | `100` |
| `.lm(n)` | Level multiplier | `0.3` |
| `.extendCandidates()` | Enable extended candidates | `false` |
| `.keepPrunedConnections()` | Keep pruned connections | `false` |

### Distance metrics

| Metric | Use case |
|--------|----------|
| `'euclidean'` | Default, L2 distance |
| `'cosine'` | Text embeddings, normalized vectors |
| `'manhattan'` | L1 distance |
| `'chebyshev'` | L∞ distance |
| `'hamming'` | Binary vectors |
| `'jaccard'` | Set similarity |
| `'pearson'` | Correlation-based |
| `'minkowski'` | Generalized (requires order) |

### Vector types

| Type | Description |
|------|-------------|
| `'f64'` | 64-bit float |
| `'f32'` | 32-bit float (default) |
| `'i64'` | 64-bit integer |
| `'i32'` | 32-bit integer |
| `'i16'` | 16-bit integer |

### Complete HNSW example

```javascript
indexes: {
  embedding: index(['embedding'])
    .hnsw()
    .dimension(1536)        // OpenAI embedding size
    .dist('cosine')
    .type('f32')
    .m(16)
    .m0(32)
    .efConstruction(200)
    .extendCandidates()
    .keepPrunedConnections(),
}
```

---

## Full-text search indexes

For text search with relevance ranking:

```javascript
indexes: {
  content: index(['title', 'body'])
    .fulltext()
    .analyzer('english')
    .highlights(),
}
```

**Generated SurrealQL:**

```sql
DEFINE INDEX content ON TABLE post FIELDS title, body 
  FULLTEXT ANALYZER english BM25(1.2, 0.75) HIGHLIGHTS;
```

### Fulltext options

| Option | Description | Default |
|--------|-------------|---------|
| `.analyzer(name)` | Text analyzer to use | `'default'` |
| `.bm25(k1, b)` | BM25 ranking parameters | `(1.2, 0.75)` |
| `.vs()` | Use vector scoring instead | - |
| `.highlights()` | Enable result highlighting | `false` |

### BM25 parameters

- **k1** (default 1.2): Term frequency saturation
- **b** (default 0.75): Length normalization

```javascript
// Favor exact matches
index(['content']).fulltext().bm25(1.5, 0.5)

// Favor longer documents
index(['content']).fulltext().bm25(1.2, 0.25)
```

---

## Count indexes

Optimize aggregation queries:

```javascript
indexes: {
  byStatus: index(['status']).count(),
  
  // With condition
  activeUsers: index(['role']).count().where('isActive = true'),
}
```

---

## Concurrent index creation

Build indexes without blocking writes:

```javascript
indexes: {
  email: index(['email']).unique().concurrently(),
}
```

---

## Complete example

```javascript
const postSchema = defineSchema({
  table: 'post',
  fields: {
    author: record('user').required(),
    title: string().required(),
    content: string().required(),
    embedding: array('float'),
    status: string().default('draft'),
    createdAt: datetime().default('time::now()'),
  },
  indexes: {
    // Unique constraint
    slug: index(['slug']).unique(),
    
    // Query optimization
    byAuthor: index(['author', 'createdAt']),
    byStatus: index(['status', 'createdAt']),
    
    // Full-text search
    search: index(['title', 'content'])
      .fulltext()
      .analyzer('english')
      .highlights(),
    
    // Vector similarity
    semantic: index(['embedding'])
      .hnsw()
      .dimension(384)
      .dist('cosine'),
    
    // Aggregation
    statusCount: index(['status']).count(),
  },
});
```

---

## See also

- [Tables](tables.md) - Table definitions
- [Analyzers](analyzers.md) - Text analyzer configuration
- [AI embeddings example](../examples/ai-embeddings.md)

