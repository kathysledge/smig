# Fields

Fields are the columns in your tables. They define what data each record can hold, what type that data is, and any rules it must follow.

## What are fields for?

Every table needs fields. A `user` table might have:

- An `email` field (text, must be unique)
- A `name` field (text)
- A `createdAt` field (timestamp, set automatically)

In **smig**, you define these with simple builder functions:

```typescript
fields: {
  email: string().required(),
  name: string(),
  createdAt: datetime().default('time::now()'),
}
```

## All field types

### Text and strings

| Builder | SurrealDB type | When to use it |
|---------|----------------|----------------|
| `string()` | `string` | Names, emails, descriptions — any text |
| `uuid()` | `uuid` | Unique identifiers |
| `bytes()` | `bytes` | Binary data (files, images) |

### Numbers

| Builder | SurrealDB type | When to use it |
|---------|----------------|----------------|
| `int()` | `int` | Whole numbers (counts, ages) |
| `float()` | `float` | Decimal numbers (scores, measurements) |
| `decimal()` | `decimal` | Precise decimals (money) |
| `number()` | `number` | Either int or float |

### True/false

| Builder | SurrealDB type | When to use it |
|---------|----------------|----------------|
| `bool()` | `bool` | On/off states, flags |

### Time

| Builder | SurrealDB type | When to use it |
|---------|----------------|----------------|
| `datetime()` | `datetime` | Points in time (timestamps) |
| `duration()` | `duration` | Lengths of time (timeouts, intervals) |

### Collections

| Builder | SurrealDB type | When to use it |
|---------|----------------|----------------|
| `array('type')` | `array<type>` | Lists of things |
| `set('type')` | `set<type>` | Unique lists (no duplicates) |
| `object()` | `object` | Nested key-value data |

### References

| Builder | SurrealDB type | When to use it |
|---------|----------------|----------------|
| `record('table')` | `record<table>` | Link to another record |
| `option(type)` | `option<type>` | Optional value (might be null) |
| `any()` | `any` | Accept anything |

### Spatial

| Builder | SurrealDB type | When to use it |
|---------|----------------|----------------|
| `geometry()` | `geometry` | Points, lines, polygons |

### Special

| Builder | SurrealDB type | When to use it |
|---------|----------------|----------------|
| `literal(...)` | Literal union | Enum-like values |
| `range()` | `range` | Numeric ranges |
| `nullType()` | `null` | Explicit null |

## Making fields required

By default, fields are optional. To require a value:

```typescript
email: string().required()
```

This adds an assertion that rejects `NONE`:

```surql
DEFINE FIELD email ON TABLE user TYPE string ASSERT $value != NONE;
```

## Default values

### Static defaults

Values that are the same every time:

```typescript
isActive: bool().default(true)
role: string().default('user')
viewCount: int().default(0)
```

### Dynamic defaults

Values computed when the record is created:

```typescript
createdAt: datetime().default('time::now()')
id: uuid().default('rand::uuid::v7()')
```

### Always updating

Values recomputed on every write (not just creation):

```typescript
updatedAt: datetime().defaultAlways('time::now()')
```

## Validation with assert

The `.assert()` method adds conditions that values must pass:

```typescript
// Email format
email: string().assert('string::is_email($value)')

// Length limits
username: string().assert('string::len($value) >= 3 AND string::len($value) <= 20')

// Number ranges
age: int().assert('$value >= 0 AND $value <= 150')

// Regex patterns
slug: string().assert('string::matches($value, /^[a-z0-9-]+$/)')
```

You can combine multiple assertions:

```typescript
password: string()
  .required()
  .assert('string::len($value) >= 8')
  .comment('Must be at least 8 characters')
```

## Computed values

### Computed on write

Use `.value()` for values computed when data is saved:

```typescript
// Slug generated from title
slug: string().value('string::slug(title)')

// Lowercase email
normalizedEmail: string().value('string::lowercase(email)')
```

### Computed on read

Use `.computed()` for values calculated when queried:

```typescript
// Full name from parts
fullName: string().computed('string::concat(firstName, " ", lastName)')

// Count from array
followerCount: int().computed('array::len(followers)')
```

The difference: `.value()` stores the result, `.computed()` calculates every time.

## Read-only fields

Fields that can only be set once:

```typescript
id: uuid().default('rand::uuid::v7()').readonly()
createdAt: datetime().default('time::now()').readonly()
```

Attempts to update these fields will be rejected.

## Flexible typing

Allow any structure within an object:

```typescript
metadata: object().flexible()
```

This accepts any nested data without validation.

## Record references

Link to records in other tables:

```typescript
// Single table
author: record('user')

// Required reference
author: record('user').required()

// Multiple possible tables
target: record(['post', 'comment'])

// Any table
subject: record()
```

### Foreign key constraints

SurrealDB 3 supports referential integrity:

```typescript
author: record('user')
  .required()
  .references('user')
  .onDelete('CASCADE')
```

| Action | What happens when referenced record is deleted |
|--------|-----------------------------------------------|
| `'CASCADE'` | This record is also deleted |
| `'SET NULL'` | This field becomes null |
| `'SET DEFAULT'` | This field reverts to its default |
| `'RESTRICT'` | Deletion is prevented |

## Optional fields

Explicitly mark a field as optional (can be null):

```typescript
bio: option('string')
avatar: option('string')
manager: option(record('user'))
```

## Arrays and sets

### Arrays

Ordered lists that can have duplicates:

```typescript
tags: array('string')
scores: array('int')
followers: array(record('user'))
```

With length constraints:

```typescript
// At least 1, at most 10
tags: array('string', 1, 10)
```

### Sets

Unordered lists with unique values:

```typescript
// Unique tags only
categories: set('string')

// With constraints
permissions: set('string', 0, 5)
```

## Nested fields

Use dot notation for nested object fields:

```typescript
fields: {
  'address.street': string(),
  'address.city': string(),
  'address.zip': string(),
  
  'settings.theme': string().default('light'),
  'settings.emailNotifications': bool().default(true),
}
```

This creates a nested structure:

```typescript
{
  "address": {
    "street": "...",
    "city": "...",
    "zip": "..."
  },
  "settings": {
    "theme": "light",
    "emailNotifications": true
  }
}
```

## Comments

Document your fields:

```typescript
email: string()
  .required()
  .comment('Primary contact email, must be unique')
```

Comments appear in the generated SQL and database introspection.

## Rename tracking

When you rename a field, use `.was()` so **smig** generates a rename instead of drop/create:

```typescript
// Field was previously called 'name'
fullName: string().was('name')

// Multiple previous names
contactEmail: string().was(['email', 'emailAddress'])
```

This generates:

```surql
ALTER FIELD name ON TABLE user RENAME TO fullName;
```

Instead of dropping the field and losing data.

## Permissions

Restrict who can read or write a field:

```typescript
// Hide from everyone except owners
password: string().permissions('NONE')

// Allow reads, restrict writes
role: string().permissions('FOR select FULL FOR update WHERE $auth.role = "admin"')

// Complex permissions
salary: decimal().permissions(`
  FOR select WHERE $auth.role IN ["hr", "admin"]
  FOR update WHERE $auth.role = "hr"
`)
```

## Complete example

A comprehensive user schema demonstrating multiple field types and modifiers:

```typescript
import { defineSchema, string, int, bool, datetime, uuid, array, record, option } from 'smig';

const userSchema = defineSchema({
  table: 'user',
  fields: {
    // Identity
    id: uuid().default('rand::uuid::v7()').readonly(),
    email: string().required().assert('string::is_email($value)'),
    
    // Profile
    name: string().required(),
    bio: option('string'),
    avatar: option('string'),
    
    // Settings (nested)
    'settings.theme': string().default('light'),
    'settings.notifications': bool().default(true),
    
    // Status
    isActive: bool().default(true),
    role: string().default('user'),
    
    // Social
    followers: array(record('user')).default([]),
    
    // Computed
    followerCount: int().computed('array::len(followers)'),
    
    // Timestamps
    createdAt: datetime().default('time::now()').readonly(),
    updatedAt: datetime().defaultAlways('time::now()'),
  },
});
```

## Related

- [Tables](/schema-reference/tables) — Where fields live
- [Indexes](/schema-reference/indexes) — Speed up field queries
- [Relations](/schema-reference/relations) — Record references in depth
