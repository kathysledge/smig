# Changelog for the `main` branch (SurrealDB 3 compatible)

All notable changes to **smig** will be documented in this file.

## [1.0.0] - 2025-XX-XX

### 🎉 Full SurrealDB 3 feature parity

This release brings **smig** to complete feature parity with SurrealDB 3's schema definition capabilities. Every DEFINE statement type, every option, every modifier is now supported.

---

### ✨ New schema features

#### Vector search with HNSW indexes

Full support for HNSW (Hierarchical Navigable Small World) vector indexes for AI/ML applications:

```javascript
indexes: {
  semantic: index(['embedding'])
    .hnsw()
    .dimension(1536)
    .dist('cosine')
    .type('f32')
    .m(16)
    .m0(32)
    .efConstruction(100)
    .lm(0.4)
    .extendCandidates()
    .keepPrunedConnections(),
}
```

**Supported distance metrics:** `euclidean`, `cosine`, `manhattan`, `chebyshev`, `hamming`, `jaccard`, `minkowski`, `pearson`

**Supported vector types:** `f64`, `f32`, `i64`, `i32`, `i16`

#### Enhanced full-text search

Complete SEARCH index configuration with BM25 scoring and highlighting:

```javascript
indexes: {
  content: index(['title', 'body'])
    .search()
    .analyzer('english')
    .bm25(1.2, 0.75)
    .highlights()
    .orderQs()
    .orderDocIds()
    .orderDocLens()
    .postingsCache(1000000)
    .termsCache(1000000)
    .docIdsCache(1000000)
    .docLensCache(1000000),
}
```

#### MTREE indexes for spatial data

```javascript
indexes: {
  location: index(['coordinates'])
    .mtree()
    .dimension(2)
    .dist('euclidean')
    .type('f64')
    .capacity(100),
}
```

#### Sequences for auto-increment values

```javascript
import { sequence } from 'smig';

const orderNumber = sequence('order_number')
  .start(10000)
  .batch(100)
  .timeout('5m');

// Use in field defaults
fields: {
  orderNumber: int().default('sequence::next("order_number")'),
}
```

#### Foreign key references

Full referential integrity support with ON DELETE actions:

```javascript
fields: {
  author: record('user')
    .required()
    .reference()
    .onDelete('cascade'),  // cascade | reject | ignore | unset
}
```

#### API definitions

Define custom HTTP API endpoints:

```javascript
import { api } from 'smig';

const usersApi = api('users')
  .method('GET')
  .path('/api/users/:id')
  .handler('SELECT * FROM user WHERE id = $id')
  .cors(['https://app.example.com'])
  .middleware(['auth']);
```

#### GraphQL configuration

```javascript
import { config } from 'smig';

const graphqlConfig = config()
  .graphql()
  .tables('include', ['user', 'post', 'comment'])
  .functions('include', ['get_stats', 'search']);
```

#### Bearer access methods

```javascript
import { access } from 'smig';

const apiKeyAccess = access('api_key')
  .bearer()
  .forUser()
  .session('365d');
```

#### Model definitions (ML)

```javascript
import { model } from 'smig';

const sentimentModel = model('sentiment')
  .version('1.0.0')
  .comment('Sentiment analysis model');
```

---

### 🔄 ALTER statement support

**smig** now uses SurrealDB 3's `ALTER` statements for modifications instead of `DEFINE ... OVERWRITE`, enabling more efficient and safer schema changes:

```sql
-- Before (v1.0.0-alpha)
DEFINE FIELD email ON TABLE user TYPE string OVERWRITE;

-- Now (v1.0.0)
ALTER FIELD email ON TABLE user TYPE string;
```

This provides:
- **Atomic modifications** without recreating entities
- **Better performance** for large tables
- **Safer migrations** that preserve data

---

### 🏷️ Entity and field renaming

#### Renaming tables

Use the `was` property to track previous table names:

```javascript
const userSchema = defineSchema({
  table: 'account',      // New name
  was: 'user',           // Previous name (string or array)
  fields: { ... },
});

// Or for multiple renames in history:
const userSchema = defineSchema({
  table: 'account',
  was: ['user', 'member'],  // Oldest to most recent
  fields: { ... },
});
```

**Generated migration:**

```sql
-- Rename table
ALTER TABLE user RENAME TO account;
```

#### Renaming fields

Use the `.was()` modifier to track previous field names:

```javascript
fields: {
  emailAddress: string()
    .was('email')         // Renamed from 'email'
    .required(),
    
  displayName: string()
    .was(['name', 'fullName'])  // Multiple renames
    .required(),
}
```

**Generated migration:**

```sql
-- Rename fields
ALTER FIELD email ON TABLE user RENAME TO emailAddress;
ALTER FIELD fullName ON TABLE user RENAME TO displayName;
```

#### How rename tracking works

1. **On `smig diff`**: Compares current schema with database state
2. **Detects renames**: If a field/table exists in `was` but not in current DB, generates RENAME
3. **Cleans up history**: After successful migration, `was` values are recorded in migration metadata
4. **Safe fallback**: If the old name doesn't exist, treats as a new entity (no error)

---

### 🖥️ CLI improvements

#### Renamed commands

| Old command | New command | Description |
|-------------|-------------|-------------|
| `smig generate` | `smig diff` | Generate migration from schema changes |
| `smig migrate` | `smig push` | Apply pending migrations |
| `smig config` | `smig status` | Show current status and configuration |

#### New commands

| Command | Description |
|---------|-------------|
| `smig init` | Initialize a new project with starter files |
| `smig rollback` | Undo the last migration (unchanged) |
| `smig mermaid` | Generate ER diagram (unchanged) |

#### Command usage

```bash
# Initialize new project
smig init

# Generate migration
smig diff

# Apply migrations
smig push

# Check status
smig status

# Rollback
smig rollback

# Rollback multiple
smig rollback --steps 3

# Generate ER diagram
smig mermaid --output schema.mmd
```

---

### 📊 Additional table options

```javascript
defineSchema({
  table: 'session',
  
  // Table type
  type: 'normal',        // normal | any
  
  // Schema mode (default: schemafull)
  schemaless: false,
  
  // Auto-delete after duration
  drop: true,
  
  // Change data capture
  changefeed: {
    expiry: '7d',
    includeOriginal: true,
  },
  
  // Documentation
  comment: 'User session records',
  
  // Conditional creation
  ifNotExists: true,
  
  fields: { ... },
});
```

#### Relation options

```javascript
defineRelation({
  name: 'follows',
  from: 'user',
  to: 'user',
  
  // Enforce referential integrity
  enforced: true,
  
  // Multiple target tables
  to: ['user', 'organization'],
  
  fields: { ... },
});
```

---

### 📝 Additional field options

```javascript
fields: {
  // Readonly fields
  id: uuid()
    .default('rand::uuid::v7()')
    .readonly(),
  
  // Flexible typing
  metadata: object()
    .flexible(),
  
  // Field comments
  email: string()
    .required()
    .comment('Primary contact email'),
  
  // Permissions
  salary: decimal()
    .permissions('FOR select WHERE $auth.role = "hr"'),
}
```

---

### 🔍 Additional index options

```javascript
indexes: {
  // Concurrent creation (non-blocking)
  email: index(['email']).unique().concurrently(),
  
  // Conditional count index
  activeUsers: index(['role']).count().where('isActive = true'),
  
  // Index comments
  search: index(['content']).search().comment('Full-text search index'),
}
```

---

### 🎭 Enhanced event options

```javascript
events: {
  auditLog: event('audit_log')
    .onUpdate()
    .when('$before != $after')
    .thenDo('CREATE audit_log SET ...')
    .comment('Audit trail for all changes'),
}
```

---

### 🔤 Enhanced analyzer options

Full tokenizer and filter support:

```javascript
analyzer('code_search')
  .tokenizers(['blank', 'class', 'camel', 'punct'])
  .filters([
    'lowercase',
    'ascii',
    'snowball(english)',
    'edgengram(2, 15)',
    'ngram(3, 5)',
  ])
  .function('custom_tokenizer')
  .comment('Analyzer for code search');
```

---

### 🔐 Enhanced access options

```javascript
access('account')
  .record()
  .signup('CREATE user SET ...')
  .signin('SELECT * FROM user WHERE ...')
  .authenticate('$auth.isActive = true')
  .session('7d')
  .token('1h')
  .grant('30d')
  .issuer({
    alg: 'RS256',
    key: 'private_key_here',
  })
  .comment('User account authentication');
```

---

### 📚 Documentation website

New comprehensive documentation site built with VitePress:

- **Getting started** — Quick start, installation, first migration
- **Guides** — Schema design, migrations, CLI, multi-environment, best practices
- **Schema reference** — Complete reference for all entity types
- **API reference** — Programmatic API documentation
- **Examples** — Blog, social network, e-commerce, AI embeddings

```bash
bun run docs:dev    # Start documentation server
bun run docs:build  # Build for production
```

---

### 📈 Coverage improvement

| Category | Before | After |
|----------|--------|-------|
| DEFINE statements | 41% (7/17) | 94% (16/17)* |
| Table options | 22% (2/9) | 100% (9/9) |
| Field options | 50% (5/10) | 100% (10/10) |
| Index types | 20% (1/5) | 100% (5/5) |
| Index options | 13% (2/15+) | 100% (15+/15+) |
| Event options | 80% (4/5) | 100% (5/5) |
| Analyzer options | 60% (3/5) | 100% (5/5) |
| **Overall** | **~35%** | **~97%** |

*DEFINE NAMESPACE and DEFINE DATABASE are intentionally not supported as they're typically managed outside application schemas.

---

### 💥 Breaking changes from v1.0.0-alpha.1

#### CLI command renames

```bash
# Before (alpha)
smig generate
smig migrate

# After (1.0.0)
smig diff
smig push
```

Update any scripts or CI/CD pipelines that use the old command names.

---

### 🧪 Testing

- 280+ unit tests passing
- 45+ integration tests passing
- Full coverage for all new features
- Rename migration tests
- ALTER statement tests

---

## [1.0.0-alpha.1] - 2025-12-18

### 🚀 SurrealDB 3 compatibility

This is the first release of **smig** with full SurrealDB 3 support. This is a major update that includes breaking changes from the v0.x branch.

### ✨ New features

- **SurrealDB 3 SDK**: Updated to use the new `surrealdb` v2 JavaScript SDK for connecting to SurrealDB 3 servers
- **Simplified schema definition**: The `schemafull` property has been replaced with `schemaless` - tables are now schemafull by default, so you only need to specify `schemaless: true` for flexible tables
- **Multiple event statements**: Events can now contain multiple SurrealQL statements wrapped in curly braces `{ stmt1; stmt2; }`
- **Comprehensive integration tests**: Added thorough testing for all example schemas and a comprehensive schema covering every entity type

### 💥 Breaking changes

#### Schema definition API

**`schemafull` renamed to `schemaless`**

The property has been inverted for a better developer experience - most tables are schemafull, so you no longer need to specify it:

```javascript
// v0.x (old)
const userSchema = defineSchema({
  table: 'user',
  schemafull: true,  // Had to specify this
  fields: { ... }
});

// v1.x (new) - schemafull by default
const userSchema = defineSchema({
  table: 'user',
  fields: { ... }
});

// For schemaless tables:
const flexibleSchema = defineSchema({
  table: 'logs',
  schemaless: true,  // Only specify when you want schemaless
  fields: { ... }
});
```

#### SurrealQL syntax changes

**Regex validation**

```javascript
// v0.x (old) - tilde operator
email: string().assert('$value ~ /^[^@]+@[^@]+\\.[^@]+$/')

// v1.x (new) - string::matches function
email: string().assert('string::matches($value, /^[^@]+@[^@]+\\.[^@]+$/)')

// Or use the built-in validator:
email: string().assert('string::is_email($value)')
```

**Function naming**

```javascript
// v0.x (old) - double colons
.assert('string::is::email($value)')
.assert('string::is::alphanum($value)')

// v1.x (new) - underscores
.assert('string::is_email($value)')
.assert('string::is_alphanum($value)')
```

**Computed fields**

```javascript
// v0.x (old) - <future> syntax
'votes.score': int().computed('array::len(votes.positive) - array::len(votes.negative)')
// Generated: VALUE <future> { ... }

// v1.x (new) - direct brace syntax
'votes.score': int().computed('array::len(votes.positive) - array::len(votes.negative)')
// Generated: VALUE { ... }
```

**Field permissions**

```javascript
// v0.x (old) - DELETE allowed on fields
.permissions('FOR select WHERE true FOR create, update, delete WHERE $auth.id = id')

// v1.x (new) - DELETE only allowed on tables, not fields
.permissions('FOR select WHERE true FOR create, update WHERE $auth.id = id')
```

### 🔧 Internal improvements

- **Enhanced normalization**: Improved comparison logic for schema diffs to handle SurrealDB 3's output formatting:
  - Type normalization: `none | string` ↔ `option<string>`
  - Assert parentheses normalization for complex conditions
  - Duration normalization: `1w` ↔ `7d`
  - Quote normalization in array literals
  - Function body comparison with arithmetic expression handling
- **Array element field handling**: Auto-generated `field.*` entries are now correctly ignored during comparison
- **Permissions normalization**: Handles `PERMISSIONS FULL` default and `DELETE` deprecation on fields

### 📦 Dependencies

- Updated `surrealdb` package to v2 SDK for SurrealDB 3 connectivity
- All existing dependencies remain compatible

### 🧪 Testing

- 215 unit tests passing
- 30 integration tests passing (requires SurrealDB 3.x)
- Added `example-schemas.test.ts` for testing all example schema migrations
- Added `comprehensive-schema.test.ts` for full entity coverage testing

### 🔮 Coming in v1.0.0 final

- **ALTER statement support**: SurrealDB 3 introduces `ALTER TABLE` and `ALTER FIELD` statements for more efficient schema modifications.
- **Field and table renaming**: Support for renaming fields and tables without data loss using SurrealDB 3's new rename capabilities.

---

## Upgrade guide from v0.x to v1.x

### Step 1: Update your dependencies

```bash
bun install -D smig@next
```

### Step 2: Update schema definitions

1. **Remove `schemafull: true`** - it's now the default:
   ```javascript
   // Before
   defineSchema({ table: 'user', schemafull: true, fields: { ... } })
   
   // After
   defineSchema({ table: 'user', fields: { ... } })
   ```

2. **Replace `schemafull: false` with `schemaless: true`**:
   ```javascript
   // Before
   defineSchema({ table: 'logs', schemafull: false, fields: { ... } })
   
   // After
   defineSchema({ table: 'logs', schemaless: true, fields: { ... } })
   ```

### Step 3: Update regex validations

Replace tilde operators with `string::matches()`:

```javascript
// Before
.assert('$value ~ /^[a-zA-Z0-9_]{3,20}$/')

// After
.assert('string::matches($value, /^[a-zA-Z0-9_]{3,20}$/)')
```

### Step 4: Update function names

Replace double colons with underscores in function paths:

| v0.x (old) | v1.x (new) |
|------------|------------|
| `string::is::email` | `string::is_email` |
| `string::is::alphanum` | `string::is_alphanum` |
| `string::is::numeric` | `string::is_numeric` |
| `string::is::alpha` | `string::is_alpha` |
| `string::is::ascii` | `string::is_ascii` |
| `string::is::datetime` | `string::is_datetime` |
| `string::is::domain` | `string::is_domain` |
| `string::is::ip` | `string::is_ip` |
| `string::is::url` | `string::is_url` |
| `string::is::uuid` | `string::is_uuid` |

### Step 5: Update field permissions

Remove `delete` from field-level permissions (it's only valid on tables):

```javascript
// Before
.permissions('FOR select, create, update, delete WHERE $auth.id = id')

// After
.permissions('FOR select, create, update WHERE $auth.id = id')
```

### Step 6: Test your migrations

```bash
# Generate a diff to see what changes would be made
bun smig generate

# Apply the migration
bun smig migrate
```

### Need help?

If you encounter issues during the upgrade, please:
1. Check the [FAQ](https://github.com/kathysledge/smig#faq) in the README
2. Open an [issue](https://github.com/kathysledge/smig/issues) on GitHub
