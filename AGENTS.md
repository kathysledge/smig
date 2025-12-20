# smig — AI Agent Context Guide

> **What is this file?** This document provides instant context for AI coding assistants (Claude, Copilot, Cursor, Cody, etc.) working on the **smig** codebase. It's designed to be read at the start of a session so the AI understands the project architecture, conventions, and current state without needing to explore the entire codebase.

## Project overview

**smig** (always lowercase, always in **bold** in Markdown) is a TypeScript library for automatic SurrealDB 3.x schema migrations. Users define their database schema using a type-safe DSL, and smig generates the SurrealQL needed to migrate the database to match.

**Key value proposition**: First and only tool providing automatic migration generation for SurrealDB.

## Technology stack

- **Runtime**: Bun (recommended) or Node.js 18+
- **Language**: TypeScript (strict mode)
- **Database**: SurrealDB 3.x (not 2.x)
- **Build**: Vite for bundling, tsc for declarations
- **Testing**: Vitest (unit + integration)
- **Documentation**: VitePress (dark mode only)
- **Linting**: Biome

## Directory structure

```
src/
├── cli.ts                    # CLI entry point (Commander.js)
├── index.ts                  # Public API exports
├── database/
│   └── surreal-client.ts     # SurrealDB connection wrapper
├── generators/               # SurrealQL generation
│   ├── alter.ts              # ALTER statements (32 generators)
│   ├── field.ts              # DEFINE FIELD
│   ├── table.ts              # DEFINE TABLE
│   ├── index-gen.ts          # DEFINE INDEX (all types)
│   └── ...                   # Other entity generators
├── migrator/
│   ├── migration-manager.ts  # Core migration logic (~3000 lines)
│   ├── diff-generator.ts     # Schema comparison → SQL
│   ├── mermaid-generator.ts  # ER diagram generation
│   ├── introspection/        # Parse SurrealDB INFO results
│   └── comparison/           # Field/index/entity comparison
├── schema/
│   ├── fields/               # Field type builders
│   │   ├── base.ts           # SurrealQLFieldBase class
│   │   ├── primitives.ts     # string(), int(), bool(), etc.
│   │   └── complex.ts        # array(), record(), set(), option()
│   ├── indexes/              # Index builder (BTREE, HNSW, MTREE, SEARCH)
│   ├── entities/             # Entity builders (fn, analyzer, access, etc.)
│   ├── factories.ts          # Field factory functions
│   └── compose.ts            # composeSchema() function
├── types/
│   └── schema.ts             # TypeScript interfaces
└── utils/
    ├── config-loader.ts      # smig.config.ts loading
    └── debug-logger.ts       # Debug logging utility

docs/                         # VitePress documentation
tests/                        # Vitest test files
examples/                     # Example schema files
```

## Core concepts

### Schema definition flow

```
User TypeScript → defineSchema() → composeSchema() → SurrealDBSchema object
                                                              ↓
SurrealDB ← execute SQL ← MigrationManager.migrate() ← generateDiff()
```

### Key classes and functions

| Component | Purpose |
|-----------|---------|
| `defineSchema()` | Define a single table with fields, indexes, events |
| `defineRelation()` | Define a graph relation (edge table) |
| `composeSchema()` | Combine tables, relations, functions, etc. |
| `MigrationManager` | Connect to DB, generate diffs, apply migrations |
| `DiffGenerator` | Compare schemas, generate up/down SQL |

### Field builder pattern

All field types use a fluent builder pattern:

```typescript
string()              // Create builder
  .required()         // Add ASSERT $value != NONE
  .default('value')   // Add DEFAULT
  .assert('...')      // Add custom ASSERT
  .comment('...')     // Add COMMENT
  .was('oldName')     // Track rename
  .build()            // Return field definition object
```

### Index types

| Type | Use case | Key options |
|------|----------|-------------|
| BTREE | Default, sorted data | `.unique()` |
| HNSW | AI vector search (high-dim) | `.dimension()`, `.dist()`, `.efc()`, `.m()` |
| MTREE | Vector search (low-dim) | `.dimension()`, `.dist()`, `.capacity()` |
| SEARCH | Full-text search | `.analyzer()`, `.highlights()`, `.bm25()` |

### ALTER statement strategy

When generating migrations, smig uses this strategy:

- **1–3 property changes**: Individual `ALTER` statements
- **4+ property changes**: Full `DEFINE OVERWRITE`

This minimizes SQL while keeping migrations readable.

## CLI commands

| Command | Description |
|---------|-------------|
| `bun smig init` | Create schema.ts template |
| `bun smig diff` | Preview migration SQL |
| `bun smig migrate` | Apply migration to database |
| `bun smig migrate --dry-run` | Preview without applying |
| `bun smig status` | Show migration history |
| `bun smig rollback` | Undo last migration |
| `bun smig validate` | Check schema without DB |
| `bun smig mermaid` | Generate ER diagram |

## SurrealDB 3.x specifics

### Key syntax differences from 2.x

- `TYPE NORMAL` instead of just table name
- `SCHEMAFULL` is default (use `SCHEMALESS` to opt out)
- `string::is_email()` not `string::is::email()`
- `VALUE { ... }` not `VALUE <future> { ... }`
- `ALTER` statements for modifications
- `ACCESS` instead of `SCOPE` for authentication

### Full-text search syntax

```surql
DEFINE INDEX name ON TABLE t FIELDS f SEARCH ANALYZER analyzer_name HIGHLIGHTS;
```

Note: SEARCH indexes only support single columns.

### Vector index syntax

```surql
-- HNSW (high-dimensional)
DEFINE INDEX name ON TABLE t FIELDS f HNSW DIMENSION 1536 DIST COSINE;

-- MTREE (low-dimensional)
DEFINE INDEX name ON TABLE t FIELDS f MTREE DIMENSION 3 DIST EUCLIDEAN CAPACITY 40;
```

## Testing

### Unit tests

```bash
bun run test              # Run all unit tests
bun run test:watch        # Watch mode
```

### Integration tests

```bash
bun run test:integration  # Requires running SurrealDB
```

Integration tests start SurrealDB instances per-test. They're in `tests/integration/`.

### Test file naming

- `*.test.ts` — Unit tests
- `tests/integration/*.test.ts` — Integration tests

## Code style

### TypeScript

- Strict mode enabled
- Prefer `interface` over `type` for object shapes
- Use `unknown` over `any` where possible
- Explicit return types on public functions

### Naming conventions

- Classes: `PascalCase` (e.g., `SurrealQLField`)
- Functions: `camelCase` (e.g., `generateFieldDefinition`)
- Constants: `SCREAMING_SNAKE_CASE` (e.g., `FIELD_PATTERNS`)
- Files: `kebab-case.ts` (e.g., `diff-generator.ts`)

### Documentation

- Use curly quotes (“ ” ‘ ’) in prose, straight quotes in code
- First SQL mention on each page: "SurrealQL (SQL)"
- Always `bun smig` not just `smig` in command examples
- Schema files are `.ts` (TypeScript-first)

## Current state (v1.0.0-beta.1)

### What's implemented

- ✅ All SurrealDB 3.x field types
- ✅ All index types (BTREE, HNSW, MTREE, SEARCH)
- ✅ Graph relations with `defineRelation()`
- ✅ 32 ALTER statement generators
- ✅ Rename tracking with `.was()`
- ✅ Functions, analyzers, access, params, sequences
- ✅ Native TypeScript schema loading (jiti)
- ✅ Bidirectional migrations (up + down)
- ✅ VitePress documentation with SurrealQL syntax highlighting

### Known limitations

- SEARCH indexes only support single columns (SurrealDB limitation)
- `set<T, min, max>` bounds not supported by SurrealDB 3.x
- Some optional field introspection edge cases with `none | T`

## Common tasks

### Adding a new field type

1. Add builder class in `src/schema/fields/`
2. Export from `src/schema/fields/index.ts`
3. Add factory function in `src/schema/factories.ts`
4. Export from `src/index.ts`
5. Add tests in `tests/`
6. Document in `docs/schema-reference/fields.md`

### Adding a new generator

1. Create file in `src/generators/`
2. Export from `src/generators/index.ts`
3. Integrate with `diff-generator.ts` if needed
4. Add tests

### Modifying CLI

1. Edit `src/cli.ts`
2. Update help text and examples
3. Rebuild: `bun run build`
4. Test: `./dist/cli.js <command>`

## Build commands

```bash
bun run build        # Build dist/
bun run dev          # Watch mode
bun run lint         # Biome check
bun run test         # Run tests
bun run docs:dev     # VitePress dev server
bun run docs:build   # Build documentation
```

## Important files

| File | Purpose |
|------|---------|
| `src/migrator/migration-manager.ts` | Core migration logic |
| `src/migrator/diff-generator.ts` | Schema diffing |
| `src/cli.ts` | CLI commands and init template |
| `src/index.ts` | Public API exports |
| `docs/.vitepress/config.ts` | Documentation config |
| `docs/.vitepress/languages/surql.tmLanguage.json` | SurrealQL syntax highlighting |

## Links

- **Documentation**: https://smig.build/
- **GitHub**: https://github.com/kathysledge/smig
- **npm**: https://www.npmjs.com/package/smig
