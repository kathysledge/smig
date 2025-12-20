# Functions

Functions are reusable pieces of database logic. Instead of writing the same query multiple times, you define it once and call it by name.

## What are functions for?

Functions help you:

- **Reuse logic** — Write complex queries once, use them anywhere
- **Encapsulate business rules** — Keep calculations consistent
- **Improve security** — Grant access to functions without exposing tables
- **Simplify queries** — Replace complex expressions with readable function calls

## Creating a function

Define a function with parameters, return type, and body:

```typescript
import { fn } from 'smig';

const daysSince = fn('fn::days_since')
  .params({ date: 'datetime' })
  .returns('int')
  .body('RETURN math::floor((time::now() - $date) / 86400);');
```

This generates:

```sql
DEFINE FUNCTION fn::days_since($date: datetime) -> int {
  RETURN math::floor((time::now() - $date) / 86400);
};
```

Call it with:

```sql
SELECT fn::days_since(createdAt) AS days_old FROM post;
```

## Function parameters

### Single parameter

A simple function with one input:

```typescript
fn('fn::greet')
  .params({ name: 'string' })
  .returns('string')
  .body('RETURN string::concat("Hello, ", $name, "!");'),
```

### Multiple parameters

Functions can accept multiple typed parameters:

```typescript
fn('fn::calculate_discount')
  .params({ 
    price: 'decimal',
    quantity: 'int',
    discount_percent: 'float'
  })
  .returns('decimal')
  .body(`{
    LET $subtotal = $price * $quantity;
    LET $discount = $subtotal * ($discount_percent / 100);
    RETURN $subtotal - $discount;
  }`),
```

### Optional parameters

Use `option<type>` for optional parameters:

```typescript
fn('fn::search')
  .params({
    query: 'string',
    limit: 'option<int>'
  })
  .returns('array')
  .body(`{
    LET $max = $limit ?? 10;
    RETURN SELECT * FROM post WHERE title ~ $query LIMIT $max;
  }`),
```

## Return types

Specify what the function returns:

```typescript
.returns('string')      // Text
.returns('int')         // Whole number
.returns('float')       // Decimal number
.returns('bool')        // True/false
.returns('datetime')    // Timestamp
.returns('array')       // List
.returns('object')      // Object
.returns('record')      // Database record
.returns('option<int>') // Maybe null
```

## Function body

### Simple expression

For one-liners, return directly:

```typescript
.body('RETURN $a + $b;')
```

### Multiple statements

Use curly braces:

```typescript
.body(`{
  LET $result = $a + $b;
  LET $doubled = $result * 2;
  RETURN $doubled;
}`)
```

### Control flow

Use if/else for conditional logic:

```typescript
.body(`{
  IF $value < 0 {
    RETURN "negative";
  } ELSE IF $value = 0 {
    RETURN "zero";
  } ELSE {
    RETURN "positive";
  };
}`)
```

### Loops

Iterate over collections with FOR:

```typescript
.body(`{
  LET $sum = 0;
  FOR $item IN $items {
    LET $sum = $sum + $item.price;
  };
  RETURN $sum;
}`)
```

### Database queries

Run queries inside functions:

```typescript
.body(`{
  LET $user = SELECT * FROM user WHERE id = $user_id;
  IF $user = NONE {
    THROW "User not found";
  };
  RETURN $user;
}`)
```

## Function permissions

Control who can call the function:

```typescript
fn('fn::admin_report')
  .params({})
  .returns('array')
  .body('...')
  .permissions('WHERE $auth.role = "admin"'),
```

## Common patterns

### Data transformation

Format or convert data:

```typescript
const formatDate = fn('fn::format_date')
  .params({ date: 'datetime', format: 'string' })
  .returns('string')
  .body(`{
    RETURN time::format($date, $format);
  }`);
```

### Business calculations

Encapsulate pricing and business logic:

```typescript
const calculateShipping = fn('fn::calculate_shipping')
  .params({ 
    weight: 'float',
    destination: 'string'
  })
  .returns('decimal')
  .body(`{
    LET $base = 5.00;
    LET $per_kg = IF $destination = 'international' { 12.50 } ELSE { 3.00 };
    RETURN $base + ($weight * $per_kg);
  }`);
```

### Aggregations

Compute statistics across records:

```typescript
const userStats = fn('fn::user_stats')
  .params({ user_id: 'record<user>' })
  .returns('object')
  .body(`{
    LET $posts = SELECT count() AS count FROM post WHERE author = $user_id;
    LET $comments = SELECT count() AS count FROM comment WHERE author = $user_id;
    LET $followers = SELECT count() AS count FROM follows WHERE out = $user_id;
    
    RETURN {
      posts: $posts[0].count ?? 0,
      comments: $comments[0].count ?? 0,
      followers: $followers[0].count ?? 0
    };
  }`);
```

### Validation helpers

Create reusable validation logic:

```typescript
const isValidSlug = fn('fn::is_valid_slug')
  .params({ slug: 'string' })
  .returns('bool')
  .body(`{
    RETURN string::matches($slug, /^[a-z0-9]+(-[a-z0-9]+)*$/);
  }`);

// Use in field assertion
slug: string().assert('fn::is_valid_slug($value)')
```

### Search with relevance

Full-text search with scoring:

```typescript
const searchPosts = fn('fn::search_posts')
  .params({ query: 'string', limit: 'option<int>' })
  .returns('array')
  .body(`{
    LET $max = $limit ?? 10;
    RETURN SELECT 
      *,
      search::score(0) AS relevance
    FROM post
    WHERE title @0@ $query OR content @0@ $query
    ORDER BY relevance DESC
    LIMIT $max;
  }`);
```

### Transaction-like operations

Multi-step operations that should succeed or fail together:

```typescript
const transferCredits = fn('fn::transfer_credits')
  .params({ 
    from: 'record<user>',
    to: 'record<user>',
    amount: 'int'
  })
  .returns('bool')
  .body(`{
    LET $sender = SELECT credits FROM $from;
    
    IF $sender.credits < $amount {
      THROW "Insufficient credits";
    };
    
    UPDATE $from SET credits -= $amount;
    UPDATE $to SET credits += $amount;
    
    CREATE transfer SET
      from = $from,
      to = $to,
      amount = $amount,
      at = time::now();
    
    RETURN true;
  }`);
```

## Calling functions

### In queries

Call functions in SELECT statements:

```sql
SELECT fn::days_since(createdAt) AS age FROM post;
```

### In assertions

Validate field values with functions:

```typescript
slug: string().assert('fn::is_valid_slug($value)')
```

### In computed fields

Use functions for dynamic field values:

```typescript
displayName: string().computed('fn::format_name(firstName, lastName)')
```

### In events

Call functions from event handlers:

```typescript
.then('LET $stats = fn::user_stats($after.author); ...')
```

### From your app

Call functions from your application code:

```typescript
const stats = await db.query('RETURN fn::user_stats($id)', { id: userId });
```

## Function naming

Functions must start with `fn::`:

```typescript
fn('fn::my_function')     // ✓ Correct
fn('my_function')          // ✗ Will be prefixed automatically
```

Use descriptive, namespaced names:

```typescript
fn('fn::user::get_stats')
fn('fn::order::calculate_total')
fn('fn::search::posts')
```

## Renaming functions

Use `.was()` to track previous function names:

```typescript
const getUser = fn('fn::get_user')
  .was('fn::fetch_user')  // Previously named
  .params({ id: 'record<user>' })
  .returns('object')
  .body('...');
```

## Function comments

Document what the function does:

```typescript
fn('fn::days_since')
  .params({ date: 'datetime' })
  .returns('int')
  .body('...')
  .comment('Returns the number of days between the given date and now'),
```

## Complete example

Here's a complete set of functions for a user validation and feed system:

```typescript
import { fn, defineSchema, string, record, composeSchema } from 'smig';

// Validation function
const isValidUsername = fn('fn::is_valid_username')
  .params({ username: 'string' })
  .returns('bool')
  .body(`{
    LET $len = string::len($username);
    LET $valid_chars = string::matches($username, /^[a-z0-9_]+$/);
    RETURN $len >= 3 AND $len <= 20 AND $valid_chars;
  }`)
  .comment('Validate username: 3-20 chars, lowercase alphanumeric and underscores');

// Utility function
const generateSlug = fn('fn::generate_slug')
  .params({ title: 'string' })
  .returns('string')
  .body(`{
    LET $lower = string::lowercase($title);
    LET $slug = string::replace($lower, /[^a-z0-9]+/g, '-');
    LET $trimmed = string::trim($slug, '-');
    RETURN $trimmed;
  }`);

// Business logic function
const getUserFeed = fn('fn::get_user_feed')
  .params({ user_id: 'record<user>', page: 'option<int>' })
  .returns('array')
  .body(`{
    LET $offset = ($page ?? 0) * 20;
    LET $following = SELECT out FROM follows WHERE in = $user_id;
    
    RETURN SELECT *
    FROM post
    WHERE author IN $following OR author = $user_id
    ORDER BY createdAt DESC
    LIMIT 20
    START $offset;
  }`)
  .permissions('WHERE $auth.id != NONE');

const users = defineSchema({
  table: 'user',
  fields: {
    username: string()
      .required()
      .assert('fn::is_valid_username($value)'),
  },
});

export default composeSchema({
  models: { user: users },
  functions: [isValidUsername, generateSlug, getUserFeed],
});
```

## Related

- [Events](/schema-reference/events) — Call functions from triggers
- [Fields](/schema-reference/fields) — Use functions in computed fields
- [Analyzers](/schema-reference/analyzers) — Custom tokenization functions
