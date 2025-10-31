import {
  string,
  int,
  bool,
  datetime,
  record,
  index,
  defineSchema,
  defineRelation,
  composeSchema,
  cf,
  ci,
  ce
} from 'smig';

/**
 * Example Schema File
 *
 * This is a basic example schema to get you started.
 * Modify the tables and fields according to your needs.
 */

// User model - represents application users
const userModel = defineSchema({
  table: 'user',
  schemafull: true,
  fields: {
    name: string(),
    email: string(),
    isActive: bool().default(true),
    createdAt: cf.timestamp(), // Timestamp field
  },
  indexes: {
    emailIndex: index(['email']).unique(), // Unique email constraint
  },
});

// Post model - represents blog posts
const postModel = defineSchema({
  table: 'post',
  schemafull: true,
  fields: {
    title: string(),
    content: string(),
    author: cf.owner('user'), // Foreign key to user
    isPublished: bool().default(false),
    createdAt: cf.timestamp(), // Created timestamp
    updatedAt: cf.timestamp(), // Updated timestamp
  },
  indexes: {
    authorIndex: index(['author']), // Fast lookups by author
    createdAtIndex: ci.createdAt('post'), // Created date index
  },
});

// Like relation - represents users liking posts
const likeRelation = defineRelation({
  name: 'like',
  from: 'user',
  to: 'post',
  fields: {
    createdAt: cf.timestamp(), // When the like was created
  },
});

// Compose the complete schema
const fullSchema = composeSchema({
  models: {
    user: userModel,
    post: postModel,
  },
  relations: {
    like: likeRelation,
  },
});

export default fullSchema;
