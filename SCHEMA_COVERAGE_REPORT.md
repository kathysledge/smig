# SurrealDB v3 schema coverage report for smig

**Analysis date:** December 19, 2025  
**SurrealDB version analyzed:** v3.0.0-beta.1  
**smig version:** Current main branch

---

## Executive summary

| Category | SurrealDB features | smig supported | Coverage |
|----------|-------------------|----------------|----------|
| DEFINE statements | 17 types | 7 types | 41% |
| Table options | 9 options | 2 options | 22% |
| Field options | 10 options | 5 options | 50% |
| Index types | 5 types | 1 type (partial) | 20% |
| Index options | 15+ options | 2 options | 13% |
| Event options | 5 options | 4 options | 80% |
| Analyzer options | 5 options | 3 options | 60% |
| **Overall estimated coverage** | | | **~35%** |

---

## DEFINE statement types

SurrealDB v3.0.0-beta.1 supports 17 DEFINE statement types:

| DEFINE type | smig support | Notes |
|-------------|--------------|-------|
| `DEFINE NAMESPACE` | ❌ Not supported | Infrastructure-level, may not be needed for app schemas |
| `DEFINE DATABASE` | ❌ Not supported | Infrastructure-level, may not be needed for app schemas |
| `DEFINE TABLE` | ✅ Supported | Missing: TYPE, DROP, CHANGEFEED, VIEW, COMMENT |
| `DEFINE FIELD` | ✅ Supported | Missing: FLEXIBLE, READONLY, COMPUTED, REFERENCE, COMMENT |
| `DEFINE INDEX` | ⚠️ Partial | Only UNIQUE supported; missing: HNSW, FULLTEXT, COUNT, CONCURRENTLY |
| `DEFINE EVENT` | ✅ Supported | Missing: COMMENT |
| `DEFINE FUNCTION` | ✅ Supported | Missing: PERMISSIONS, COMMENT |
| `DEFINE ANALYZER` | ✅ Supported | Missing: FUNCTION, COMMENT |
| `DEFINE ACCESS` | ✅ Supported | Implemented as scope; missing: JWT, BEARER, duration options |
| `DEFINE USER` | ❌ Not supported | User management |
| `DEFINE PARAM` | ❌ Not supported | Global parameters |
| `DEFINE MODEL` | ❌ Not supported | ML model definitions |
| `DEFINE CONFIG` | ❌ Not supported | GraphQL/API configuration |
| `DEFINE API` | ❌ Not supported | REST API endpoint definitions |
| `DEFINE BUCKET` | ❌ Not supported | Object storage buckets |
| `DEFINE SEQUENCE` | ❌ Not supported | Auto-increment sequences |
| `DEFINE MODULE` | ❌ Not supported | WASM modules |

---

## DEFINE TABLE options

| Option | SurrealDB syntax | smig support | Priority |
|--------|------------------|--------------|----------|
| Name | `DEFINE TABLE name` | ✅ Supported | - |
| Schema mode | `SCHEMAFULL` / `SCHEMALESS` | ✅ Supported | - |
| Table type | `TYPE NORMAL` / `TYPE RELATION` / `TYPE ANY` | ❌ Not supported | HIGH |
| Relation IN/OUT | `TYPE RELATION IN user OUT post` | ❌ Not supported | HIGH |
| Relation ENFORCED | `TYPE RELATION ... ENFORCED` | ❌ Not supported | MEDIUM |
| DROP | `DROP` | ❌ Not supported | LOW |
| VIEW | `AS SELECT ... FROM ...` | ❌ Not supported | MEDIUM |
| CHANGEFEED | `CHANGEFEED duration [INCLUDE ORIGINAL]` | ❌ Not supported | LOW |
| COMMENT | `COMMENT "..."` | ❌ Not supported | LOW |
| IF NOT EXISTS | `IF NOT EXISTS` | ❌ Not supported | LOW |
| OVERWRITE | `OVERWRITE` | ❌ Not supported | LOW |
| PERMISSIONS | `PERMISSIONS ...` | ⚠️ Defined but not generated | MEDIUM |

---

## DEFINE FIELD options

| Option | SurrealDB syntax | smig support | Notes |
|--------|------------------|--------------|-------|
| Name | `DEFINE FIELD name ON table` | ✅ Supported | |
| TYPE | `TYPE string` | ✅ Supported | |
| FLEXIBLE | `TYPE ... FLEXIBLE` | ❌ Not supported | Builder has it, not generated |
| DEFAULT | `DEFAULT value` | ✅ Supported | |
| DEFAULT ALWAYS | `DEFAULT ALWAYS value` | ❌ Not supported | New in v3 |
| VALUE | `VALUE expression` | ✅ Supported | |
| COMPUTED | `COMPUTED expression` | ❌ Not supported | New in v3 (separate from VALUE) |
| ASSERT | `ASSERT condition` | ✅ Supported | |
| READONLY | `READONLY` | ❌ Not supported | Builder has it, not generated |
| REFERENCE | `REFERENCE ON DELETE [REJECT|CASCADE|UNSET|IGNORE|THEN expr]` | ❌ Not supported | Foreign key constraints |
| PERMISSIONS | `PERMISSIONS ...` | ⚠️ Partial | Only non-FULL generated |
| COMMENT | `COMMENT "..."` | ❌ Not supported | |
| IF NOT EXISTS | `IF NOT EXISTS` | ❌ Not supported | Builder has it |
| OVERWRITE | `OVERWRITE` | ⚠️ Used in updates only | |

---

## DEFINE INDEX options

### Index types

| Type | SurrealDB v3 syntax | smig support | Priority |
|------|---------------------|--------------|----------|
| Basic (Idx) | `DEFINE INDEX ... FIELDS ...` | ✅ Supported | - |
| UNIQUE | `UNIQUE` | ✅ Supported | - |
| HNSW (Vector) | `HNSW DIMENSION n DIST metric ...` | ❌ **Not supported** | **CRITICAL** |
| FULLTEXT | `FULLTEXT ANALYZER name BM25(k,b) [HIGHLIGHTS]` | ❌ **Not supported** | **HIGH** |
| COUNT | `COUNT [WHERE condition]` | ❌ Not supported | LOW |

### HNSW (Vector index) parameters - NOT SUPPORTED

| Parameter | Description | Default |
|-----------|-------------|---------|
| `DIMENSION n` | Vector dimension (required) | - |
| `DIST metric` | Distance metric | EUCLIDEAN |
| `TYPE vectortype` | Vector element type (F64, F32, I64, I32, I16) | F32 |
| `M n` | Max connections per node | - |
| `M0 n` | Max connections at layer 0 | - |
| `EFC n` | Size of dynamic candidate list | - |
| `LM n` | Level multiplier | - |
| `EXTEND_CANDIDATES` | Enable extended candidates | false |
| `KEEP_PRUNED_CONNECTIONS` | Keep pruned connections | false |

**Distance metrics available:** CHEBYSHEV, COSINE, EUCLIDEAN (default), HAMMING, JACCARD, MANHATTAN, MINKOWSKI(n), PEARSON

### FULLTEXT parameters - NOT SUPPORTED

| Parameter | Description |
|-----------|-------------|
| `ANALYZER name` | Text analyzer to use |
| `BM25(k1, b)` | BM25 scoring parameters |
| `VS` | Vector search scoring |
| `HIGHLIGHTS` | Enable search highlighting |

### Other index options

| Option | smig support |
|--------|--------------|
| `CONCURRENTLY` | ❌ Not supported |
| `COMMENT` | ❌ Not supported |
| `IF NOT EXISTS` | ❌ Not supported |
| `OVERWRITE` | ❌ Not supported |

---

## DEFINE EVENT options

| Option | SurrealDB syntax | smig support |
|--------|------------------|--------------|
| Name | `DEFINE EVENT name ON table` | ✅ Supported |
| WHEN | `WHEN condition` | ✅ Supported |
| THEN | `THEN action` / `THEN { actions }` | ✅ Supported |
| COMMENT | `COMMENT "..."` | ❌ Not supported |
| IF NOT EXISTS | `IF NOT EXISTS` | ❌ Not supported |
| OVERWRITE | `OVERWRITE` | ❌ Not supported |

**Note:** SurrealDB v3 no longer has explicit CREATE/UPDATE/DELETE event types. The WHEN clause handles all conditions.

---

## DEFINE FUNCTION options

| Option | SurrealDB syntax | smig support |
|--------|------------------|--------------|
| Name | `DEFINE FUNCTION fn::name` | ✅ Supported |
| Parameters | `($param: type, ...)` | ✅ Supported |
| Return type | `-> returnType` | ✅ Supported |
| Body | `{ ... }` | ✅ Supported |
| PERMISSIONS | `PERMISSIONS ...` | ❌ Not supported |
| COMMENT | `COMMENT "..."` | ❌ Not supported |
| IF NOT EXISTS | `IF NOT EXISTS` | ❌ Not supported |
| OVERWRITE | `OVERWRITE` | ❌ Not supported |

---

## DEFINE ANALYZER options

| Option | SurrealDB syntax | smig support |
|--------|------------------|--------------|
| Name | `DEFINE ANALYZER name` | ✅ Supported |
| TOKENIZERS | `TOKENIZERS BLANK, CAMEL, CLASS, PUNCT` | ✅ Supported |
| FILTERS | `FILTERS ASCII, LOWERCASE, ...` | ✅ Supported |
| FUNCTION | `FUNCTION fn::name` | ❌ Not supported |
| COMMENT | `COMMENT "..."` | ❌ Not supported |

### Tokenizers

| Tokenizer | Description |
|-----------|-------------|
| BLANK | Split on whitespace |
| CAMEL | Split on camelCase |
| CLASS | Split on character class changes |
| PUNCT | Split on punctuation |

### Filters

| Filter | Description |
|--------|-------------|
| ASCII | Convert to ASCII |
| LOWERCASE | Convert to lowercase |
| UPPERCASE | Convert to uppercase |
| EDGENGRAM(min, max) | Create edge n-grams |
| NGRAM(min, max) | Create n-grams |
| SNOWBALL(language) | Snowball stemming |
| MAPPER(path) | Custom mapping file |

**Languages for SNOWBALL:** ARABIC, DANISH, DUTCH, ENGLISH, FINNISH, FRENCH, GERMAN, GREEK, HUNGARIAN, ITALIAN, NORWEGIAN, PORTUGUESE, ROMANIAN, RUSSIAN, SPANISH, SWEDISH, TAMIL, TURKISH

---

## DEFINE ACCESS (formerly SCOPE) options

| Option | SurrealDB syntax | smig support |
|--------|------------------|--------------|
| Name | `DEFINE ACCESS name ON DATABASE` | ✅ Supported |
| TYPE RECORD | `TYPE RECORD` | ✅ Supported |
| SIGNUP | `SIGNUP (query)` | ✅ Supported |
| SIGNIN | `SIGNIN (query)` | ✅ Supported |
| SESSION duration | `DURATION FOR SESSION duration` | ✅ Supported |
| TOKEN duration | `DURATION FOR TOKEN duration` | ❌ Not supported |
| GRANT duration | `DURATION FOR GRANT duration` | ❌ Not supported |
| WITH JWT | `WITH JWT ALGORITHM ... KEY ...` | ❌ Not supported |
| WITH REFRESH | `WITH REFRESH` | ❌ Not supported |
| AUTHENTICATE | `AUTHENTICATE expression` | ❌ Not supported |
| TYPE JWT | `TYPE JWT` | ❌ Not supported |
| TYPE BEARER | `TYPE BEARER FOR USER/RECORD` | ❌ Not supported |
| COMMENT | `COMMENT "..."` | ❌ Not supported |

---

## Critical missing features (prioritized)

### Priority 1: CRITICAL (blocks common use cases)

1. **HNSW Vector Indexes** - Required for AI/ML applications with embeddings
   - `DEFINE INDEX idx ON table FIELDS embedding HNSW DIMENSION 384 DIST COSINE`
   - Includes: DIMENSION, DIST, TYPE, M, M0, EFC, LM, EXTEND_CANDIDATES, KEEP_PRUNED_CONNECTIONS

2. **FULLTEXT Search Indexes** - Required for search functionality
   - `DEFINE INDEX idx ON table FIELDS content FULLTEXT ANALYZER english BM25(1.2, 0.75) HIGHLIGHTS`
   - Includes: ANALYZER, BM25, VS, HIGHLIGHTS

### Priority 2: HIGH (common schema patterns)

3. **Table TYPE (NORMAL/RELATION/ANY)** - Proper relation table definitions
   - `DEFINE TABLE follows TYPE RELATION IN user OUT user`
   - Includes: IN, OUT, ENFORCED

4. **Field REFERENCE** - Foreign key constraints with cascade options
   - `DEFINE FIELD author ON post TYPE record<user> REFERENCE ON DELETE CASCADE`
   - Options: REJECT, IGNORE, CASCADE, UNSET, THEN expression

5. **Field READONLY and FLEXIBLE** - Already in builder, needs SQL generation

### Priority 3: MEDIUM (enhanced functionality)

6. **Field COMPUTED** - Separate from VALUE in v3
7. **Table VIEW** - Materialized views
8. **DEFINE PARAM** - Global parameters
9. **DEFINE SEQUENCE** - Auto-increment sequences
10. **Index CONCURRENTLY** - Non-blocking index creation

### Priority 4: LOW (nice to have)

11. **COMMENT on all elements** - Documentation
12. **IF NOT EXISTS / OVERWRITE** - Idempotent definitions
13. **Table DROP** - Auto-cleanup of old data
14. **Table CHANGEFEED** - Change data capture
15. **DEFINE USER** - User management
16. **DEFINE MODEL** - ML models
17. **DEFINE CONFIG** - GraphQL/API config
18. **DEFINE API** - REST endpoints
19. **DEFINE BUCKET** - Object storage
20. **DEFINE MODULE** - WASM modules

---

## Recommended implementation roadmap

### Phase 1: Vector and search indexes (HIGH IMPACT)

```typescript
// Proposed API extension for index builder
index(['embedding'])
  .hnsw()
  .dimension(384)
  .dist('cosine')
  .type('f32')
  .m(16)
  .efConstruction(100);

index(['content'])
  .fulltext()
  .analyzer('english')
  .bm25(1.2, 0.75)
  .highlights();
```

**Files to modify:**
- `src/types/schema.ts` - Add HNSW/FullText types and parameters
- `src/schema/concise-schema.ts` - Add builder methods
- `src/migrator/migration-manager.ts` - Update `generateIndexDefinition()`

### Phase 2: Enhanced table types

```typescript
// Proposed API for relation tables
defineRelation({
  name: 'follows',
  from: 'user',
  to: 'user',
  enforced: true,  // NEW
  fields: { ... }
});
```

### Phase 3: Field enhancements

```typescript
// Proposed API extensions
record('user')
  .reference()
  .onDelete('cascade');  // or 'reject', 'ignore', 'unset', custom expression

string()
  .readonly()   // Already exists, needs SQL generation
  .flexible();  // Already exists, needs SQL generation
```

---

## SQL generation gaps in detail

### Current `generateIndexDefinition()`:

```typescript
let definition = `DEFINE INDEX ${indexName} ON TABLE ${tableName} COLUMNS ${index.columns.join(', ')}`;
if (index.unique) {
  definition += ' UNIQUE';
}
```

### Required `generateIndexDefinition()`:

```typescript
let definition = `DEFINE INDEX ${indexName} ON TABLE ${tableName} FIELDS ${index.columns.join(', ')}`;

switch (index.type) {
  case 'UNIQUE':
    definition += ' UNIQUE';
    break;
  case 'HNSW':
    definition += ` HNSW DIMENSION ${index.dimension} DIST ${index.distance}`;
    if (index.vectorType) definition += ` TYPE ${index.vectorType}`;
    if (index.m) definition += ` M ${index.m}`;
    if (index.m0) definition += ` M0 ${index.m0}`;
    if (index.efConstruction) definition += ` EFC ${index.efConstruction}`;
    if (index.lm) definition += ` LM ${index.lm}`;
    if (index.extendCandidates) definition += ' EXTEND_CANDIDATES';
    if (index.keepPrunedConnections) definition += ' KEEP_PRUNED_CONNECTIONS';
    break;
  case 'FULLTEXT':
    definition += ` FULLTEXT ANALYZER ${index.analyzer}`;
    if (index.scoring) definition += ` ${index.scoring}`;
    if (index.highlights) definition += ' HIGHLIGHTS';
    break;
  case 'COUNT':
    definition += ' COUNT';
    if (index.condition) definition += ` ${index.condition}`;
    break;
}

if (index.concurrently) definition += ' CONCURRENTLY';
if (index.comment) definition += ` COMMENT "${index.comment}"`;
```

---

## Breaking changes in SurrealDB v3

1. **MTREE → HNSW**: Vector indexes now use `HNSW` keyword instead of `MTREE`
2. **SCOPE → ACCESS**: Authentication scopes are now `DEFINE ACCESS ... TYPE RECORD`
3. **SEARCH → FULLTEXT**: Full-text indexes now use `FULLTEXT` keyword
4. **Future syntax removed**: `<future> { }` replaced with `{ }` for computed fields
5. **Event types**: No longer explicit CREATE/UPDATE/DELETE - use WHEN clause conditions
6. **COLUMNS → FIELDS**: Index syntax uses `FIELDS` instead of `COLUMNS`

---

## Conclusion

**smig** currently covers approximately **35%** of SurrealDB v3's schema definition capabilities. The most critical gaps are:

1. **Vector indexes (HNSW)** - Essential for AI/ML workloads
2. **Full-text search indexes** - Essential for search functionality
3. **Proper relation table types** - Better graph database support
4. **Foreign key references** - Data integrity constraints

Implementing these four features would bring coverage to approximately **60%** and cover the most common production use cases.

