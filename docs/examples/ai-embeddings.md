# AI embeddings

Build a semantic search system with vector embeddings. This example shows how to store OpenAI embeddings, create HNSW indexes, and perform similarity searches.

## What you'll learn

This example demonstrates several key **smig** concepts:

- HNSW vector indexes for fast similarity search
- Full-text search with custom analyzers
- Custom database functions for search logic
- Storing and querying high-dimensional vectors

## What we're building

A document search system that:

- Stores documents with their embeddings
- Enables semantic (meaning-based) search
- Combines vector search with full-text search
- Suggests similar documents

## Complete schema

The AI embeddings schema includes three tables (documents, search history, similarity cache), a custom analyzer for technical content, and configurable HNSW indexes for vector search.

<<< @/../examples/ai-embeddings-example.ts

## Understanding the schema

### Vector embeddings

The `embedding` field stores the vector representation of the document content. Different embedding models have different dimensions:

- OpenAI `text-embedding-ada-002`: 1536 dimensions
- OpenAI `text-embedding-3-small`: 1536 dimensions
- Cohere `embed-english-v3.0`: 1024 dimensions

### HNSW index

The `hnsw()` index enables fast approximate nearest neighbor search:

```typescript
semantic: index(['embedding'])
  .hnsw()
  .dimension(1536)      // Dimensions must match embedding size
  .dist('COSINE')       // Cosine similarity (good for text)
  .efc(200)             // Higher = better quality, slower build
  .m(16)                // Connections per node
```

**EFC (efConstruction)**: Quality during index building. Higher values (100–500) give better recall but slower indexing.

**M**: Maximum connections per node. Higher values (16–64) improve recall at the cost of memory.

### Distance metrics

Choose based on your data:

| Metric | Best for |
|--------|----------|
| `COSINE` | Text embeddings (most common) |
| `EUCLIDEAN` | When magnitude matters |
| `DOT` | Normalized vectors, faster |

## Using semantic search

### Generate embeddings

First, get embeddings from your AI provider:

```typescript
// Example with OpenAI
import OpenAI from 'openai';

const openai = new OpenAI();

async function getEmbedding(text) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text,
  });
  return response.data[0].embedding;
}
```

### Store documents with embeddings

Save documents along with their computed embeddings:

```typescript
async function storeDocument(title, content) {
  const embedding = await getEmbedding(`${title}\n\n${content}`);

  await db.create('document', {
    title,
    content,
    embedding,
  });
}
```

### Query with vector similarity

Find documents similar to a query:

```surql
SELECT *,
  vector::similarity::cosine(embedding, $query_embedding) AS score
FROM document
WHERE embedding != NONE
ORDER BY score DESC
LIMIT 10;
```

### Combine with keyword search

Mix vector and full-text search for hybrid results:

```surql
SELECT *,
  vector::similarity::cosine(embedding, $query_embedding) AS vector_score,
  search::score(0) AS keyword_score
FROM document
WHERE content @0@ $query
  AND embedding != NONE
ORDER BY (vector_score * 0.6 + keyword_score * 0.4) DESC
LIMIT 10;
```

## Advanced patterns

### Chunking long documents

For documents longer than the embedding model's context window, split them into chunks:

```typescript
const chunks = defineSchema({
  table: 'document_chunk',
  fields: {
    document: record('document').required(),
    chunkIndex: int().required(),
    content: string().required(),
    embedding: array('float'),
  },
  indexes: {
    chunkEmbedding: index(['embedding'])
      .hnsw()
      .dimension(1536)
      .dist('COSINE'),
    document: index(['document', 'chunkIndex']),
  },
});
```

### Caching similarity scores

Pre-compute similar documents during off-peak hours:

```typescript
// Run as a batch job
async function computeSimilarities(docId) {
  const similar = await db.query(`
    SELECT id,
      vector::similarity::cosine(embedding, $doc.embedding) AS score
    FROM document
    WHERE id != $docId AND embedding != NONE
    ORDER BY score DESC
    LIMIT 20
  `, { docId, doc: await db.select(docId) });

  for (const doc of similar) {
    await db.create('document_similarity', {
      source: docId,
      target: doc.id,
      score: doc.score,
    });
  }
}
```

### Filtering with vectors

Combine vector search with metadata filters:

```surql
SELECT *,
  vector::similarity::cosine(embedding, $query_embedding) AS score
FROM document
WHERE category = 'technology'
  AND embedding != NONE
ORDER BY score DESC
LIMIT 10;
```

## Performance tips

### Index build time

HNSW indexes are fast to query but slow to build. For large datasets:

- Build incrementally
- Use lower `efc` for initial load, rebuild later
- Consider MTREE for smaller datasets (<100k documents)

### Embedding storage

Embeddings are large. For 1 million documents with 1536-dim float32 vectors:

- ~6 GB just for embeddings

Consider:

- Quantization (float16 or int8)
- Only embedding important content
- Removing old embeddings

### Query optimization

- Filter before vector search when possible
- Use appropriate `limit` values
- Pre-compute common similarity queries

## Related

- [Indexes](/schema-reference/indexes) — Vector index details
- [Functions](/schema-reference/functions) — Custom search logic
- [Analyzers](/schema-reference/analyzers) — Full-text configuration
