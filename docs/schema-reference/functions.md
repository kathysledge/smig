# Functions

Define reusable database functions with `fn()`.

---

## Basic usage

```javascript
import { fn } from 'smig';

const daysSince = fn('days_since')
  .param('date', 'datetime')
  .returns('float')
  .body('RETURN <float> (time::now() - $date) / 60 / 60 / 24');
```

**Generated SurrealQL:**

```sql
DEFINE FUNCTION fn::days_since($date: datetime) -> float {
  RETURN <float> (time::now() - $date) / 60 / 60 / 24
};
```

---

## Options

| Method | Description | Required |
|--------|-------------|----------|
| `.param(name, type)` | Add a parameter | No |
| `.returns(type)` | Set return type | No |
| `.body(code)` | Function body | Yes |
| `.permissions(rule)` | Access control | No |
| `.comment(text)` | Documentation | No |

---

## Parameters

### Single parameter

```javascript
fn('greet')
  .param('name', 'string')
  .body('RETURN string::concat("Hello, ", $name)')
```

### Multiple parameters

```javascript
fn('calculate_discount')
  .param('price', 'decimal')
  .param('percent', 'int')
  .returns('decimal')
  .body(`
    LET $discount = $price * ($percent / 100);
    RETURN $price - $discount
  `)
```

### Complex types

```javascript
fn('process_items')
  .param('items', 'array<object>')
  .param('filter', 'option<string>')
  .returns('array<object>')
  .body('/* processing logic */')
```

---

## Return types

```javascript
// Explicit return type
fn('get_age')
  .param('birthdate', 'datetime')
  .returns('int')
  .body('RETURN time::year(time::now()) - time::year($birthdate)')

// No return type (void)
fn('log_action')
  .param('action', 'string')
  .body('CREATE log SET action = $action, time = time::now()')
```

---

## Function body

### Simple expressions

```javascript
fn('is_adult')
  .param('age', 'int')
  .returns('bool')
  .body('RETURN $age >= 18')
```

### Multi-line logic

```javascript
fn('calculate_score')
  .param('user', 'record<user>')
  .returns('float')
  .body(`
    LET $posts = SELECT count() FROM post WHERE author = $user GROUP ALL;
    LET $likes = SELECT count() FROM likes WHERE in = $user GROUP ALL;
    LET $followers = SELECT count() FROM follows WHERE out = $user GROUP ALL;
    
    RETURN ($posts.count * 10) + ($likes.count * 2) + ($followers.count * 5)
  `)
```

### Control flow

```javascript
fn('get_tier')
  .param('points', 'int')
  .returns('string')
  .body(`
    IF $points >= 10000 {
      RETURN "platinum"
    } ELSE IF $points >= 5000 {
      RETURN "gold"
    } ELSE IF $points >= 1000 {
      RETURN "silver"
    } ELSE {
      RETURN "bronze"
    }
  `)
```

---

## Permissions

Control who can execute the function:

```javascript
fn('admin_action')
  .param('target', 'record')
  .permissions('$auth.role = "admin"')
  .body('/* admin-only logic */')
```

---

## Calling functions

Once defined, call functions in queries:

```sql
-- Call function
SELECT fn::days_since(createdAt) AS age FROM post;

-- In WHERE clause
SELECT * FROM user WHERE fn::get_tier(points) = "platinum";

-- In computed field
DEFINE FIELD tier ON user VALUE fn::get_tier(points);
```

---

## Common patterns

### Date utilities

```javascript
const daysSince = fn('days_since')
  .param('date', 'datetime')
  .returns('float')
  .body('RETURN <float> (time::now() - $date) / 60 / 60 / 24');

const isRecent = fn('is_recent')
  .param('date', 'datetime')
  .param('days', 'int')
  .returns('bool')
  .body('RETURN fn::days_since($date) <= $days');
```

### String formatting

```javascript
const formatName = fn('format_name')
  .param('first', 'string')
  .param('last', 'string')
  .returns('string')
  .body(`
    RETURN string::concat(
      string::uppercase(string::slice($last, 0, 1)),
      string::lowercase(string::slice($last, 1)),
      ", ",
      string::uppercase(string::slice($first, 0, 1)),
      string::lowercase(string::slice($first, 1))
    )
  `);
```

### Validation helpers

```javascript
const isValidSlug = fn('is_valid_slug')
  .param('slug', 'string')
  .returns('bool')
  .body(`
    RETURN $slug != NONE 
      AND string::len($slug) >= 3 
      AND string::len($slug) <= 100
      AND $slug = /^[a-z0-9-]+$/
  `);
```

---

## Complete example

```javascript
import { fn, composeSchema } from 'smig';

const daysSince = fn('days_since')
  .param('date', 'datetime')
  .returns('float')
  .body('RETURN <float> (time::now() - $date) / 60 / 60 / 24');

const getUserStats = fn('get_user_stats')
  .param('user', 'record<user>')
  .returns('object')
  .body(`
    LET $posts = (SELECT count() FROM post WHERE author = $user GROUP ALL).count ?? 0;
    LET $followers = (SELECT count() FROM follows WHERE out = $user GROUP ALL).count ?? 0;
    LET $following = (SELECT count() FROM follows WHERE in = $user GROUP ALL).count ?? 0;
    
    RETURN {
      posts: $posts,
      followers: $followers,
      following: $following,
      accountAge: fn::days_since($user.createdAt)
    }
  `);

const calculateEngagement = fn('calculate_engagement')
  .param('user', 'record<user>')
  .returns('float')
  .body(`
    LET $stats = fn::get_user_stats($user);
    LET $age = math::max($stats.accountAge, 1);
    RETURN ($stats.posts + $stats.followers) / $age
  `);

export default composeSchema({
  models: { /* ... */ },
  functions: {
    daysSince,
    getUserStats,
    calculateEngagement,
  },
});
```

---

## See also

- [Schema reference](index.md) - Full API overview
- [Best practices](../guides/best-practices.md) - Function patterns

