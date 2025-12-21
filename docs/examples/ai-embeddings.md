# AI embeddings example

Build a semantic search system with vector embeddings. This example shows how to store OpenAI embeddings, create HNSW indexes, and perform similarity searches.

## What we’re building

A document search system that:
- Stores documents with their embeddings
- Enables semantic (meaning-based) search
- Combines vector search with full-text search
- Suggests similar documents

## The schema

Here’s the complete schema for a semantic search system with documents, embeddings, and search functions:

```typescript
import {
  defineSchema,
  composeSchema,
  string,
  float,
  datetime,
  array,
  record,
  index,
  fn,
  analyzer,
} from 'smig';

// Custom analyzer for technical content
const techAnalyzer = analyzer('tech')
  .tokenizers(['blank', 'class', 'camel'])
  .filters(['lowercase', 'ascii'])
  .comment('Analyzer for technical documentation');

// Documents with embeddings
const documents = defineSchema({
  table: 'document',
  comments: ['Documents with semantic embeddings'],
  fields: {
    // Content
    title: string().required(),
    content: string().required(),
    summary: string(),

    // Metadata
    category: string(),
    tags: array('string').default([]),
    author: record('user'),

    // Embedding vector (OpenAI ada-002 = 1536 dimensions)
    embedding: array('float').comment('1536-dimensional OpenAI embedding vector'),

    // Timestamps
    createdAt: datetime().default('time::now()'),
    updatedAt: datetime(),
  },
  indexes: {
    // Vector similarity search (HNSW)
    semantic: index(['embedding'])
      .hnsw()
      .dimension(1536)
      .dist('COSINE')
      .efc(200)
      .m(16)
      .comment('Semantic search via cosine similarity'),

    // Full-text search (single column only)
    contentSearch: index(['content'])
      .search()
      .analyzer('tech')
      .highlights()
      .bm25(1.2, 0.75)
      .comment('Keyword-based full-text search'),

    // Metadata indexes
    category: index(['category']),
    tags: index(['tags']),
  },
});

// Search history for analytics
const searchHistory = defineSchema({
  table: 'search_history',
  fields: {
    query: string().required(),
    user: record('user'),
    results: array('record<document>'),
    searchedAt: datetime().default('time::now()'),
  },
});

// Document similarity cache
const similarity = defineSchema({
  table: 'document_similarity',
  comments: ['Pre-computed similar document pairs'],
  fields: {
    source: record('document').required(),
    target: record('document').required(),
    score: float().required(),
    computedAt: datetime().default('time::now()'),
  },
  indexes: {
    source: index(['source']),
    sourceScore: index(['source', 'score']),
  },
});

// Semantic search function
const semanticSearch = fn('fn::semantic_search')
  .param('query_embedding', 'array<float>')
  .param('limit', 'option<int>')
  .param('min_score', 'option<float>')
  .returns('array')
  .body(`{
    LET $max = $limit ?? 10;
    LET $threshold = $min_score ?? 0.7;

    RETURN SELECT
      *,
      vector::similarity::cosine(embedding, $query_embedding) AS score
    FROM document
    WHERE embedding != NONE
      AND vector::similarity::cosine(embedding, $query_embedding) >= $threshold
    ORDER BY score DESC
    LIMIT $max;
  }`)
  .comment('Find documents semantically similar to query embedding');

// Hybrid search (vector + keyword)
const hybridSearch = fn('fn::hybrid_search')
  .param('query', 'string')
  .param('query_embedding', 'array<float>')
  .param('limit', 'option<int>')
  .param('vector_weight', 'option<float>')
  .returns('array')
  .body(`{
    LET $max = $limit ?? 10;
    LET $vw = $vector_weight ?? 0.5;
    LET $kw = 1.0 - $vw;

    LET $vector_results = SELECT
      id,
      vector::similarity::cosine(embedding, $query_embedding) AS vector_score
    FROM document
    WHERE embedding != NONE
    ORDER BY vector_score DESC
    LIMIT $max * 2;

    LET $keyword_results = SELECT
      id,
      search::score(0) AS keyword_score
    FROM document
    WHERE content @0@ $query
    ORDER BY keyword_score DESC
    LIMIT $max * 2;

    RETURN SELECT
      document.*,
      ($vw * vector_score + $kw * keyword_score) AS combined_score
    FROM (
      SELECT
        id,
        vector_score ?? 0 AS vector_score,
        keyword_score ?? 0 AS keyword_score
      FROM array::union($vector_results, $keyword_results)
      GROUP BY id
    )
    JOIN document ON document.id = id
    ORDER BY combined_score DESC
    LIMIT $max;
  }`)
  .comment('Combine vector and keyword search with configurable weighting');

// Find similar documents
const findSimilar = fn('fn::find_similar')
  .param('doc_id', 'record<document>')
  .param('limit', 'option<int>')
  .returns('array')
  .body(`{
    LET $max = $limit ?? 5;
    LET $doc = SELECT embedding FROM $doc_id;

    IF $doc.embedding = NONE {
      RETURN [];
    };

    RETURN SELECT *
    FROM document
    WHERE id != $doc_id
      AND embedding != NONE
    ORDER BY vector::similarity::cosine(embedding, $doc.embedding) DESC
    LIMIT $max;
  }`)
  .comment('Find documents similar to a given document');

export default composeSchema({
  models: {
    document: documents,
    searchHistory: searchHistory,
    documentSimilarity: similarity,
  },
  functions: {
    semanticSearch,
    hybridSearch,
    findSimilar,
  },
  analyzers: {
    tech: techAnalyzer,
  },
});
```

## Understanding the schema

### Vector embeddings

The `embedding` field stores the vector representation of the document content:

```typescript
embedding: array('float')
  .comment('1536-dimensional OpenAI embedding vector'),
```

Different embedding models have different dimensions:
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

**EFC (efConstruction)**: Quality during index building. Higher values (100-500) give better recall but slower indexing.

**M**: Maximum connections per node. Higher values (16-64) improve recall at the cost of memory.

### Distance metrics

Choose based on your data:

| Metric | Best for |
|--------|----------|
| `COSINE` | Text embeddings (most common) |
| `EUCLIDEAN` | When magnitude matters |
| `DOT` | Normalized vectors, faster |

## Using the search functions

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

### Semantic search

Find documents by meaning rather than keywords:

```typescript
async function searchDocuments(query) {
  const queryEmbedding = await getEmbedding(query);

  const results = await db.query(
    'RETURN fn::semantic_search($embedding, $limit, $threshold)',
    {
      embedding: queryEmbedding,
      limit: 10,
      threshold: 0.75,
    }
  );

  return results;
}
```

### Hybrid search

Combine meaning and keywords:

```typescript
async function hybridSearch(query) {
  const queryEmbedding = await getEmbedding(query);

  const results = await db.query(
    'RETURN fn::hybrid_search($query, $embedding, $limit, $weight)',
    {
      query,
      embedding: queryEmbedding,
      limit: 10,
      weight: 0.6,  // 60% vector, 40% keyword
    }
  );

  return results;
}
```

## Advanced patterns

### Chunking long documents

For documents longer than the embedding model's context window:

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
  const similar = await db.query(
    'RETURN fn::find_similar($id, 20)',
    { id: docId }
  );

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
