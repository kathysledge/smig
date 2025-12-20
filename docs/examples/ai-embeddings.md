# AI embeddings with vector search

Build semantic search and AI-powered recommendations using HNSW vector indexes.

---

## Overview

SurrealDB v3 supports HNSW (Hierarchical Navigable Small World) indexes for fast approximate nearest neighbor search. This enables:

- **Semantic search**: Find content by meaning, not just keywords
- **Recommendations**: "Users who liked this also liked..."
- **Similarity matching**: Find similar documents, products, or users
- **RAG applications**: Retrieval-augmented generation for LLMs

---

## Schema

```javascript
import {
  defineSchema,
  defineRelation,
  composeSchema,
  string,
  int,
  float,
  bool,
  datetime,
  array,
  record,
  option,
  index,
} from 'smig';

// Documents with embeddings for semantic search
const documentSchema = defineSchema({
  table: 'document',
  fields: {
    title: string().required(),
    content: string().required(),
    summary: option('string'),
    
    // OpenAI ada-002 embeddings (1536 dimensions)
    embedding: array('float').required(),
    
    author: record('user').required(),
    category: option('string'),
    tags: array('string').default([]),
    isPublished: bool().default(false),
    createdAt: datetime().default('time::now()'),
    updatedAt: datetime().value('time::now()'),
  },
  indexes: {
    // HNSW vector index for semantic search
    semantic: index(['embedding'])
      .hnsw()
      .dimension(1536)
      .dist('cosine')
      .m(16)
      .efConstruction(100),
    
    // Traditional indexes
    author: index(['author', 'createdAt']),
    category: index(['category']),
    
    // Full-text for keyword fallback
    search: index(['title', 'content'])
      .fulltext()
      .analyzer('english'),
  },
});

// Products with embeddings for recommendations
const productSchema = defineSchema({
  table: 'product',
  fields: {
    name: string().required(),
    description: string().required(),
    price: float().required(),
    
    // Product embedding from description + metadata
    embedding: array('float').required(),
    
    category: string().required(),
    isActive: bool().default(true),
  },
  indexes: {
    // Vector search for similar products
    similar: index(['embedding'])
      .hnsw()
      .dimension(384)  // Sentence transformers size
      .dist('cosine'),
    
    category: index(['category', 'isActive']),
  },
});

// Users with preference embeddings
const userSchema = defineSchema({
  table: 'user',
  fields: {
    email: string().required(),
    name: string().required(),
    
    // User preference vector (aggregated from interactions)
    preferenceEmbedding: option(array('float')),
    
    createdAt: datetime().default('time::now()'),
  },
  indexes: {
    email: index(['email']).unique(),
    
    // Find users with similar preferences
    preferences: index(['preferenceEmbedding'])
      .hnsw()
      .dimension(384)
      .dist('cosine'),
  },
});

// Interaction tracking for preference learning
const interactsRelation = defineRelation({
  name: 'interacts',
  from: 'user',
  to: 'product',
  fields: {
    action: string().required(),  // view, like, purchase
    weight: float().default(1.0),
    timestamp: datetime().default('time::now()'),
  },
  indexes: {
    byUser: index(['in', 'timestamp']),
    byProduct: index(['out', 'timestamp']),
  },
});

export default composeSchema({
  models: {
    document: documentSchema,
    product: productSchema,
    user: userSchema,
  },
  relations: {
    interacts: interactsRelation,
  },
});
```

---

## HNSW index options

| Option | Description | Typical value |
|--------|-------------|---------------|
| `.dimension(n)` | Vector dimensions | Depends on embedding model |
| `.dist(metric)` | Distance metric | `'cosine'` for text |
| `.m(n)` | Connections per node | 12-48 (higher = better recall) |
| `.efConstruction(n)` | Build quality | 100-500 (higher = slower build) |

### Common embedding dimensions

| Model | Dimensions |
|-------|------------|
| OpenAI text-embedding-3-small | 1536 |
| OpenAI text-embedding-3-large | 3072 |
| Cohere embed-english-v3 | 1024 |
| Sentence Transformers (all-MiniLM) | 384 |
| BGE-base | 768 |

---

## Semantic search queries

### Find similar documents

```sql
-- $query_embedding is the vector for the search query
SELECT 
  *,
  vector::distance::cosine(embedding, $query_embedding) AS score
FROM document
WHERE embedding <|10,100|> $query_embedding
  AND isPublished = true
ORDER BY score ASC;
```

The `<|K,EF|>` operator:
- **K**: Number of results to return
- **EF**: Search effort (higher = more accurate, slower)

### Hybrid search (vector + keyword)

```sql
-- Combine semantic and keyword search
LET $semantic = (
  SELECT id, 0.7 AS weight
  FROM document
  WHERE embedding <|20,100|> $query_embedding
);

LET $keyword = (
  SELECT id, 0.3 * search::score(1) AS weight
  FROM document
  WHERE content @@ $query_text
);

SELECT * FROM document
WHERE id IN array::union($semantic.id, $keyword.id)
ORDER BY (
  ($semantic[WHERE id = $parent.id].weight ?? 0) +
  ($keyword[WHERE id = $parent.id].weight ?? 0)
) DESC
LIMIT 10;
```

---

## Product recommendations

### Similar products

```sql
-- Find products similar to the one being viewed
SELECT 
  *,
  vector::distance::cosine(embedding, $current_product.embedding) AS similarity
FROM product
WHERE id != $current_product.id
  AND isActive = true
  AND embedding <|6,50|> $current_product.embedding;
```

### Personalized recommendations

```sql
-- Based on user's preference embedding
SELECT 
  *,
  vector::distance::cosine(embedding, $user.preferenceEmbedding) AS relevance
FROM product
WHERE isActive = true
  AND embedding <|20,100|> $user.preferenceEmbedding
ORDER BY relevance ASC;
```

### Collaborative filtering

```sql
-- Find users with similar preferences
LET $similar_users = (
  SELECT in AS user
  FROM user
  WHERE preferenceEmbedding <|10,50|> $current_user.preferenceEmbedding
    AND id != $current_user.id
);

-- Get products they liked but current user hasn't seen
SELECT DISTINCT out AS product
FROM interacts
WHERE in IN $similar_users
  AND action IN ["like", "purchase"]
  AND out NOT IN (
    SELECT out FROM interacts WHERE in = $current_user.id
  )
LIMIT 20;
```

---

## Building embeddings

### Using OpenAI (Node.js)

```javascript
import OpenAI from 'openai';

const openai = new OpenAI();

async function getEmbedding(text) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
}

// Insert document with embedding
const embedding = await getEmbedding(content);
await db.query(`
  CREATE document SET
    title = $title,
    content = $content,
    embedding = $embedding,
    author = $author
`, { title, content, embedding, author });
```

### Updating user preferences

```javascript
// Aggregate embeddings from liked products
async function updateUserPreferences(userId) {
  await db.query(`
    LET $liked = (
      SELECT out.embedding 
      FROM interacts 
      WHERE in = $userId AND action = "like"
    );
    
    UPDATE $userId SET preferenceEmbedding = (
      SELECT VALUE math::mean(embedding) FROM $liked GROUP ALL
    )[0]
  `, { userId });
}
```

---

## Performance tips

### Index tuning

```javascript
// High accuracy (slower)
index(['embedding'])
  .hnsw()
  .dimension(1536)
  .dist('cosine')
  .m(48)
  .efConstruction(500)

// Balanced
index(['embedding'])
  .hnsw()
  .dimension(1536)
  .dist('cosine')
  .m(16)
  .efConstruction(100)

// Fast (lower accuracy)
index(['embedding'])
  .hnsw()
  .dimension(1536)
  .dist('cosine')
  .m(8)
  .efConstruction(40)
```

### Query optimization

- Use appropriate EF values: Start with 50-100, increase if recall is low
- Filter early: Apply WHERE clauses to reduce candidate set
- Limit dimensions: Use PCA/quantization for very high-dimensional vectors

---

## See also

- [Indexes reference](../schema-reference/indexes.md) - HNSW options
- [Social network](social-network.md) - Graph relations

