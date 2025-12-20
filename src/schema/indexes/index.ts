/**
 * @fileoverview Index builder for SurrealDB tables.
 * @module schema/indexes
 */

/**
 * Distance metric types for vector indexes.
 */
export type DistanceMetric =
  | 'COSINE'
  | 'EUCLIDEAN'
  | 'MANHATTAN'
  | 'MINKOWSKI'
  | 'CHEBYSHEV'
  | 'HAMMING'
  | 'JACCARD'
  | 'PEARSON';

/**
 * Index type enumeration.
 */
export type IndexType = 'BTREE' | 'HASH' | 'SEARCH' | 'MTREE' | 'HNSW';

/**
 * Index definition builder for SurrealDB tables.
 *
 * Indexes improve query performance and can enforce uniqueness constraints.
 * Different index types are optimized for specific use cases:
 *
 * - **BTREE**: General-purpose indexes for range queries and sorting
 * - **HASH**: Fast equality lookups
 * - **SEARCH**: Full-text search with analyzers
 * - **MTREE**: Multi-dimensional vector search (ANN)
 * - **HNSW**: Hierarchical Navigable Small World vector search (ANN)
 *
 * @example
 * ```typescript
 * // Primary key index
 * const primary = index(['id']).unique();
 *
 * // Search index with analyzer
 * const contentSearch = index(['title', 'content'])
 *   .search()
 *   .analyzer('english')
 *   .highlights();
 *
 * // Vector index for AI embeddings
 * const vectorSearch = index(['embedding'])
 *   .hnsw()
 *   .dimension(384)
 *   .dist('COSINE')
 *   .efc(150)
 *   .m(12);
 *
 * // MTREE vector index
 * const mtreeSearch = index(['embedding'])
 *   .mtree()
 *   .dimension(768)
 *   .dist('EUCLIDEAN')
 *   .capacity(40);
 * ```
 */
export class SurrealQLIndex {
  private index: Record<string, unknown> = {
    columns: [],
    unique: false,
    type: 'BTREE',
    // Search options
    analyzer: null,
    highlights: false,
    bm25: null, // { k1?: number, b?: number }
    docLengthsOrder: null, // number
    docIdsOrder: null, // number
    postingsOrder: null, // number
    termsOrder: null, // number
    docIdsCacheSize: null, // number
    docIdsCache: null, // number
    docLengthsCacheSize: null, // number
    docLengthsCache: null, // number
    postingsCacheSize: null, // number
    postingsCache: null, // number
    termsCacheSize: null, // number
    termsCache: null, // number
    // Vector index options (MTREE/HNSW)
    dimension: null,
    dist: null,
    // MTREE-specific
    capacity: null,
    // HNSW-specific
    efc: null, // efConstruction
    m: null, // maxConnections
    m0: null, // maxConnections at layer 0
    lm: null, // levelMultiplier
    // Metadata
    comments: [],
    // Rename tracking
    previousNames: [],
    // IF NOT EXISTS / OVERWRITE
    ifNotExists: false,
    overwrite: false,
    // Concurrency
    concurrently: false,
  };

  constructor(columns: string[]) {
    this.index.columns = columns;
  }

  /** Makes this index enforce uniqueness constraints */
  unique() {
    this.index.unique = true;
    return this;
  }

  /** Uses IF NOT EXISTS clause when defining the index */
  ifNotExists() {
    this.index.ifNotExists = true;
    return this;
  }

  /** Uses OVERWRITE clause when redefining the index */
  overwrite() {
    this.index.overwrite = true;
    return this;
  }

  /** Creates index concurrently (SurrealDB 3.x) */
  concurrently() {
    this.index.concurrently = true;
    return this;
  }

  /** Sets index type to BTREE (default) - good for range queries */
  btree() {
    this.index.type = 'BTREE';
    return this;
  }

  /** Sets index type to HASH - fast equality lookups */
  hash() {
    this.index.type = 'HASH';
    return this;
  }

  /** Sets index type to SEARCH - enables full-text search */
  search() {
    this.index.type = 'SEARCH';
    return this;
  }

  /**
   * Sets index type to MTREE - for vector/multi-dimensional data.
   *
   * MTREE indexes use a tree-based structure for approximate nearest neighbor
   * search. Good for moderate-sized vector datasets.
   *
   * @example
   * ```typescript
   * const vectorIndex = index(['embedding'])
   *   .mtree()
   *   .dimension(384)
   *   .dist('COSINE')
   *   .capacity(40);
   * ```
   */
  mtree() {
    this.index.type = 'MTREE';
    return this;
  }

  /**
   * Sets index type to HNSW - Hierarchical Navigable Small World.
   *
   * HNSW is a graph-based algorithm for fast approximate nearest neighbor
   * search. It offers excellent query performance for high-dimensional vectors.
   *
   * @example
   * ```typescript
   * const vectorIndex = index(['embedding'])
   *   .hnsw()
   *   .dimension(1536)
   *   .dist('COSINE')
   *   .efc(200)
   *   .m(16);
   * ```
   */
  hnsw() {
    this.index.type = 'HNSW';
    return this;
  }

  /**
   * Sets the vector dimension for MTREE/HNSW indexes.
   *
   * @param dim - Number of dimensions in the vector
   * @returns The index instance for method chaining
   */
  dimension(dim: number) {
    this.index.dimension = dim;
    return this;
  }

  /**
   * Sets the distance metric for MTREE/HNSW indexes.
   *
   * Common metrics:
   * - COSINE: Cosine similarity (good for normalized vectors, embeddings)
   * - EUCLIDEAN: L2 distance (good for spatial data)
   * - MANHATTAN: L1 distance
   * - MINKOWSKI: Generalized distance (requires p parameter)
   * - CHEBYSHEV: L∞ distance
   * - HAMMING: For binary vectors
   * - JACCARD: For set similarity
   * - PEARSON: For correlation-based similarity
   *
   * @param metric - The distance metric to use
   * @returns The index instance for method chaining
   */
  dist(metric: DistanceMetric) {
    this.index.dist = metric;
    return this;
  }

  /**
   * Sets the node capacity for MTREE indexes.
   *
   * @param cap - Maximum number of entries per node (default: 40)
   * @returns The index instance for method chaining
   */
  capacity(cap: number) {
    this.index.capacity = cap;
    return this;
  }

  /**
   * Sets the efConstruction parameter for HNSW indexes.
   *
   * Higher values improve index quality but increase build time.
   * Recommended range: 100-500 (default: 150)
   *
   * @param value - efConstruction value
   * @returns The index instance for method chaining
   */
  efc(value: number) {
    this.index.efc = value;
    return this;
  }

  /**
   * Sets the M parameter (max connections per node) for HNSW indexes.
   *
   * Higher values improve recall but increase memory usage.
   * Recommended range: 5-48 (default: 12)
   *
   * @param value - M value
   * @returns The index instance for method chaining
   */
  m(value: number) {
    this.index.m = value;
    return this;
  }

  /**
   * Sets the M0 parameter (max connections at layer 0) for HNSW indexes.
   *
   * Usually set to 2*M. If not specified, defaults to 2*M.
   *
   * @param value - M0 value
   * @returns The index instance for method chaining
   */
  m0(value: number) {
    this.index.m0 = value;
    return this;
  }

  /**
   * Sets the level multiplier for HNSW indexes.
   *
   * Controls the probability of assigning an element to higher layers.
   * Default: 1/ln(M)
   *
   * @param value - Level multiplier
   * @returns The index instance for method chaining
   */
  lm(value: number) {
    this.index.lm = value;
    return this;
  }

  /** Sets the text analyzer for SEARCH indexes */
  analyzer(name: string) {
    this.index.analyzer = name;
    return this;
  }

  /** Enables search result highlighting for SEARCH indexes */
  highlights() {
    this.index.highlights = true;
    return this;
  }

  /**
   * Configures BM25 ranking for SEARCH indexes.
   *
   * @param k1 - Term frequency saturation parameter (default: 1.2)
   * @param b - Length normalization parameter (default: 0.75)
   * @returns The index instance for method chaining
   */
  bm25(k1?: number, b?: number) {
    this.index.bm25 = { k1, b };
    return this;
  }

  /**
   * Sets the document IDs cache size for SEARCH indexes.
   *
   * @param size - Cache size in entries
   * @returns The index instance for method chaining
   */
  docIdsCache(size: number) {
    this.index.docIdsCache = size;
    return this;
  }

  /**
   * Sets the document lengths cache size for SEARCH indexes.
   *
   * @param size - Cache size in entries
   * @returns The index instance for method chaining
   */
  docLengthsCache(size: number) {
    this.index.docLengthsCache = size;
    return this;
  }

  /**
   * Sets the postings cache size for SEARCH indexes.
   *
   * @param size - Cache size in entries
   * @returns The index instance for method chaining
   */
  postingsCache(size: number) {
    this.index.postingsCache = size;
    return this;
  }

  /**
   * Sets the terms cache size for SEARCH indexes.
   *
   * @param size - Cache size in entries
   * @returns The index instance for method chaining
   */
  termsCache(size: number) {
    this.index.termsCache = size;
    return this;
  }

  /** Adds a documentation comment for the index */
  comment(text: string) {
    // biome-ignore lint/suspicious/noExplicitAny: Dynamic index builder requires flexible typing
    (this.index as any).comments.push(text);
    return this;
  }

  /**
   * Tracks previous name(s) for this index (for ALTER INDEX RENAME operations).
   *
   * @param names - Previous index name(s)
   * @returns The index instance for method chaining
   */
  was(names: string | string[]) {
    const nameArray = Array.isArray(names) ? names : [names];
    (this.index.previousNames as string[]).push(...nameArray);
    return this;
  }

  build() {
    return this.index;
  }
}
