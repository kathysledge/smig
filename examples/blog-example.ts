/**
 * Blog Example
 *
 * A complete blog application demonstrating:
 * - Field types with validation
 * - Indexes for performance
 * - Graph relations between tables
 * - Events for automation
 * - Common patterns (cf, ci)
 * - Full-text search
 *
 * Run with:
 *   bun smig generate --schema examples/blog-example.ts
 *   bun smig migrate --schema examples/blog-example.ts
 */
import {
  array,
  bool,
  cf,
  ci,
  composeSchema,
  datetime,
  defineRelation,
  defineSchema,
  event,
  index,
  int,
  option,
  record,
  string,
} from '../dist/schema/concise-schema.js';

// #region user
// User model - represents blog authors and commenters
const userSchema = defineSchema({
  table: 'user',
  fields: {
    email: string().required().assert('string::is_email($value)'),
    name: string()
      .required()
      .assert('string::len($value) >= 2')
      .assert('string::len($value) <= 100'),
    bio: option('string'),
    isActive: bool().default(true),
    createdAt: cf.timestamp(),
  },
  indexes: {
    email: index(['email']).unique(),
    active: index(['isActive']),
  },
});
// #endregion user

// #region post
// Post model - represents blog articles
const postSchema = defineSchema({
  table: 'post',
  fields: {
    author: record('user').required(),
    title: string()
      .required()
      .assert('string::len($value) >= 1')
      .assert('string::len($value) <= 200'),
    slug: string().required(),
    content: string().required(),
    excerpt: option('string'),
    tags: array('string').default([]),
    published: bool().default(false),
    publishedAt: option('datetime'),
    viewCount: int().default(0),
    createdAt: cf.timestamp(),
    updatedAt: datetime().value('time::now()'),
  },
  indexes: {
    slug: index(['slug']).unique(),
    author: index(['author', 'createdAt']),
    published: index(['published', 'publishedAt']),
    tags: index(['tags']),
    recentPosts: ci.createdAt('post'),
    // Full-text search (single column only in SurrealDB 3.x)
    contentSearch: index(['content']).search().analyzer('english'),
  },
  events: {
    // Automatically set publishedAt when a post is first published
    setPublishedAt: event('set_published_at')
      .onUpdate()
      .when('$before.published = false AND $after.published = true')
      .thenDo('UPDATE $after.id SET publishedAt = time::now()'),
    // Update view count tracking
    updateTimestamp: event('post_updated')
      .onUpdate()
      .thenDo('UPDATE $after.id SET updatedAt = time::now()'),
  },
});
// #endregion post

// #region comment
// Comment model - supports nested/threaded comments
const commentSchema = defineSchema({
  table: 'comment',
  fields: {
    post: record('post').required(),
    author: record('user').required(),
    parent: option('record<comment>'), // For nested comments
    content: string()
      .required()
      .assert('string::len($value) >= 1')
      .assert('string::len($value) <= 5000'),
    createdAt: cf.timestamp(),
    updatedAt: datetime().value('time::now()'),
  },
  indexes: {
    post: index(['post', 'createdAt']),
    author: index(['author', 'createdAt']),
    parent: index(['parent']),
  },
});
// #endregion comment

// #region relations
// Like relation - users liking posts (graph edge)
const likeRelation = defineRelation({
  name: 'like',
  from: 'user',
  to: 'post',
  fields: {
    likedAt: cf.timestamp(),
  },
  indexes: {
    unique: index(['in', 'out']).unique(), // One like per user per post
  },
});

// Follow relation - users following other users
const followRelation = defineRelation({
  name: 'follow',
  from: 'user',
  to: 'user',
  fields: {
    followedAt: cf.timestamp(),
    notifications: bool().default(true),
  },
});
// #endregion relations

// #region schema
// Compose the complete blog schema
export default composeSchema({
  models: {
    user: userSchema,
    post: postSchema,
    comment: commentSchema,
  },
  relations: {
    like: likeRelation,
    follow: followRelation,
  },
});
// #endregion schema
