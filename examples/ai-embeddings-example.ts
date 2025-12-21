/**
 * AI Embeddings Example
 *
 * Build a semantic search system with vector embeddings. Shows how to store
 * OpenAI embeddings, create HNSW indexes, and perform similarity searches.
 */
import {
  analyzer,
  array,
  composeSchema,
  datetime,
  defineSchema,
  float,
  index,
  record,
  string,
} from '../dist/schema/concise-schema.js';

// Custom analyzer for technical content
const techAnalyzer = analyzer('tech')
  .tokenizers(['blank', 'class', 'camel'])
  .filters(['lowercase', 'ascii']);

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
    embedding: array('float'),

    // Timestamps
    createdAt: datetime().default('time::now()'),
    updatedAt: datetime(),
  },
  indexes: {
    // Vector similarity search (HNSW)
    semantic: index(['embedding']).hnsw().dimension(1536).dist('COSINE').efc(200).m(16),

    // Full-text search (single column only)
    contentSearch: index(['content']).search().analyzer('tech').highlights(),

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

export default composeSchema({
  models: {
    document: documents,
    searchHistory: searchHistory,
    documentSimilarity: similarity,
  },
  analyzers: {
    tech: techAnalyzer,
  },
  relations: {},
});
