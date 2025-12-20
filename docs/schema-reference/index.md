# Schema reference

Complete reference for all **smig** schema definitions.

---

## Core concepts

| Concept | Description | Link |
|---------|-------------|------|
| Tables | Define data structures with fields, indexes, and events | [Tables](tables.md) |
| Fields | Column definitions with types, defaults, and validation | [Fields](fields.md) |
| Indexes | Performance optimization and constraints | [Indexes](indexes.md) |
| Events | Triggers for business logic automation | [Events](events.md) |
| Relations | Graph edges between records | [Relations](relations.md) |

---

## Extended features

| Feature | Description | Link |
|---------|-------------|------|
| Functions | Reusable database functions | [Functions](functions.md) |
| Analyzers | Full-text search configuration | [Analyzers](analyzers.md) |
| Access | Authentication and authorization | [Access](access.md) |
| Params | Global database parameters | [Params](params.md) |
| Sequences | Auto-increment values | [Sequences](sequences.md) |
| Config | GraphQL and API configuration | [Config](config.md) |

---

## Quick examples

### Table with fields and indexes

```javascript
import { defineSchema, string, datetime, bool, index } from 'smig';

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
```

### Relation with attributes

```javascript
import { defineRelation, datetime, int } from 'smig';

const likesRelation = defineRelation({
  name: 'likes',
  from: 'user',
  to: 'post',
  fields: {
    likedAt: datetime().default('time::now()'),
    weight: int().default(1),
  },
});
```

### Composing a schema

```javascript
import { composeSchema, fn, analyzer, access } from 'smig';

export default composeSchema({
  models: { user: userSchema, post: postSchema },
  relations: { likes: likesRelation },
  functions: { daysSince: daysSinceFunction },
  analyzers: { english: englishAnalyzer },
  access: { account: accountAccess },
});
```

---

## SurrealQL mapping

| smig API | SurrealQL generated |
|----------|---------------------|
| `defineSchema({ table: 'user' })` | `DEFINE TABLE user TYPE NORMAL SCHEMAFULL` |
| `string().required()` | `TYPE string ASSERT $value != NONE` |
| `index(['email']).unique()` | `DEFINE INDEX ... FIELDS email UNIQUE` |
| `event('name').onCreate()` | `DEFINE EVENT name ON ... WHEN ...` |
| `defineRelation({ from, to })` | `DEFINE TABLE ... TYPE RELATION IN ... OUT ...` |

