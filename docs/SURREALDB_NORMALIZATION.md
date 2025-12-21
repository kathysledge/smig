# SurrealDB Field Normalization Guide

> **For AI Agents**: This document explains how SurrealDB normalizes field definitions when storing and returning schema information. Understanding these transformations is critical for building accurate schema comparison and migration tools.

## Overview

When you define a field in SurrealDB and later introspect it via `INFO FOR TABLE`, the returned definition may differ from what you originally wrote. This is because SurrealDB normalizes field definitions to a canonical form.

**smig** must account for these normalizations when comparing schemas to avoid generating spurious migrations.

## Field Type Normalizations

### Numeric Types

| Input | SurrealDB Returns | Notes |
|-------|-------------------|-------|
| `float` with default `3.14` | `DEFAULT "3.14f"` | Float literals get `f` suffix and quotes |
| `int` with default `42` | `DEFAULT 42` | Integers are unquoted |
| `decimal` with default `0.001` | `DEFAULT 0.001dec` or `DEFAULT "0.001"` | May get `dec` suffix |

### String Types

| Input | SurrealDB Returns | Notes |
|-------|-------------------|-------|
| `string` with default `'hello'` | `DEFAULT 'hello'` | Single quotes preserved |
| `string` with default `"hello"` | `DEFAULT "hello"` | Double quotes preserved |

### Boolean Types

| Input | SurrealDB Returns | Notes |
|-------|-------------------|-------|
| `bool` with default `true` | `DEFAULT true` | Lowercase boolean |
| `bool` with default `false` | `DEFAULT false` | Lowercase boolean |

### Optional Types

| Input | SurrealDB Returns | Notes |
|-------|-------------------|-------|
| `option<string>` | `TYPE option<string>` | Preserved as-is |
| `TYPE string` with no ASSERT | `TYPE none \| string` | May be normalized to union |
| `option<record<user>>` | `TYPE option<record<user>>` | Nested generics preserved |

### Literal Types

| Input | SurrealDB Returns | Notes |
|-------|-------------------|-------|
| `literal('a', 'b', 'c')` | `TYPE "a" \| "b" \| "c"` | Uses double quotes |
| `literal('active', 'inactive')` | `TYPE "active" \| "inactive"` | Alphabetical order NOT guaranteed |

**Important**: Quote style in literal types may differ between schema definition and introspection. smig normalizes both to a consistent format for comparison.

## Assertion Normalizations

### Required Fields

| Input | SurrealDB Returns | Notes |
|-------|-------------------|-------|
| `.required()` or `.assert('$value != NONE')` | `ASSERT $value != NONE` | Preserved as-is |
| Multiple `.assert()` calls | Combined with `AND` | `ASSERT (cond1) AND (cond2)` |

### Compound Assertions

```
Input:  .assert('$value >= 0').assert('$value <= 100')
Output: ASSERT ($value >= 0) AND ($value <= 100)
```

## Default Value Normalizations

### Expression Defaults

| Input | SurrealDB Returns | Notes |
|-------|-------------------|-------|
| `.default('time::now()')` | `DEFAULT time::now()` | Function calls unquoted |
| `.default('rand::uuid::v7()')` | `DEFAULT rand::uuid::v7()` | Function calls unquoted |
| `.value('time::now()')` | `VALUE time::now()` | VALUE expressions unquoted |

### Computed Fields (Deferred Evaluation)

| Input | SurrealDB Returns | Notes |
|-------|-------------------|-------|
| `.computed('1 + 1')` | `VALUE { 1 + 1 }` | Wrapped in braces |
| `.computed('$this.a + $this.b')` | `VALUE { $this.a + $this.b }` | Variables preserved |

**Note**: SurrealDB v3 uses `{ }` braces for deferred evaluation. The older `<future> { }` syntax from v2 is deprecated.

## Index Normalizations

### BTREE Indexes

| Input | SurrealDB Returns | Notes |
|-------|-------------------|-------|
| `index(['field']).btree()` | `FIELDS field` | BTREE is implicit (default) |
| `index(['field']).unique()` | `FIELDS field UNIQUE` | UNIQUE after FIELDS |

### HNSW Vector Indexes

| Input | SurrealDB Returns | Notes |
|-------|-------------------|-------|
| `.hnsw().dimension(384)` | `HNSW DIMENSION 384` | Order: HNSW DIMENSION DIST |
| `.dist('COSINE')` | `DIST COSINE` | Distance metric uppercase |
| `.efc(150).m(12)` | `EFC 150 M 12` | Parameters in order |

### MTREE Vector Indexes

| Input | SurrealDB Returns | Notes |
|-------|-------------------|-------|
| `.mtree().dimension(384)` | `MTREE DIMENSION 384` | Similar to HNSW |
| `.capacity(40)` | `CAPACITY 40` | MTREE-specific parameter |

### Full-Text Search Indexes

| Input | SurrealDB Returns | Notes |
|-------|-------------------|-------|
| `.search().analyzer('english')` | `FULLTEXT ANALYZER english` | `SEARCH` → `FULLTEXT` |
| `.highlights()` | `HIGHLIGHTS` | Added after ANALYZER |
| `.bm25(1.2, 0.75)` | `BM25 1.2 0.75` | BM25 parameters |

**Critical**: The schema type uses `SEARCH` but SurrealDB outputs `FULLTEXT` in the definition. smig must translate between these.

## Permission Normalizations

| Input | SurrealDB Returns | Notes |
|-------|-------------------|-------|
| `.permissions('FULL')` | `PERMISSIONS FULL` | Preserved as-is |
| `.permissions('NONE')` | `PERMISSIONS NONE` | Preserved as-is |
| No permissions specified | `PERMISSIONS FULL` | Default is FULL |

## Whitespace and Formatting

SurrealDB normalizes whitespace in definitions:

- Multiple spaces become single spaces
- Leading/trailing whitespace is trimmed
- Newlines in multi-line expressions are preserved within `{ }` blocks

## Identifier Case

| Entity | Case Behavior |
|--------|--------------|
| Table names | Preserved (case-sensitive) |
| Field names | Preserved (case-sensitive) |
| Index names | Preserved (case-sensitive) |
| Type keywords | Uppercase (`TYPE`, `ASSERT`, `DEFAULT`) |
| Type names | Lowercase (`string`, `int`, `bool`) |

## Common Normalization Pitfalls

### 1. Float Default Values

```typescript
// Schema definition
float().default(3.14)

// What smig generates
DEFINE FIELD price ON TABLE product TYPE float DEFAULT 3.14;

// What SurrealDB returns on introspection
DEFINE FIELD price ON TABLE product TYPE float DEFAULT "3.14f";
```

**Solution**: Normalize float defaults by removing `f` suffix and quotes before comparison.

### 2. Literal Type Quote Styles

```typescript
// Schema definition
literal('active', 'pending', 'inactive')

// What smig generates
DEFINE FIELD status ON TABLE order TYPE "active" | "pending" | "inactive";

// What SurrealDB might return
DEFINE FIELD status ON TABLE order TYPE 'active' | 'pending' | 'inactive';
```

**Solution**: Normalize quote styles in union types before comparison.

### 3. Search vs Fulltext

```typescript
// Schema definition
index(['content']).search().analyzer('english')

// What smig must generate
DEFINE INDEX contentSearch ON TABLE post FIELDS content FULLTEXT ANALYZER english;

// NOT: SEARCH ANALYZER english (this is invalid syntax)
```

**Solution**: Always output `FULLTEXT` not `SEARCH` for full-text indexes.

### 4. Optional Type Representations

SurrealDB may represent optional types in two ways:

```sql
-- Form 1: Explicit option<T>
TYPE option<string>

-- Form 2: Union with none
TYPE none | string
```

**Solution**: Normalize both forms to a canonical representation before comparison.

## Normalization Functions in smig

The key normalization logic lives in:

- `src/migrator/comparison/normalize.ts` — Value normalization
- `src/migrator/comparison/field-comparator.ts` — Field comparison
- `src/migrator/introspection/field-parser.ts` — Parsing introspected definitions

### Key Normalization Patterns

```typescript
// Normalize numeric defaults
function normalizeDefault(value: string | number): string {
  if (typeof value === 'number') return String(value);
  // Remove float suffix and quotes
  return value.replace(/^["'](.+?)f?["']$/, '$1');
}

// Normalize type definitions
function normalizeType(type: string): string {
  // Normalize none | T to option<T>
  if (type.match(/^none\s*\|\s*(.+)$/)) {
    return `option<${RegExp.$1.trim()}>`;
  }
  return type.toLowerCase().trim();
}
```

## Testing Normalization

The integration test `tests/integration/field-normalization.test.ts` verifies that:

1. All field types can be migrated successfully
2. After migration, no spurious changes are detected
3. Field modifications are detected correctly
4. Renames with `.was()` generate `ALTER FIELD RENAME`

Run with:

```bash
bun run test:integration -- --run tests/integration/field-normalization.test.ts
```

## References

- [SurrealDB Field Documentation](https://surrealdb.com/docs/surrealql/statements/define/field)
- [SurrealDB Index Documentation](https://surrealdb.com/docs/surrealql/statements/define/index)
- [SurrealDB Type System](https://surrealdb.com/docs/surrealql/datamodel/types)

