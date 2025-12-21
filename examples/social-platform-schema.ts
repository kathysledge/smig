import {
  array,
  bool,
  composeSchema,
  datetime,
  defineSchema,
  index,
  int,
  option,
  record,
  string,
} from '../dist/schema/concise-schema.js';

/**
 * Social Platform Schema Example
 *
 * Demonstrates a comprehensive social platform with:
 * - Users, posts, comments
 * - Topics and voting
 * - Schemaless tables
 */

const user = defineSchema({
  table: 'user',
  schemaless: true,
  fields: {
    email: string().assert('string::is_email($value)'),
    name: string()
      .assert('$value != NONE')
      .assert('string::len($value) >= 3')
      .assert('string::len($value) <= 32'),
    link: option('string'),
    description: option('string'),
    dateJoined: datetime().default('time::now()'),
    tokens: int().default(0).assert('$value >= 0'),
    roles: array(string()).default([]),
  },
  indexes: {
    email: index(['email']).unique(),
    name: index(['name']).unique(),
  },
});

const topic = defineSchema({
  table: 'topic',
  schemaless: true,
  fields: {
    posts: array(record('post')).default([]),
    threads: array(record('thread')).default([]),
  },
});

const post = defineSchema({
  table: 'post',
  schemaless: true,
  fields: {
    user: record('user'),
    title: string().assert('$value != NONE'),
    content: string(),
    time: datetime().default('time::now()'),
    replyTo: option('record<post>'),
    topics: array(record('topic')).default([]),
    archived: bool().default(false),
    edited: bool().default(false),
    visits: int().default(0),
  },
});

const thread = defineSchema({
  table: 'thread',
  schemaless: true,
  fields: {
    user: record('user'),
    content: string().assert('$value != NONE'),
    time: datetime().default('time::now()'),
    replyTo: option('record<thread>'),
    topics: array(record('topic')).default([]),
    edited: bool().default(false),
    visits: int().default(0),
  },
});

const comment = defineSchema({
  table: 'comment',
  schemaless: true,
  fields: {
    user: record('user'),
    post: record('post'),
    content: string(),
    time: datetime().default('time::now()'),
    edited: bool().default(false),
  },
});

const notification = defineSchema({
  table: 'notification',
  schemaless: true,
  fields: {
    recipient: record('user'),
    message: string(),
    time: datetime().default('time::now()'),
    viewed: bool().default(false),
  },
});

export default composeSchema({
  models: {
    user,
    topic,
    post,
    thread,
    comment,
    notification,
  },
  relations: {},
});
