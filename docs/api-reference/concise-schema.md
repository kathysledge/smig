# Concise schema API

Fluent builder API for defining SurrealDB schemas.

---

## defineSchema()

Create a table definition.

```typescript
function defineSchema(config: {
  table: string;
  fields: Record<string, FieldBuilder>;
  schemaless?: boolean;
  type?: 'normal' | 'any';
  drop?: boolean;
  changefeed?: { expiry: string; includeOriginal?: boolean };
  permissions?: Record<string, string>;
  indexes?: Record<string, IndexBuilder>;
  events?: Record<string, EventBuilder>;
  comments?: string[];
}): TableSchema;
```

### Example

```javascript
const userSchema = defineSchema({
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

---

## defineRelation()

Create a relation (graph edge) definition.

```typescript
function defineRelation(config: {
  name: string;
  from: string;
  to: string | string[];
  enforced?: boolean;
  fields?: Record<string, FieldBuilder>;
  indexes?: Record<string, IndexBuilder>;
  events?: Record<string, EventBuilder>;
  comments?: string[];
}): RelationSchema;
```

### Example

```javascript
const followsRelation = defineRelation({
  name: 'follows',
  from: 'user',
  to: 'user',
  enforced: true,
  fields: {
    followedAt: datetime().default('time::now()'),
  },
});
```

---

## composeSchema()

Combine schemas into a complete database schema.

```typescript
function composeSchema(config: {
  models: Record<string, TableSchema>;
  relations?: Record<string, RelationSchema>;
  functions?: Record<string, FunctionBuilder>;
  analyzers?: Record<string, AnalyzerBuilder>;
  access?: Record<string, AccessBuilder>;
  params?: Record<string, ParamBuilder>;
  sequences?: Record<string, SequenceBuilder>;
  config?: Record<string, ConfigBuilder>;
  comments?: string[];
}): DatabaseSchema;
```

### Example

```javascript
export default composeSchema({
  models: { user: userSchema, post: postSchema },
  relations: { follows: followsRelation },
  functions: { daysSince },
  analyzers: { english: englishAnalyzer },
});
```

---

## Field builders

### Factory functions

| Function | Type | Example |
|----------|------|---------|
| `string()` | `string` | `string().required()` |
| `int()` | `int` | `int().default(0)` |
| `float()` | `float` | `float().range(0, 100)` |
| `decimal()` | `decimal` | `decimal().min(0)` |
| `bool()` | `bool` | `bool().default(true)` |
| `datetime()` | `datetime` | `datetime().default('time::now()')` |
| `duration()` | `duration` | `duration().default('1h')` |
| `uuid()` | `uuid` | `uuid().default('rand::uuid::v7()')` |
| `array(type)` | `array<type>` | `array('string').default([])` |
| `object()` | `object` | `object().flexible()` |
| `record(table)` | `record<table>` | `record('user').required()` |
| `option(type)` | `option<type>` | `option('string')` |
| `geometry()` | `geometry` | `geometry()` |
| `any()` | `any` | `any()` |

### Modifiers

| Method | Description |
|--------|-------------|
| `.required()` | Assert `$value != NONE` |
| `.default(value)` | Static default value |
| `.value(expr)` | Dynamic value expression |
| `.computed(expr)` | Computed on read |
| `.assert(condition)` | Validation assertion |
| `.readonly()` | Cannot be modified |
| `.flexible()` | Accept subtypes |
| `.permissions(rule)` | Field access control |
| `.length(min, max)` | String/array length |
| `.range(min, max)` | Numeric range |
| `.min(n)` | Minimum value |
| `.max(n)` | Maximum value |
| `.reference()` | Foreign key constraint |
| `.onDelete(action)` | Reference delete behavior |

---

## index()

Create an index definition.

```typescript
function index(columns: string[]): IndexBuilder;
```

### Methods

| Method | Description |
|--------|-------------|
| `.unique()` | Unique constraint |
| `.hnsw()` | HNSW vector index |
| `.fulltext()` | Full-text search index |
| `.count()` | Count aggregation index |
| `.dimension(n)` | Vector dimension (HNSW) |
| `.dist(metric)` | Distance metric (HNSW) |
| `.type(vectorType)` | Vector element type (HNSW) |
| `.m(n)` | HNSW M parameter |
| `.m0(n)` | HNSW M0 parameter |
| `.efConstruction(n)` | HNSW build parameter |
| `.analyzer(name)` | Text analyzer (fulltext) |
| `.bm25(k1, b)` | BM25 parameters (fulltext) |
| `.highlights()` | Enable highlighting |
| `.concurrently()` | Non-blocking creation |
| `.where(condition)` | Conditional count |

---

## event()

Create an event (trigger) definition.

```typescript
function event(name: string): EventBuilder;
```

### Methods

| Method | Description |
|--------|-------------|
| `.onCreate()` | Trigger on CREATE |
| `.onUpdate()` | Trigger on UPDATE |
| `.onDelete()` | Trigger on DELETE |
| `.when(condition)` | When condition |
| `.thenDo(action)` | Action to execute |

---

## fn()

Create a function definition.

```typescript
function fn(name: string): FunctionBuilder;
```

### Methods

| Method | Description |
|--------|-------------|
| `.param(name, type)` | Add parameter |
| `.returns(type)` | Return type |
| `.body(code)` | Function body |
| `.permissions(rule)` | Access control |

---

## analyzer()

Create an analyzer definition.

```typescript
function analyzer(name: string): AnalyzerBuilder;
```

### Methods

| Method | Description |
|--------|-------------|
| `.tokenizers([...])` | Tokenizer list |
| `.filters([...])` | Filter list |
| `.function(name)` | Custom tokenizer |

---

## access()

Create an access method definition.

```typescript
function access(name: string): AccessBuilder;
```

### Methods

| Method | Description |
|--------|-------------|
| `.record()` | Record-based auth |
| `.jwt()` | JWT auth |
| `.bearer()` | Bearer token auth |
| `.signup(query)` | Signup logic |
| `.signin(query)` | Signin logic |
| `.session(duration)` | Session length |
| `.token(duration)` | Token TTL |
| `.authenticate(expr)` | Auth check |

---

## param()

Create a parameter definition.

```typescript
function param(name: string): ParamBuilder;
```

### Methods

| Method | Description |
|--------|-------------|
| `.value(expr)` | Parameter value |
| `.permissions(rule)` | Access control |

---

## sequence()

Create a sequence definition.

```typescript
function sequence(name: string): SequenceBuilder;
```

### Methods

| Method | Description |
|--------|-------------|
| `.start(n)` | Starting value |
| `.batch(n)` | Batch size |
| `.timeout(duration)` | Batch timeout |

---

## Common patterns

Predefined helpers for common use cases.

### commonFields (cf)

```javascript
import { cf } from 'smig';

const fields = {
  createdAt: cf.timestamp(),      // datetime().value('time::now()')
  metadata: cf.metadata(),         // option('object')
  tags: cf.tags(),                // option('array<string>')
  owner: cf.owner('user'),        // record('user')
};
```

### commonIndexes (ci)

```javascript
import { ci } from 'smig';

const indexes = {
  primary: ci.primary('user'),
  createdAt: ci.createdAt('user'),
  search: ci.contentSearch('post'),
};
```

### commonEvents (ce)

```javascript
import { ce } from 'smig';

const events = {
  updateTs: ce.updateTimestamp('user'),
  cascade: ce.cascadeDelete('user', 'post', 'authorId'),
};
```

---

## See also

- [Schema reference](../schema-reference/index.md) - Detailed schema options
- [Migration manager](migration-manager.md) - Apply schemas

