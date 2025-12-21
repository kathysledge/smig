import {
  cf,
  ci,
  composeSchema,
  defineRelation,
  defineSchema,
  event,
  index,
  option,
  string,
} from '../dist/schema/concise-schema.js';

/**
 * Simple Blog Schema Example (TypeScript)
 *
 * This example demonstrates basic schema concepts:
 * - Field types with validation
 * - Indexes for performance
 * - Relations between tables
 * - Events for automation
 * - Common patterns (cf, ci)
 *
 * Run with:
 *   smig generate --schema examples/simple-blog-schema.ts
 *   smig migrate --schema examples/simple-blog-schema.ts
 */

// User model - represents blog authors
const userSchema = defineSchema({
  table: 'user',
  fields: {
    name: string()
      .assert('$value != NONE')
      .assert('string::len($value) >= 1 AND string::len($value) <= 100'),
    email: string().assert('string::is_email($value)'), // Email validation (SurrealDB v3)
    bio: option('string'), // Optional biography
    createdAt: cf.timestamp(),
  },
  indexes: {
    emailIndex: index(['email']).unique(), // Unique email constraint
  },
});

// Post model - represents blog posts
const postSchema = defineSchema({
  table: 'post',
  fields: {
    title: string()
      .assert('$value != NONE')
      .assert('string::len($value) >= 1 AND string::len($value) <= 200'),
    content: string().assert('$value != NONE'),
    author: cf.owner('user'), // Foreign key to user
    publishedAt: option('datetime'), // Null when draft
    createdAt: cf.timestamp(),
    updatedAt: cf.emptyTimestamp(), // Updated manually
  },
  indexes: {
    authorIndex: index(['author']), // Fast lookups by author
    publishedIndex: index(['publishedAt']), // Fast lookups by publication date
    recentPosts: ci.createdAt('post'), // Index for recent posts
  },
  events: {
    // Automatically update the updatedAt timestamp
    updateTimestamp: event('post_updated_at')
      .onUpdate()
      .thenDo('UPDATE $after.id SET updatedAt = time::now()'),
  },
});

// Like relation - represents users liking posts
const likeRelation = defineRelation({
  name: 'like',
  from: 'user',
  to: 'post',
  fields: {
    createdAt: cf.timestamp(),
  },
});

// Compose the complete schema
const blogSchema = composeSchema({
  models: {
    user: userSchema,
    post: postSchema,
  },
  relations: {
    like: likeRelation,
  },
});

export default blogSchema;
