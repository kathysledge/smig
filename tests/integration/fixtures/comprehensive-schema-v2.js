import {
  analyzer,
  array,
  bool,
  composeSchema,
  datetime,
  decimal,
  defineRelation,
  defineSchema,
  duration,
  event,
  float,
  fn,
  index,
  int,
  option,
  record,
  scope,
  string,
  uuid,
} from '../../../dist/schema/concise-schema.js';

// ============================================================================
// MODIFIED COMPREHENSIVE TEST SCHEMA - v2
// Has intentional changes from v1 to test diff detection
// ============================================================================

// --- MODIFIED FUNCTION ---
const calculateAge = fn('fn::calculate_age')
  .param('birthdate', 'datetime')
  .param('asOfDate', 'datetime') // NEW PARAMETER
  .returns('int')
  .body('RETURN math::floor(<float> ($asOfDate - $birthdate) / 60 / 60 / 24 / 365);');

// --- SAME SCOPE ---
const userScope = scope('user_auth')
  .session('48h') // CHANGED from 24h
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

// --- SAME ANALYZER ---
const contentAnalyzer = analyzer('content_analyzer')
  .tokenizers(['blank', 'class'])
  .filters(['lowercase', 'ascii']);

// --- MODIFIED TABLE: comprehensive_user ---
const comprehensiveUser = defineSchema({
  table: 'comprehensive_user',
  fields: {
    email: string()
      .assert('string::is_email($value)')
      .permissions('FOR select WHERE true FOR create, update WHERE $auth.id = id'),

    username: string()
      .assert('$value != NONE')
      .assert('string::len($value) >= 3')
      .assert('string::len($value) <= 100'), // CHANGED from 50

    displayName: option('string'),

    isActive: bool().default(true),

    age: option('int'),

    rating: float().default(0.0),

    balance: decimal().default('0.00'),

    referralCode: uuid().default('rand::uuid::v7()'),

    sessionTimeout: duration().default('1h'), // CHANGED from 30m

    createdAt: datetime().value('time::now()'),

    lastLoginAt: option('datetime'),

    settings: option('object'),

    location: option('geometry'),

    tags: array('string').default([]),

    friends: array(record('comprehensive_user')).default([]),

    status: string()
      .default('active')
      .assert('$value INSIDE ["active", "inactive", "suspended", "deleted", "archived"]'), // ADDED "archived"

    'profile.bio': option('string'),
    'profile.website': option('string'),
    'profile.avatar': option('string'), // NEW FIELD

    isNewUser: bool().computed('time::now() - createdAt < 7d'),
  },
  indexes: {
    emailIndex: index(['email']).unique(),
    usernameIndex: index(['username']),
    statusActiveIndex: index(['status', 'isActive']),
    referralIndex: index(['referralCode']).hash(),
    // REMOVED: tagsIndex (testing removal detection)
  },
  events: {
    welcomeEmail: event('send_welcome')
      .onCreate()
      .thenDo(
        'CREATE notification SET recipient = $after.id, message = "Welcome!", type = "welcome"',
      ),

    profileUpdate: event('track_profile_update')
      .onUpdate()
      .when('$before.displayName != $after.displayName')
      .thenDo(
        'CREATE audit_log SET user = $after.id, action = "profile_update", time = time::now()',
      ),

    // REMOVED: cleanup event
  },
});

// --- SAME TABLE: comprehensive_post ---
const comprehensivePost = defineSchema({
  table: 'comprehensive_post',
  fields: {
    title: string()
      .assert('$value != NONE')
      .assert('string::len($value) >= 1 AND string::len($value) <= 200'),

    content: string().assert('$value != NONE'),

    author: record('comprehensive_user').required(),

    editedBy: option('record<comprehensive_user>'),

    mentions: array(record('comprehensive_user')).default([]),

    replyTo: option('record<comprehensive_post>'),

    viewCount: int().default(0),
    likeCount: int().default(0),

    isPublished: bool().default(false),
    isPinned: bool().default(false),

    createdAt: datetime().value('time::now()'),
    publishedAt: option('datetime'),
    updatedAt: option('datetime'),

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

    multiAction: event('multi_action_event')
      .onCreate()
      .thenDo(`{
        UPDATE $after.author SET postCount += 1;
        CREATE notification SET recipient = $after.author, message = "Post created", type = "info";
      }`),
  },
});

// --- SAME TABLE: comprehensive_comment ---
const comprehensiveComment = defineSchema({
  table: 'comprehensive_comment',
  fields: {
    content: string().assert('$value != NONE'),
    author: record('comprehensive_user').required(),

    replyTo: record(['comprehensive_post', 'comprehensive_comment']),

    subject: option('record'),

    createdAt: datetime().value('time::now()'),

    'votes.up': array(record('comprehensive_user')).default([]),
    'votes.down': array(record('comprehensive_user')).default([]),
    'votes.score': int().computed('array::len(votes.up) - array::len(votes.down)'),
  },
  indexes: {
    authorIndex: index(['author']),
    replyIndex: index(['replyTo']),
  },
});

// --- SAME TABLE: notification ---
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

// --- SAME TABLE: audit_log ---
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

// --- SAME RELATIONS ---
const followRelation = defineRelation({
  name: 'comprehensive_follow',
  from: 'comprehensive_user',
  to: 'comprehensive_user',
  fields: {
    createdAt: datetime().value('time::now()'),
    notificationsEnabled: bool().default(true),
  },
});

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
  comments: ['Modified comprehensive test schema v2 with changes from v1'],
});
