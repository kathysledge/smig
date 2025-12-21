/**
 * Simple Blog Example
 *
 * A basic blog application with users, posts, and comments.
 * Demonstrates field validation, indexes, and events.
 */
import {
  defineSchema,
  composeSchema,
  string,
  int,
  bool,
  datetime,
  array,
  record,
  option,
  index,
  event,
} from '../dist/schema/concise-schema.js';

// Users
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
    createdAt: datetime().default('time::now()'),
  },
  indexes: {
    email: index(['email']).unique(),
    active: index(['isActive']),
  },
});

// Posts
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
    createdAt: datetime().default('time::now()'),
    updatedAt: datetime().value('time::now()'),
  },
  indexes: {
    slug: index(['slug']).unique(),
    author: index(['author', 'createdAt']),
    published: index(['published', 'publishedAt']),
    tags: index(['tags']),
    // Full-text search (single column)
    contentSearch: index(['content']).search().analyzer('english'),
  },
  events: {
    setPublishedAt: event('set_published_at')
      .onUpdate()
      .when('$before.published = false AND $after.published = true')
      .thenDo('UPDATE $after.id SET publishedAt = time::now()'),
  },
});

// Comments
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
    createdAt: datetime().default('time::now()'),
    updatedAt: datetime().value('time::now()'),
  },
  indexes: {
    post: index(['post', 'createdAt']),
    author: index(['author', 'createdAt']),
    parent: index(['parent']),
  },
});

export default composeSchema({
  models: {
    user: userSchema,
    post: postSchema,
    comment: commentSchema,
  },
  relations: {},
});

