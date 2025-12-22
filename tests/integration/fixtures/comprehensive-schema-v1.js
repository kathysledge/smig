
import {
  analyzer,
  any,
  array,
  bool,
  cf,
  ci,
  ce,
  composeSchema,
  datetime,
  decimal,
  defineRelation,
  defineSchema,
  duration,
  event,
  float,
  fn,
  geometry,
  index,
  int,
  object,
  option,
  record,
  scope,
  string,
  uuid,
} from '../../../dist/schema/concise-schema.js';

// ============================================================================
// COMPREHENSIVE TEST SCHEMA - v1
// Covers every entity type and parameter supported by smig
// ============================================================================

// --- CUSTOM FUNCTION ---
const calculateAge = fn('fn::calculate_age')
  .param('birthdate', 'datetime')
  .returns('int')
  .body('RETURN math::floor(<float> (time::now() - $birthdate) / 60 / 60 / 24 / 365);');

// --- CUSTOM SCOPE ---
const userScope = scope('user_auth')
  .session('24h')
  .signup(`
    CREATE comprehensive_user SET
      email = $email,
      password = crypto::argon2::generate($password),
      createdAt = time::now()
  `)
  .signin(`
    SELECT * FROM comprehensive_user
    WHERE email = $email
    AND crypto::argon2::compare(password, $password)
  `);

// --- CUSTOM ANALYZER ---
const contentAnalyzer = analyzer('content_analyzer')
  .tokenizers(['blank', 'class'])
  .filters(['lowercase', 'ascii']);

// --- TABLE: comprehensive_user ---
// Tests all basic field types and modifiers
const comprehensiveUser = defineSchema({
  table: 'comprehensive_user',
  fields: {
    // String with email validation (using SurrealDB v3 function)
    // Note: DELETE permissions not allowed on fields in SurrealDB v3
    email: string()
      .assert('string::is_email($value)')
      .permissions('FOR select WHERE true FOR create, update WHERE $auth.id = id'),

    // String with length constraints
    username: string()
      .assert('$value != NONE')
      .assert('string::len($value) >= 3')
      .assert('string::len($value) <= 50'),

    // Optional string
    displayName: option('string'),

    // Boolean with default
    isActive: bool().default(true),

    // Integer with range
    age: option('int'),

    // Float field
    rating: float().default(0.0),

    // Decimal for precision
    balance: decimal().default('0.00'),

    // UUID field
    referralCode: uuid().default('rand::uuid::v7()'),

    // Duration field
    sessionTimeout: duration().default('30m'),

    // Datetime with value
    createdAt: datetime().value('time::now()'),

    // Empty datetime
    lastLoginAt: option('datetime'),

    // Object field
    settings: option('object'),

    // Geometry field
    location: option('geometry'),

    // Array of strings
    tags: array('string').default([]),

    // Array of records
    friends: array(record('comprehensive_user')).default([]),

    // Enum-like string constraint
    status: string()
      .default('active')
      .assert('$value INSIDE ["active", "inactive", "suspended", "deleted"]'),

    // Nested fields
    'profile.bio': option('string'),
    'profile.website': option('string'),

    // Computed field
    isNewUser: bool().computed('time::now() - createdAt < 7d'),
  },
  indexes: {
    // Unique index
    emailIndex: index(['email']).unique(),

    // Simple btree index
    usernameIndex: index(['username']),

    // Composite index
    statusActiveIndex: index(['status', 'isActive']),

    // Hash index
    referralIndex: index(['referralCode']).hash(),
  },
  events: {
    // onCreate event
    welcomeEmail: event('send_welcome')
      .onCreate()
      .thenDo('CREATE notification SET recipient = $after.id, message = "Welcome!", type = "welcome"'),

    // onUpdate event with condition
    profileUpdate: event('track_profile_update')
      .onUpdate()
      .when('$before.displayName != $after.displayName')
      .thenDo('CREATE audit_log SET user = $after.id, action = "profile_update", time = time::now()'),

    // onDelete event
    cleanup: event('cleanup_user_data')
      .onDelete()
      .thenDo('DELETE notification WHERE recipient = $before.id'),
  },
});

// --- TABLE: comprehensive_post ---
// Tests record references, arrays, and more complex fields
const comprehensivePost = defineSchema({
  table: 'comprehensive_post',
  fields: {
    title: string()
      .assert('$value != NONE')
      .assert('string::len($value) >= 1 AND string::len($value) <= 200'),

    content: string().assert('$value != NONE'),

    // Record reference
    author: record('comprehensive_user').required(),

    // Optional record reference
    editedBy: option('record<comprehensive_user>'),

    // Array of record references
    mentions: array(record('comprehensive_user')).default([]),

    // Nested reply reference
    replyTo: option('record<comprehensive_post>'),

    // Integer counter
    viewCount: int().default(0),
    likeCount: int().default(0),

    // Boolean flags
    isPublished: bool().default(false),
    isPinned: bool().default(false),

    // Timestamps
    createdAt: datetime().value('time::now()'),
    publishedAt: option('datetime'),
    updatedAt: option('datetime'),

    // Tags array
    hashtags: array('string').default([]),
  },
  indexes: {
    authorIndex: index(['author']),
    publishedIndex: index(['isPublished', 'createdAt']),
    hashtagIndex: index(['hashtags']),
  },
  events: {
    updateTimestamp: event('post_updated')
      .onUpdate()
      .thenDo('UPDATE $after.id SET updatedAt = time::now()'),

    // Multiple statements event (tests curly brace handling)
    multiAction: event('multi_action_event')
      .onCreate()
      .thenDo(`{
        UPDATE $after.author SET postCount += 1;
        CREATE notification SET recipient = $after.author, message = "Post created", type = "info";
      }`),
  },
});

// --- TABLE: comprehensive_comment ---
// Tests union types and nested structures
const comprehensiveComment = defineSchema({
  table: 'comprehensive_comment',
  fields: {
    content: string().assert('$value != NONE'),
    author: record('comprehensive_user').required(),

    // Union type - can reference post OR comment
    replyTo: record(['comprehensive_post', 'comprehensive_comment']),

    // Generic record (any table)
    subject: option('record'),

    createdAt: datetime().value('time::now()'),

    // Votes nested structure
    'votes.up': array(record('comprehensive_user')).default([]),
    'votes.down': array(record('comprehensive_user')).default([]),
    'votes.score': int().computed('array::len(votes.up) - array::len(votes.down)'),
  },
  indexes: {
    authorIndex: index(['author']),
    replyIndex: index(['replyTo']),
  },
});

// --- TABLE: notification ---
// Tests enum validation
const notification = defineSchema({
  table: 'notification',
  fields: {
    recipient: record('comprehensive_user').required(),
    message: string().assert('$value != NONE'),
    type: string().assert('$value INSIDE ["welcome", "info", "warning", "error"]'),
    isRead: bool().default(false),
    createdAt: datetime().value('time::now()'),
  },
  indexes: {
    recipientIndex: index(['recipient', 'isRead']),
  },
});

// --- TABLE: audit_log ---
// For event logging
const auditLog = defineSchema({
  table: 'audit_log',
  fields: {
    user: record('comprehensive_user').required(),
    action: string().required(),
    time: datetime().value('time::now()'),
    details: option('object'),
  },
  indexes: {
    userIndex: index(['user']),
    actionIndex: index(['action']),
  },
});

// --- RELATION: follow ---
// Tests self-referencing relation
const followRelation = defineRelation({
  name: 'comprehensive_follow',
  from: 'comprehensive_user',
  to: 'comprehensive_user',
  fields: {
    createdAt: datetime().value('time::now()'),
    notificationsEnabled: bool().default(true),
  },
});

// --- RELATION: like ---
// Tests user-to-post relation
const likeRelation = defineRelation({
  name: 'comprehensive_like',
  from: 'comprehensive_user',
  to: 'comprehensive_post',
  fields: {
    createdAt: datetime().value('time::now()'),
    strength: int().default(1).assert('$value >= 1 AND $value <= 5'),
  },
});

// --- COMPOSE SCHEMA ---
export default composeSchema({
  models: {
    comprehensive_user: comprehensiveUser,
    comprehensive_post: comprehensivePost,
    comprehensive_comment: comprehensiveComment,
    notification: notification,
    audit_log: auditLog,
  },
  relations: {
    comprehensive_follow: followRelation,
    comprehensive_like: likeRelation,
  },
  functions: {
    calculateAge: calculateAge,
  },
  scopes: {
    user_auth: userScope,
  },
  analyzers: {
    content_analyzer: contentAnalyzer,
  },
  comments: ['Comprehensive test schema vv1 covering all smig features'],
});
