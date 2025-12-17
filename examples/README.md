# **smig** schema examples

This directory contains example schemas demonstrating various features and best practices of **smig**. These examples progress from simple to complex, showcasing real-world patterns you can use in your own projects.

## Examples overview

### ⚡ Minimal example (`minimal-example.js`)

The simplest possible **smig** schema - perfect for understanding the basics.

**What it demonstrates:**
- Single table definition
- Basic field types (`string`, `bool`)
- Field validation with assertions
- Common field patterns (`cf.timestamp()`)
- Required schema composition

**Tables:**
- `task` - Simple todo items with validation

**Run it:**
```bash
smig generate --schema examples/minimal-example.js
smig migrate --schema examples/minimal-example.js
```

### 📝 Simple blog schema (`simple-blog-schema.js`)

A realistic blogging platform schema with relationships.

**What it demonstrates:**
- Multiple table definitions
- Field validation (email, length)
- Optional fields with `option()`
- Relations between tables
- Indexes for performance
- Basic events for automation
- Common field patterns (`cf.owner()`, `cf.timestamp()`)
- Common index patterns (`ci.createdAt()`)

**Tables:**
- `user` - Blog authors with email validation
- `post` - Blog posts with author references and timestamps

**Relations:**
- `like` - Users liking posts (graph edge)

**Run it:**
```bash
smig generate --schema examples/simple-blog-schema.js
smig migrate --schema examples/simple-blog-schema.js
```

### 🌐 Social network schema (`social-network-schema.js`)

A comprehensive social media platform with advanced features.

**What it demonstrates:**
- Advanced field types (`uuid`, `array`, `int`)
- Complex validation (username patterns, enums, length limits)
- Composite indexes for query optimization
- Multiple event definitions
- Audit trail patterns
- Nested data structures (threaded comments)
- Self-referencing relations (user follows user)
- Counter automation with events
- Real-world social media patterns

**Tables:**
- `user` - Complete user profiles with counters
- `post` - Social posts with hashtags, mentions, media
- `comment` - Threaded comment system
- `notification` - Type-safe notification system

**Relations:**
- `follow` - User following with self-reference
- `like` - Post likes
- `block` - User blocking

**Run it:**
```bash
smig generate --schema examples/social-network-schema.js
smig migrate --schema examples/social-network-schema.js
```

### 🎯 Social platform schema (`social-platform-schema.js`)

A full-featured social platform demonstrating advanced **smig** capabilities.

**What it demonstrates:**
- Custom authentication scopes with `scope()` builder
- Full-text search analyzers with `analyzer()` builder
- Custom database functions with `fn()` builder
- Union type records for polymorphic references
- Computed fields with `<future>` syntax
- Complex voting systems with nested fields
- Topic-based content organization
- Thread and comment hierarchies
- Comprehensive permission systems

**Tables:**
- `user` - Users with voting, roles, and computed follower counts
- `topic` - Content topics with posts and threads
- `post` - Posts with images, comments, and voting
- `draft` - Draft posts before publication
- `thread` - Discussion threads with replies
- `comment` - Comments on posts with voting
- `image` - Image attachments
- `notification` - Polymorphic notifications (union types)
- `feedback` - User feedback system
- `report` - Content reporting
- `error` - Error logging
- `confirmation` - Email confirmations
- `passwordReset` - Password reset tokens

**Relations:**
- `pin` - Users pinning posts

**Functions:**
- `fn::days_since` - Calculate days elapsed since a datetime

**Scopes:**
- `account` - Authentication with email/username and Argon2 password hashing

**Analyzers:**
- `relevanceSearch` - Full-text search with camel case, class tokenizers, and snowball stemming

**Run it:**
```bash
smig generate --schema examples/social-platform-schema.js
smig migrate --schema examples/social-platform-schema.js
```

## Key features demonstrated

### Field types & validation
```javascript
// Basic types
name: string()
  .assert('$value != NONE'),
age: int().default(0),
isActive: bool().default(true),
createdAt: cf.timestamp(), // Common pattern for timestamps

// Advanced types
id: uuid().default('rand::uuid::v7()'),
tags: array('string').default([]),
bio: option('string'), // Optional field (can be NONE)
settings: option('object'), // Optional JSON data

// Validation with stacked assertions (combined with AND)
email: string()
  .assert('$value != NONE')
  .assert('$value ~ /^[^@]+@[^@]+\\.[^@]+$/'),

username: string()
  .assert('$value ~ /^[a-zA-Z0-9_]{3,20}$/'),

content: string()
  .assert('$value != NONE')
  .assert('string::len($value) >= 1 AND string::len($value) <= 5000'),

// Foreign key references
author: cf.owner('user'), // Common pattern for ownership
```

### Indexes
```javascript
indexes: {
  // Simple unique index
  emailIndex: index(['email']).unique(),

  // Common index patterns
  recentPosts: ci.createdAt('post'),

  // Composite index for complex queries
  verifiedUsersIndex: index(['isVerified', 'followerCount']),

  // Multi-value index for arrays
  hashtagIndex: index(['hashtags']),
}
```

### Events & business logic
```javascript
events: {
  // Automatic timestamp updates
  updateTimestamp: event('post_updated_at')
    .onUpdate()
    .thenDo('UPDATE $after.id SET updatedAt = time::now()'),

  // Automatic counter updates
  incrementPostCount: event('post_count_increment')
    .onCreate()
    .thenDo('UPDATE $after.author SET postCount += 1'),

  // Audit trails
  auditProfileUpdate: event('user_profile_audit')
    .onUpdate()
    .when('$before.bio != $after.bio')
    .thenDo(`
      CREATE audit_log SET
        table = "user",
        recordId = $after.id,
        action = "profile_update",
        timestamp = time::now()
    `),

  // Complex business logic (single statement, multiple lines OK)
  extractHashtags: event('post_hashtag_extraction')
    .onCreate()
    .thenDo(`
      UPDATE $after.id SET
        hashtags = string::matches($after.content, /#\\w+/g)
      WHERE array::len(string::matches($after.content, /#\\w+/g)) > 0
    `),
}
```

**Multiple statements**: Events can contain multiple SurrealQL statements when wrapped in curly braces `{ ... }`. The statements should be separated by semicolons. **smig** automatically detects multi-statement events and generates the correct block syntax:

```javascript
events: {
  // Multiple statements in a block
  multiAction: event('multi_action')
    .onCreate()
    .thenDo(`{
      UPDATE $after.author SET postCount += 1;
      CREATE notification SET recipient = $after.author, message = "Post created";
    }`),
}
```

### Relations
```javascript
// Simple relation
const likeRelation = defineRelation({
  name: 'like',
  from: 'user',
  to: 'post',
  fields: {
    createdAt: cf.timestamp(), // Common pattern
  },
});

// Self-referencing relation
const followRelation = defineRelation({
  name: 'follow',
  from: 'user',
  to: 'user',
  fields: {
    createdAt: cf.timestamp(),
    notificationsEnabled: bool().default(true),
  },
});
```

## Running the examples

### Quick start

Each example can be run directly:

```bash
# Test the minimal example
smig generate --schema examples/minimal-example.js
smig migrate --schema examples/minimal-example.js

# Test the blog example
smig generate --schema examples/simple-blog-schema.js
smig migrate --schema examples/simple-blog-schema.js

# Test the social network example
smig generate --schema examples/social-network-schema.js
smig migrate --schema examples/social-network-schema.js
```

### Use as a template

Copy an example as your starting point:

```bash
# Start with the blog example
cp examples/simple-blog-schema.js schema.js

# Then customize and run
smig migrate
```

### Test with different databases

```bash
# Test against different database instances
smig generate --schema examples/simple-blog-schema.js --url ws://localhost:8001

# Use different environment configurations
smig migrate --schema examples/social-network-schema.js --env staging
```

### Customize for your needs

These examples are starting points - modify them to match your requirements:

- ✅ Add your own field types and validations
- ✅ Create custom events for your business logic
- ✅ Add indexes based on your query patterns
- ✅ Extend relations with additional fields
- ✅ Mix and match patterns from different examples

## Best practices demonstrated

These examples showcase **smig** best practices in action:

1. **Meaningful table names** - Singular form (`user`, `post`, not `users`, `posts`)
2. **Use common patterns** - Leverage `cf`, `ci` helpers for consistency
3. **Always timestamp** - Include `createdAt` and optionally `updatedAt`
4. **Validate critical fields** - Emails, usernames, content length
5. **Index for performance** - Based on your actual query patterns
6. **Automate with events** - Counters, timestamps, audit trails
7. **Explicit optionality** - Use `option()` type for nullable fields
8. **Stack assertions** - Multiple `.assert()` calls get combined with AND
9. **Clear validation** - Separate concerns: type, format, length, range
10. **Relations are simple** - Clear `from`/`to` semantics

## Need help?

- 📖 [Main README](https://github.com/kathysledge/smig) - Complete documentation
- 🎯 [API reference](https://github.com/kathysledge/smig#api-reference) - All field types, methods, and patterns
- ❓ [FAQ](https://github.com/kathysledge/smig#faq) - Common questions and answers
- 💬 [Issue tracker](https://github.com/kathysledge/smig/issues) - Report bugs or ask questions

Happy schema building with **smig**! 🚀
