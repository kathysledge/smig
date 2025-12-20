# Config

Config definitions control database-level settings, particularly for GraphQL and API configuration.

## What is config for?

SurrealDB can automatically expose your database as a GraphQL API. Config definitions control:

- Which tables are included/excluded
- Which functions are exposed
- API-specific settings

## Creating a config

Use the `config()` function to define a GraphQL configuration:

```typescript
import { config } from 'smig';

const graphqlConfig = config('graphql')
  .graphql()
  .tables('INCLUDE', ['user', 'post', 'comment'])
  .functions('INCLUDE', ['fn::get_user', 'fn::search']);
```

This generates:

```surql
DEFINE CONFIG GRAPHQL
  TABLES INCLUDE user, post, comment
  FUNCTIONS INCLUDE fn::get_user, fn::search;
```

## GraphQL configuration

### Include specific tables

Only expose certain tables:

```typescript
config('graphql')
  .graphql()
  .tables('INCLUDE', ['user', 'post', 'comment'])
```

### Exclude specific tables

Expose all except certain tables:

```typescript
config('graphql')
  .graphql()
  .tables('EXCLUDE', ['_migrations', 'audit_log', 'internal'])
```

### Include functions

Expose specific functions in your GraphQL API:

```typescript
config('graphql')
  .graphql()
  .functions('INCLUDE', ['fn::search_posts', 'fn::get_stats'])
```

### Exclude functions

Hide specific internal functions:

```typescript
config('graphql')
  .graphql()
  .functions('EXCLUDE', ['fn::internal_cleanup', 'fn::admin_only'])
```

## Using GraphQL

Once configured, access your GraphQL endpoint:

```
POST /graphql
```

### Query example

Fetch data with GraphQL:

```graphql
query {
  user(id: "user:alice") {
    name
    email
    posts {
      title
      createdAt
    }
  }
}
```

### Mutation example

Modify data with GraphQL:

```graphql
mutation {
  createPost(input: {
    title: "Hello World"
    content: "My first post"
  }) {
    id
    title
  }
}
```

## Best practices

### Expose only what’s needed

Don’t expose internal tables:

```typescript
config('graphql')
  .graphql()
  .tables('EXCLUDE', [
    '_migrations',   // Internal: migration tracking
    'audit_log',     // Internal: audit trail
    'webhook_queue', // Internal: webhook processing
    'session',       // Security: session data
  ])
```

### Consider a dedicated config per environment

Expose different functions in dev vs production:

```typescript
// Production: minimal exposure
const prodConfig = config('graphql')
  .graphql()
  .tables('INCLUDE', ['user', 'post', 'comment'])
  .functions('INCLUDE', ['fn::search']);

// Development: full access
const devConfig = config('graphql')
  .graphql()
  .tables('EXCLUDE', ['_migrations'])
  .functions('EXCLUDE', []);
```

## Config comments

Document your config’s purpose:

```typescript
const graphqlConfig = config('graphql')
  .graphql()
  .tables('INCLUDE', ['user', 'post'])
  .comment('Public GraphQL API configuration');
```

## Complete example

A full GraphQL setup with tables and functions:

```typescript
import { config, defineSchema, string, composeSchema } from 'smig';

// Tables
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
    title: string().required(),
    content: string(),
  },
});

// Internal tables (not exposed)
const auditLog = defineSchema({
  table: 'audit_log',
  fields: {
    action: string(),
    data: object(),
  },
});

// GraphQL config
const graphqlConfig = config('graphql')
  .graphql()
  .tables('EXCLUDE', ['audit_log', '_migrations'])
  .functions('INCLUDE', ['fn::search_posts'])
  .comment('Expose user and post tables via GraphQL');

export default composeSchema({
  models: { user, post, auditLog },
  configs: [graphqlConfig],
});
```

## Related

- [Tables](/schema-reference/tables) — What gets exposed
- [Functions](/schema-reference/functions) — Exposed as GraphQL resolvers
- [Access](/schema-reference/access) — Authentication for GraphQL
