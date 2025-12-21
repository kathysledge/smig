# Changelog

All notable changes to **smig** will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0-beta.1] - 2025-12-20

This release consolidates all alpha features into a production-ready beta. Major highlights include native TypeScript support, intelligent ALTER statement generation, and comprehensive SurrealDB 3.x entity support.

### 🎉 TypeScript-first schemas

Define schemas in TypeScript with zero build configuration:

```zsh
bun smig init          # Creates schema.ts
bun smig migrate       # Just works™
```

### ✨ Complete SurrealDB 3.x support

**New field types:** `bytes`, `set`, `range`, `literal`, `nullType`, `number`

**Vector indexes for AI/ML:**

```typescript
embeddingIndex: index(['embedding'])
  .hnsw()
  .dimension(1536)
  .dist('COSINE')
```

**New entities:** `access`, `user`, `param`, `sequence`, `model`, `config`, `analyzer`

### 🔄 Smart ALTER statement generation

**smig** now generates minimal, targeted schema changes:

```sql
-- Before: full redefinition
DEFINE FIELD OVERWRITE email ON TABLE user TYPE string DEFAULT 'new@example.com';

-- Now: targeted change
ALTER FIELD email ON TABLE user DEFAULT 'new@example.com';
```

### 🏷️ Rename tracking with `.was()`

Safe renames that preserve data:

```typescript
fullName: string().was('name'),  // → ALTER FIELD name RENAME TO fullName
```

### 🖥️ CLI improvements

- `bun smig validate` - Check schema without database connection
- `bun smig diff` - Preview migration SQL
- `bun smig migrate --dry-run` - Simulate migration
- Enhanced `init` template with vectors, auth, functions, and analyzers

### 📦 Architecture

Complete modular rewrite with 500+ tests, comprehensive introspection, and VitePress documentation.

---

## [1.0.0-alpha.1] - 2025-12-18

### 🚀 SurrealDB 3 compatibility

First release with full SurrealDB 3 support.

### ✨ New features

- **SurrealDB 3 SDK**: Updated to use the new `surrealdb` v2 JavaScript SDK
- **Simplified schema definition**: Tables are now schemafull by default
- **Multiple event statements**: Events can contain multiple statements in `{ }`
- **Comprehensive integration tests**: Added thorough testing

### 💥 Breaking changes from v0.x

#### Schema definition API

```typescript
// v0.x - had to specify schemafull
defineSchema({ table: 'user', schemafull: true, fields: { ... } })

// v1.x - schemafull by default
defineSchema({ table: 'user', fields: { ... } })

// For schemaless:
defineSchema({ table: 'logs', schemaless: true, fields: { ... } })
```

#### SurrealQL syntax changes

```typescript
// Regex validation
// v0.x: '$value ~ /pattern/'
// v1.x: 'string::matches($value, /pattern/)'

// Function naming
// v0.x: 'string::is::email($value)'
// v1.x: 'string::is_email($value)'

// Computed fields
// v0.x: VALUE <future> { ... }
// v1.x: VALUE { ... }
```

### 🧪 Testing

- 215 unit tests passing
- 30 integration tests passing

---

## Upgrade guide

### From v0.x to v1.x

1. **Update dependencies**
   ```zsh
   bun install smig@latest
   ```

2. **Remove `schemafull: true`** (now default)

3. **Replace `schemafull: false`** with `schemaless: true`

4. **Update regex validations**
   ```typescript
   // Before: .assert('$value ~ /pattern/')
   // After:  .assert('string::matches($value, /pattern/)')
   ```

5. **Update function names**
   ```typescript
   // Before: string::is::email
   // After:  string::is_email
   ```

6. **Test your migrations**
   ```zsh
   bun smig diff
   bun smig migrate
   ```

### From alpha to beta

No breaking changes! Just update and enjoy:

```zsh
bun install smig@latest
```

**Note:** Schema files now default to `.ts` instead of `.js`.

---

## Need help?

- 📖 [Documentation](https://smig.build/)
- 🐛 [Report issues](https://github.com/kathysledge/smig/issues)
- 💬 [Discussions](https://github.com/kathysledge/smig/discussions)
