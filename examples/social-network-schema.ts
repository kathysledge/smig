import {
  array,
  bool,
  cf,
  composeSchema,
  defineRelation,
  defineSchema,
  index,
  int,
  option,
  string,
  uuid,
} from 'smig';

/**
 * Social Network Schema Example
 *
 * Demonstrates advanced schema features:
 * - Complex field types
 * - Composite indexes
 * - Event definitions
 * - Multiple relations
 */

const userSchema = defineSchema({
  table: 'user',
  fields: {
    id_uuid: uuid().default('rand::uuid::v7()'),
    username: string()
      .assert('$value != NONE')
      .assert('string::len($value) >= 3')
      .assert('string::len($value) <= 20'),
    email: string().assert('string::is_email($value)'),
    firstName: string().assert('$value != NONE'),
    lastName: string().assert('$value != NONE'),
    bio: option('string'),
    avatarUrl: option('string'),
    isVerified: bool().default(false),
    followerCount: int().default(0),
    followingCount: int().default(0),
    postCount: int().default(0),
    createdAt: cf.timestamp(),
  },
  indexes: {
    usernameIndex: index(['username']).unique(),
    emailIndex: index(['email']).unique(),
  },
});

const postSchema = defineSchema({
  table: 'post',
  fields: {
    id_uuid: uuid().default('rand::uuid::v7()'),
    content: string()
      .assert('$value != NONE')
      .assert('string::len($value) >= 1 AND string::len($value) <= 5000'),
    author: cf.owner('user'),
    hashtags: array('string').default([]),
    likeCount: int().default(0),
    isPublic: bool().default(true),
    createdAt: cf.timestamp(),
  },
  indexes: {
    authorIndex: index(['author']),
    publicPostsIndex: index(['isPublic', 'createdAt']),
  },
});

const commentSchema = defineSchema({
  table: 'comment',
  fields: {
    id_uuid: uuid().default('rand::uuid::v7()'),
    content: string()
      .assert('$value != NONE')
      .assert('string::len($value) >= 1 AND string::len($value) <= 2000'),
    author: cf.owner('user'),
    post: cf.owner('post'),
    likeCount: int().default(0),
    createdAt: cf.timestamp(),
  },
  indexes: {
    postCommentsIndex: index(['post', 'createdAt']),
  },
});

const followRelation = defineRelation({
  name: 'follow',
  from: 'user',
  to: 'user',
  fields: {
    createdAt: cf.timestamp(),
    notificationsEnabled: bool().default(true),
  },
});

const likeRelation = defineRelation({
  name: 'like',
  from: 'user',
  to: 'post',
  fields: {
    createdAt: cf.timestamp(),
  },
});

const notificationSchema = defineSchema({
  table: 'notification',
  fields: {
    id_uuid: uuid().default('rand::uuid::v7()'),
    recipient: cf.owner('user'),
    type: string().assert('$value != NONE'),
    message: string().assert('$value != NONE'),
    isRead: bool().default(false),
    createdAt: cf.timestamp(),
  },
  indexes: {
    recipientIndex: index(['recipient', 'isRead']),
  },
});

export default composeSchema({
  models: {
    user: userSchema,
    post: postSchema,
    comment: commentSchema,
    notification: notificationSchema,
  },
  relations: {
    follow: followRelation,
    like: likeRelation,
  },
});
