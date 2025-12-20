<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github.com/kathysledge/smig/raw/main/media/smig-logo-dark.svg">
  <img alt="smig 'S' logo" src="https://github.com/kathysledge/smig/raw/main/media/smig-logo-light.svg">
</picture>

### SurrealDB schema management with automatic migrations

[![npm version](https://badge.fury.io/js/smig.svg)](https://badge.fury.io/js/smig)
[![License: ISC](https://img.shields.io/badge/License-ISC-violet.svg)](https://opensource.org/license/isc-license-txt)

> [!NOTE]
> This is the `1.x` version of **smig** for SurrealDB 3. For SurrealDB 2, use version `0.x` ([view README](https://github.com/kathysledge/smig/blob/v0.x/README.md)).

---

**smig** is the first library to provide **automatic migration generation** for SurrealDB. Define your schema once using a type-safe API, and let **smig** handle the rest.

📖 **[Full documentation →](docs/index.md)**

---

## Installation

```bash
# Bun (recommended)
bun add -D smig

# npm
npm install -D smig

# pnpm
pnpm add -D smig
```

## Quick start

```bash
# Initialize project
smig init

# Generate migration
smig diff --message "Initial schema"

# Apply to database
smig push
```

## Example schema

```javascript
import { defineSchema, composeSchema, string, bool, datetime, record, index } from 'smig';

const userSchema = defineSchema({
  table: 'user',
  fields: {
    email: string().required().assert('string::is_email($value)'),
    name: string().required(),
    isActive: bool().default(true),
    createdAt: datetime().default('time::now()'),
  },
  indexes: {
    email: index(['email']).unique(),
  },
});

const postSchema = defineSchema({
  table: 'post',
  fields: {
    author: record('user').required(),
    title: string().required(),
    content: string().required(),
    embedding: array('float'),  // For AI/vector search
    createdAt: datetime().default('time::now()'),
  },
  indexes: {
    author: index(['author', 'createdAt']),
    // HNSW vector index for semantic search
    semantic: index(['embedding']).hnsw().dimension(1536).dist('cosine'),
    // Full-text search
    search: index(['title', 'content']).fulltext().analyzer('english'),
  },
});

export default composeSchema({
  models: { user: userSchema, post: postSchema },
});
```

## Features

| Feature | Description |
|---------|-------------|
| **Automatic migration generation** | No more writing SurrealQL diffs by hand |
| **Bidirectional migrations** | Auto-generated rollback scripts |
| **Type-safe schema definition** | Full TypeScript intellisense |
| **All field types** | String, int, float, datetime, uuid, array, record, geometry |
| **Advanced indexes** | Unique, HNSW vector search, full-text with BM25 |
| **Graph relations** | First-class support for relation tables |
| **Events & triggers** | Business logic automation |
| **Custom functions** | Reusable database functions |
| **Authentication** | Access methods with SIGNUP/SIGNIN |
| **Full-text search** | Custom analyzers with tokenizers and filters |
| **Mermaid diagrams** | Auto-generate ER diagrams |

## CLI commands

| Command | Description |
|---------|-------------|
| `smig init` | Initialize a new project |
| `smig diff` | Generate migration from schema changes |
| `smig push` | Apply pending migrations |
| `smig status` | Show migration status |
| `smig rollback` | Undo the last migration |
| `smig mermaid` | Generate ER diagram |

## Documentation

- **[Getting started](docs/getting-started/index.md)** — Installation and first migration
- **[Guides](docs/guides/index.md)** — Schema design, CLI, best practices
- **[Schema reference](docs/schema-reference/index.md)** — Tables, fields, indexes, events
- **[API reference](docs/api-reference/index.md)** — Programmatic API
- **[Examples](docs/examples/index.md)** — Blog, social network, e-commerce, AI embeddings

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
git clone git@github.com:kathysledge/smig.git
cd smig
bun install
bun run test
```

## Security

For security concerns, email chris@chwd.ca or open a private security advisory on GitHub.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

## License

ISC © [Chris Harris](https://github.com/kathysledge)

---

<a href="https://ko-fi.com/kathysledge">
  <img alt="Buy me a coffee" width="420" src="https://github.com/kathysledge/smig/raw/main/media/buy-me-a-coffee-button.avif">
</a>
