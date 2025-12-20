# Examples

Complete schema examples for common use cases.

---

## Available examples

| Example | Description | Highlights |
|---------|-------------|------------|
| [Simple blog](blog.md) | Basic blog with posts and comments | Tables, fields, indexes |
| [Social network](social-network.md) | Users, follows, likes | Relations, events, graph queries |
| [E-commerce](ecommerce.md) | Products, orders, payments | Sequences, computed fields |
| [AI embeddings](ai-embeddings.md) | Vector search with HNSW | Vector indexes, semantic search |

---

## Quick examples

### Minimal schema

```javascript
import { defineSchema, composeSchema, string, bool, datetime, index } from 'smig';

const todoSchema = defineSchema({
  table: 'todo',
  fields: {
    title: string().required(),
    completed: bool().default(false),
    createdAt: datetime().default('time::now()'),
  },
  indexes: {
    completed: index(['completed', 'createdAt']),
  },
});

export default composeSchema({
  models: { todo: todoSchema },
});
```

### With relations

```javascript
import { defineSchema, defineRelation, composeSchema } from 'smig';

const user = defineSchema({
  table: 'user',
  fields: {
    name: string().required(),
    email: string().required(),
  },
});

const post = defineSchema({
  table: 'post',
  fields: {
    author: record('user').required(),
    content: string().required(),
  },
});

const likes = defineRelation({
  name: 'likes',
  from: 'user',
  to: 'post',
  fields: {
    likedAt: datetime().default('time::now()'),
  },
});

export default composeSchema({
  models: { user, post },
  relations: { likes },
});
```

---

## Running examples

Each example can be applied to a fresh SurrealDB instance:

```bash
# Start SurrealDB
surreal start --user root --pass root memory

# Initialize smig with example schema
smig init --schema ./examples/blog-schema.js

# Apply the schema
smig push
```

