# Examples

Complete, working schemas for common applications. Each example is ready to copy and adapt for your own projects.

## Application examples

### [Simple blog](/examples/blog)

A straightforward blog with:
- Users, posts, and comments
- Full-text search on content
- Basic permissions

Good for learning the fundamentals.

### [Social network](/examples/social-network)

A Twitter-like application featuring:
- User profiles and follows (graph relations)
- Posts, likes, and comments
- Feed generation
- Notifications

Good for understanding graph relations and events.

### [E-commerce](/examples/ecommerce)

An online store with:
- Products, categories, and inventory
- Shopping cart and orders
- User reviews
- Order status tracking

Good for understanding business logic and sequences.

## Advanced examples

### [AI embeddings](/examples/ai-embeddings)

Semantic search with vector embeddings:
- OpenAI/Cohere embedding storage
- HNSW vector indexes
- Hybrid search (vector + full-text)
- Recommendation system

Good for AI/ML applications.

## How to use these examples

### Quick start

1. Copy the schema code into your `schema.ts`
2. Run `bun smig migrate`
3. Start building your application

### Adapting for your needs

Each example includes comments explaining design decisions. Feel free to:
- Remove features you don't need
- Add fields for your use case
- Change field types or validation

### Combining examples

You can merge patterns from different examples:

```typescript
import { composeSchema } from 'smig';
import { userSchema, postSchema } from './blog';
import { productSchema, orderSchema } from './ecommerce';
import { embeddingSchema } from './ai';

export default composeSchema({
  models: {
    ...blogModels,
    ...ecommerceModels,
    ...aiModels,
  },
  relations: { ... },
});
```

## Request an example

Don't see what you're looking for? [Open a discussion](https://github.com/kathysledge/smig/discussions) and tell us what you're building. We'd love to add more examples.
