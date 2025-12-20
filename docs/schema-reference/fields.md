# Fields

Define table columns with type-safe field builders.

---

## Field types

| Type | Builder | SurrealDB type |
|------|---------|----------------|
| String | `string()` | `string` |
| Integer | `int()` | `int` |
| Float | `float()` | `float` |
| Decimal | `decimal()` | `decimal` |
| Boolean | `bool()` | `bool` |
| Datetime | `datetime()` | `datetime` |
| Duration | `duration()` | `duration` |
| UUID | `uuid()` | `uuid` |
| Array | `array(type)` | `array<type>` |
| Object | `object()` | `object` |
| Record | `record(table)` | `record<table>` |
| Option | `option(type)` | `option<type>` |
| Geometry | `geometry()` | `geometry` |
| Any | `any()` | `any` |

---

## Basic usage

```javascript
import { string, int, bool, datetime } from 'smig';

const fields = {
  name: string(),
  age: int(),
  isActive: bool(),
  createdAt: datetime(),
};
```

---

## Modifiers

All field types support these modifiers:

| Modifier | Description | Example |
|----------|-------------|---------|
| `.required()` | Must have a value | `string().required()` |
| `.default(value)` | Static default | `bool().default(true)` |
| `.value(expr)` | Dynamic value (on write) | `datetime().value('time::now()')` |
| `.computed(expr)` | Computed on read | `int().computed('array::len(items)')` |
| `.assert(condition)` | Validation rule | `int().assert('$value >= 0')` |
| `.readonly()` | Cannot be modified | `string().readonly()` |
| `.flexible()` | Accept any subtype | `object().flexible()` |
| `.permissions(rule)` | Field-level access | `string().permissions('NONE')` |

---

## String fields

```javascript
// Basic
name: string()

// Required
email: string().required()

// With validation
email: string()
  .required()
  .assert('string::is_email($value)')

// Length constraints
username: string()
  .required()
  .length(3, 20)  // min 3, max 20 chars

// Pattern matching
slug: string()
  .assert('$value = /^[a-z0-9-]+$/')
```

---

## Numeric fields

```javascript
// Integer
count: int()
count: int().default(0)
count: int().range(0, 100)  // 0-100 inclusive

// Float
score: float()
score: float().min(0).max(10)

// Decimal (for money)
price: decimal()
price: decimal().assert('$value >= 0')
```

---

## Boolean fields

```javascript
isActive: bool()
isActive: bool().default(true)
isVerified: bool().default(false)
```

---

## Date and time

```javascript
// Static default
createdAt: datetime().default('time::now()')

// Dynamic (updates on every write)
updatedAt: datetime().value('time::now()')

// Duration
timeout: duration().default('30s')
sessionLength: duration().default('7d')
```

---

## UUID fields

```javascript
// Auto-generated UUID v7 (time-ordered)
id: uuid().default('rand::uuid::v7()')

// UUID v4 (random)
token: uuid().default('rand::uuid::v4()')
```

---

## Array fields

```javascript
// Array of strings
tags: array('string').default([])

// Array of integers
scores: array('int')

// Array of records
followers: array(record('user')).default([])

// Nested arrays
matrix: array('array<int>')
```

---

## Record references

```javascript
// Single table reference
author: record('user')
author: record('user').required()

// Optional reference
parentComment: option(record('comment'))

// Union type (multiple tables)
target: record(['post', 'comment', 'user'])

// Any record
subject: record()

// With foreign key constraint
author: record('user')
  .required()
  .reference()
  .onDelete('cascade')
```

### Foreign key options

| Option | Behavior |
|--------|----------|
| `'cascade'` | Delete this record when referenced record is deleted |
| `'reject'` | Prevent deletion of referenced record |
| `'ignore'` | Do nothing (orphan the reference) |
| `'unset'` | Set field to null |

---

## Optional fields

```javascript
// Explicitly optional
bio: option('string')
avatar: option('string')

// Optional record
manager: option(record('user'))

// Optional with default
nickname: option('string').default(null)
```

---

## Computed fields

```javascript
// Computed on read (deferred)
fullName: string().computed('string::concat(firstName, " ", lastName)')

// Count from array
followerCount: int().computed('array::len(followers)')

// Complex computation
score: float().computed(`
  array::len(votes.positive) -
  (<float> array::len(votes.negative) / 2)
`)
```

---

## Nested fields

Use dot notation for nested object fields:

```javascript
fields: {
  'address.street': string(),
  'address.city': string(),
  'address.zip': string(),
  'settings.theme': string().default('light'),
  'settings.notifications': bool().default(true),
}
```

---

## Complete example

```javascript
const userSchema = defineSchema({
  table: 'user',
  fields: {
    // Identity
    id: uuid().default('rand::uuid::v7()').readonly(),
    email: string().required().assert('string::is_email($value)'),
    
    // Profile
    name: string().required().length(2, 100),
    bio: option('string'),
    avatar: option('string'),
    
    // Settings
    'settings.theme': string().default('light'),
    'settings.emailNotifications': bool().default(true),
    
    // Status
    isActive: bool().default(true),
    role: string().default('user'),
    
    // Timestamps
    createdAt: datetime().default('time::now()').readonly(),
    updatedAt: datetime().value('time::now()'),
    
    // Computed
    displayName: string().computed('name ?? email'),
  },
});
```

---

## See also

- [Tables](tables.md) - Table definitions
- [Indexes](indexes.md) - Indexing fields
- [Relations](relations.md) - Record relationships

