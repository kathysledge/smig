import {
  analyzer,
  any,
  array,
  bool,
  composeSchema,
  datetime,
  defineSchema,
  event,
  fn,
  index,
  int,
  option,
  record,
  scope,
  string,
} from 'smig';

// ------------------------------
// FUNCTION: days_since
// ------------------------------
const daysSince = fn('fn::days_since')
  .param('time', 'datetime')
  .returns('float')
  .body('RETURN <float> (time::now() - $time) / 60 / 60 / 24;');

// ------------------------------
// SCOPE: account authentication
// ------------------------------
const accountScope = scope('account')
  .session('7d')
  .signup(`
    CREATE user SET
      email = $email,
      name = $username,
      password = crypto::argon2::generate($password),
      dateJoined = time::now()
  `)
  .signin(`
    SELECT *
    FROM user
    WHERE (email = $id OR name = $id)
    AND crypto::argon2::compare(password, $password)
  `);

// ------------------------------
// ANALYZER: relevanceSearch
// ------------------------------
const relevanceSearch = analyzer('relevanceSearch')
  .tokenizers(['camel', 'class'])
  .filters(['ascii', 'snowball(english)']);

// ------------------------------
// TABLE: confirmation
// ------------------------------
const confirmation = defineSchema({
  table: 'confirmation',
  schemafull: false, // SCHEMALESS
  fields: {},
});

// ------------------------------
// TABLE: passwordReset
// ------------------------------
const passwordReset = defineSchema({
  table: 'passwordReset',
  schemafull: false, // SCHEMALESS
  fields: {},
});

// ------------------------------
// TABLE: user
// ------------------------------
const user = defineSchema({
  table: 'user',
  schemafull: false, // SCHEMALESS
  permissions: {
    select: 'id = $auth.id',
    update: 'id = $auth.id',
    create: 'roles CONTAINS "admin"',
    delete: 'roles CONTAINS "admin"',
  },
  fields: {
    email: string().assert('string::is_email($value)'), // SurrealDB v3 uses underscores
    name: string()
      .assert('$value != NONE')
      .assert('string::len($value) >= 3')
      .assert('string::len($value) <= 32'), // SurrealDB v3: use length validation
    link: option('string'),
    description: option('string'),
    topics: array(record('topic')).default([]),
    followers: array(record('user')).default([]),
    following: array(record('user')).default([]),
    dateJoined: datetime().default('time::now()'),
    tokens: int().default(0).assert('$value >= 0').assert('$value <= 65536'),
    roles: array(string()).default([]),
    traits: array(string()).default([]),
    // Nested vote fields
    'votes.positive': array(record('user')).default([]),
    'votes.misleading': array(record('user')).default([]),
    'votes.negative': array(record('user')).default([]),
    // Computed vote score using new computed() method
    'votes.score': int().computed(`
        array::len(votes.positive) -
        (<float> array::len(votes.misleading) / 2) -
        array::len(votes.negative)
      `),
  },
  indexes: {
    email: index(['email']).unique(),
    name: index(['name']).unique(),
  },
});

// ------------------------------
// TABLE: topic
// ------------------------------
const topic = defineSchema({
  table: 'topic',
  schemafull: false, // SCHEMALESS
  fields: {
    posts: array(record('post')).default([]),
    threads: array(record('thread')).default([]),
    'votes.positive': array(record('user')).default([]),
    'votes.misleading': array(record('user')).default([]),
    'votes.negative': array(record('user')).default([]),
    // Computed vote score
    'votes.score': int().computed(`
        array::len(votes.positive) -
        (<float> array::len(votes.misleading) / 2) -
        array::len(votes.negative)
      `),
    // Computed followers list
    followers: any().computed(`
        LET $id = id;
        RETURN SELECT VALUE id
        FROM user
        WHERE topics CONTAINS $id;
      `),
    // Computed first used timestamp
    firstUsed: datetime().computed('time::min(array::union(posts.time, threads.time))'),
  },
  events: {
    removeBlank: event('removeBlank')
      .onUpdate()
      .when('$event = "UPDATE"')
      .thenDo(`
        IF array::len($after.posts) = 0 {
          DELETE $after.id;
        };
      `),
  },
});

// ------------------------------
// TABLE: post
// ------------------------------
const post = defineSchema({
  table: 'post',
  schemafull: false, // SCHEMALESS
  fields: {
    user: record('user'),
    title: string().assert('$value = /.{4,128}/'),
    content: string(),
    time: datetime().default('time::now()'),
    replyTo: option(record('post')),
    topics: array(record('topic')).default([]),
    comments: array(record('comment')).default([]),
    images: array(record('image')).default([]),
    archived: bool().default(false),
    edited: bool().default(false),
    timeEdited: option('datetime'),
    visits: int().default(0),
    'votes.positive': array(record('user')).default([]),
    'votes.misleading': array(record('user')).default([]),
    'votes.negative': array(record('user')).default([]),
    'votes.awards': array(record('user')).default([]),
    // Computed vote score
    'votes.score': int().computed(`
        array::len(votes.positive) -
        (<float> array::len(votes.misleading) / 2) -
        array::len(votes.negative)
      `),
  },
  events: {
    updateTopics: event('updateTopics')
      .onCreate()
      .when('$event = "CREATE"')
      .thenDo(`
        FOR $topic IN $after.topics {
          UPDATE $topic SET posts += $after.id;
        };
      `),
  },
});

// ------------------------------
// TABLE: draft
// ------------------------------
const draft = defineSchema({
  table: 'draft',
  schemafull: false, // SCHEMALESS
  fields: {
    user: record('user'),
    title: string().assert('$value = /.{4,128}/'),
    content: string(),
    time: datetime().default('time::now()'),
    replyTo: option(record('post')),
    topics: array(record('topic')).default([]),
    images: array(record('image')).default([]),
  },
});

// ------------------------------
// TABLE: pin
// ------------------------------
const pin = defineSchema({
  table: 'pin',
  schemafull: false, // SCHEMALESS
  fields: {
    post: record('post'),
    user: record('user'),
    active: bool().default(false),
    time: datetime().default('time::now()'),
  },
});

// ------------------------------
// TABLE: thread
// ------------------------------
const thread = defineSchema({
  table: 'thread',
  schemafull: false, // SCHEMALESS
  fields: {
    user: record('user'),
    content: string().assert('$value = /.{4,512}/'),
    time: datetime().default('time::now()'),
    replyTo: option(record('thread')),
    topics: array(record('topic')).default([]),
    images: array(record('image')).default([]),
    edited: bool().default(false),
    timeEdited: option('datetime'),
    visits: int().default(0),
    'votes.positive': array(record('user')).default([]),
    'votes.misleading': array(record('user')).default([]),
    'votes.negative': array(record('user')).default([]),
    'votes.awards': array(record('user')).default([]),
    // Computed vote score
    'votes.score': int().computed(`
        array::len(votes.positive) -
        (<float> array::len(votes.misleading) / 2) -
        array::len(votes.negative)
      `),
  },
  events: {
    updateTopics: event('updateTopics')
      .onCreate()
      .when('$event = "CREATE"')
      .thenDo(`
        FOR $topic IN $after.topics {
          UPDATE $topic SET threads += $after.id;
        };
      `),
  },
});

// ------------------------------
// TABLE: comment
// ------------------------------
const comment = defineSchema({
  table: 'comment',
  schemafull: false, // SCHEMALESS
  fields: {
    user: record('user'),
    post: record('post'),
    content: string(),
    time: datetime().default('time::now()'),
    // Union type - can reference post OR comment
    replyTo: record(['post', 'comment']),
    edited: bool().default(false),
    timeEdited: option('datetime'),
    'votes.positive': array(record('user')).default([]),
    'votes.misleading': array(record('user')).default([]),
    'votes.negative': array(record('user')).default([]),
    // Computed vote score
    'votes.score': int().computed(`
        array::len(votes.positive) -
        (<float> array::len(votes.misleading) / 2) -
        array::len(votes.negative)
      `),
  },
  events: {
    updatePost: event('updatePost')
      .onCreate()
      .when('$event = "CREATE"')
      .thenDo(`
        LET $post = (SELECT VALUE post FROM $after);
        UPDATE $post SET comments += $after.id;
      `),
  },
});

// ------------------------------
// TABLE: image
// ------------------------------
const image = defineSchema({
  table: 'image',
  schemafull: false, // SCHEMALESS
  fields: {
    user: record('user'),
    type: string(),
    tokens: int(),
    time: datetime().default('time::now()'),
    url: any(),
    'votes.positive': array(record('user')).default([]),
    'votes.misleading': array(record('user')).default([]),
    'votes.negative': array(record('user')).default([]),
    // Computed vote score
    'votes.score': int().computed(`
        array::len(votes.positive) -
        (<float> array::len(votes.misleading) / 2) -
        array::len(votes.negative)
      `),
  },
});

// ------------------------------
// TABLE: notification
// ------------------------------
const notification = defineSchema({
  table: 'notification',
  schemafull: false, // SCHEMALESS
  fields: {
    recipient: record('user'),
    // Union type - context can be post, comment, or user
    context: record(['post', 'comment', 'user']),
    message: string(),
    time: datetime().default('time::now()'),
    viewed: bool().default(false),
  },
});

// ------------------------------
// TABLE: feedback
// ------------------------------
const feedback = defineSchema({
  table: 'feedback',
  schemafull: false, // SCHEMALESS
  fields: {
    user: record('user'),
    time: datetime().default('time::now()'),
    content: string(),
    dismissed: bool().default(false),
  },
});

// ------------------------------
// TABLE: report
// ------------------------------
const report = defineSchema({
  table: 'report',
  schemafull: false, // SCHEMALESS
  fields: {
    reporter: record('user'),
    // Generic record - can reference any table
    subject: record(),
    time: datetime().default('time::now()'),
  },
});

// ------------------------------
// TABLE: error
// ------------------------------
const error = defineSchema({
  table: 'error',
  schemafull: false, // SCHEMALESS
  fields: {},
});

// ------------------------------
// COMPOSE COMPLETE SCHEMA
// ------------------------------
export default composeSchema({
  models: {
    confirmation,
    passwordReset,
    user,
    topic,
    post,
    draft,
    pin,
    thread,
    comment,
    image,
    notification,
    feedback,
    report,
    error,
  },
  functions: {
    daysSince,
  },
  scopes: {
    account: accountScope,
  },
  analyzers: {
    relevanceSearch,
  },
  comments: ['Social platform with topics, posts, threads, and voting system'],
});
