import {
  array,
  bool,
  cf, // Common field patterns
  composeSchema,
  defineRelation,
  defineSchema,
  event,
  index,
  int,
  option,
  string,
  uuid,
} from "smig";

/**
 * Advanced Social Network Schema Example
 *
 * This comprehensive example demonstrates advanced schema features:
 * - Complex field types (uuid, array, option, bool, int)
 * - Advanced validation and assertions
 * - Composite indexes for performance
 * - Event definitions for automation and business logic
 * - Multiple relations (follow, like, block)
 * - Real-world social media patterns
 * - Common field patterns (cf, ci)
 *
 * Run with:
 *   smig generate --schema examples/social-network-schema.js
 *   smig migrate --schema examples/social-network-schema.js
 */

// User model - social media user profile
const userSchema = defineSchema({
  table: "user",
  schemafull: true,
  fields: {
    id: uuid().default("rand::uuid::v4()"),
    username: string().assert("$value ~ /^[a-zA-Z0-9_]{3,20}$/"), // Alphanumeric and underscore, 3-20 chars
    email: string().assert("$value ~ /^[^@]+@[^@]+\\.[^@]+$/"), // Email validation
    firstName: string().assert("$value != NONE"),
    lastName: string().assert("$value != NONE"),
    bio: option("string"), // Optional biography
    avatarUrl: option("string"),
    isVerified: bool().default(false),
    followerCount: int().default(0),
    followingCount: int().default(0),
    postCount: int().default(0),
    tags: array("string").default([]), // Interest tags
    settings: option("object"), // JSON settings object
    lastLoginAt: option("datetime"),
    createdAt: cf.timestamp(),
    updatedAt: cf.emptyTimestamp(), // Updated manually via events
  },
  indexes: {
    usernameIndex: index(["username"]).unique(),
    emailIndex: index(["email"]).unique(),
    verifiedUsersIndex: index(["isVerified", "followerCount"]), // Composite index
    nameSearchIndex: index(["firstName", "lastName"]), // Name search
  },
  events: {
    // Automatically update the updatedAt timestamp on profile changes
    updateTimestamp: event("user_updated_at")
      .onUpdate()
      .thenDo("UPDATE $after.id SET updatedAt = time::now()"),

    // Audit trail for profile updates
    auditProfileUpdate: event("user_profile_audit")
      .onUpdate()
      .when("$before.bio != $after.bio OR $before.avatarUrl != $after.avatarUrl")
      .thenDo(`
        CREATE audit_log SET
          table = "user",
          recordId = $after.id,
          action = "profile_update",
          changes = {
            bio: { from: $before.bio, to: $after.bio },
            avatarUrl: { from: $before.avatarUrl, to: $after.avatarUrl }
          },
          timestamp = time::now()
      `),
  },
});

// Post model - social media posts
const postSchema = defineSchema({
  table: "post",
  schemafull: true,
  fields: {
    id: uuid().default("rand::uuid::v4()"),
    content: string()
      .assert("$value != NONE")
      .assert("string::len($value) >= 1 AND string::len($value) <= 5000"),
    author: cf.owner("user"),
    mediaUrls: array("string").default([]), // Images, videos, etc.
    hashtags: array("string").default([]),
    mentions: array("record<user>").default([]), // User mentions
    replyTo: option("record<post>"), // Reply chain
    likeCount: int().default(0),
    repostCount: int().default(0),
    replyCount: int().default(0),
    isPublic: bool().default(true),
    createdAt: cf.timestamp(),
    updatedAt: cf.emptyTimestamp(), // Updated manually via events
  },
  indexes: {
    authorIndex: index(["author"]),
    publicPostsIndex: index(["isPublic", "createdAt"]),
    hashtagIndex: index(["hashtags"]), // Multi-value index
    replyChainIndex: index(["replyTo"]),
    trendsIndex: index(["createdAt", "likeCount"]), // Trending posts
  },
  events: {
    // Automatically update the updatedAt timestamp
    updateTimestamp: event("post_updated_at")
      .onUpdate()
      .thenDo("UPDATE $after.id SET updatedAt = time::now()"),

    // Extract hashtags automatically from content
    extractHashtags: event("post_hashtag_extraction")
      .onCreate()
      .thenDo(`
        UPDATE $after.id SET 
          hashtags = string::matches($after.content, "#\\\\w+") 
        WHERE array::len(string::matches($after.content, "#\\\\w+")) > 0
      `),

    // Update user post count when creating a post
    incrementPostCount: event("post_count_increment")
      .onCreate()
      .thenDo("UPDATE $after.author SET postCount += 1"),

    // Decrement post count when deleting a post
    decrementPostCount: event("post_count_decrement")
      .onDelete()
      .thenDo("UPDATE $before.author SET postCount -= 1"),
  },
});

// Comment model - replies and comments on posts
const commentSchema = defineSchema({
  table: "comment",
  schemafull: true,
  fields: {
    id: uuid().default("rand::uuid::v4()"),
    content: string()
      .assert("$value != NONE")
      .assert("string::len($value) >= 1 AND string::len($value) <= 2000"),
    author: cf.owner("user"),
    post: cf.owner("post"),
    parentComment: option("record<comment>"), // Nested comments
    likeCount: int().default(0),
    createdAt: cf.timestamp(),
    updatedAt: cf.emptyTimestamp(), // Updated manually via events
  },
  indexes: {
    postCommentsIndex: index(["post", "createdAt"]),
    authorCommentsIndex: index(["author"]),
    nestedCommentsIndex: index(["parentComment"]),
  },
  events: {
    // Automatically update the updatedAt timestamp
    updateTimestamp: event("comment_updated_at")
      .onUpdate()
      .thenDo("UPDATE $after.id SET updatedAt = time::now()"),

    // Update post reply count when comment is created
    updateReplyCount: event("comment_reply_count")
      .onCreate()
      .thenDo("UPDATE $after.post SET replyCount += 1"),
  },
});

// Follow relation - users following other users
const followRelation = defineRelation({
  name: "follow",
  from: "user",
  to: "user",
  fields: {
    createdAt: cf.timestamp(),
    notificationsEnabled: bool().default(true),
  },
});

// Like relation - users liking posts
const likeRelation = defineRelation({
  name: "like",
  from: "user",
  to: "post",
  fields: {
    createdAt: cf.timestamp(),
  },
});

// Block relation - users blocking other users
const blockRelation = defineRelation({
  name: "block",
  from: "user",
  to: "user",
  fields: {
    reason: option("string"),
    createdAt: cf.timestamp(),
  },
});

// Notification model - system notifications
const notificationSchema = defineSchema({
  table: "notification",
  schemafull: true,
  fields: {
    id: uuid().default("rand::uuid::v4()"),
    recipient: cf.owner("user"),
    type: string() // 'like', 'follow', 'mention', 'reply'
      .assert('$value INSIDE ["like", "follow", "mention", "reply"]'),
    actorUser: cf.owner("user"), // Who performed the action
    relatedPost: option("record<post>"), // Optional related post
    message: string().assert("$value != NONE"),
    isRead: bool().default(false),
    createdAt: cf.timestamp(),
  },
  indexes: {
    recipientIndex: index(["recipient", "isRead"]),
    unreadIndex: index(["isRead", "createdAt"]),
    typeIndex: index(["type"]),
  },
});

// Compose the complete social network schema
const socialNetworkSchema = composeSchema({
  models: {
    user: userSchema,
    post: postSchema,
    comment: commentSchema,
    notification: notificationSchema,
  },
  relations: {
    follow: followRelation,
    like: likeRelation,
    block: blockRelation,
  },
});

export default socialNetworkSchema;
