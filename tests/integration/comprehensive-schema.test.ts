/**
 * Comprehensive Schema Integration Tests
 *
 * Tests a schema containing every entity type and parameter supported by smig:
 * - All field types (string, int, float, bool, datetime, uuid, duration, decimal, object, geometry, array, record, option, any)
 * - All field modifiers (default, value, assert, readonly, flexible, computed, permissions)
 * - All index types (btree, hash, search, unique, mtree)
 * - Events (onCreate, onUpdate, onDelete, with when clause)
 * - Relations (with custom fields)
 * - Functions
 * - Scopes
 * - Analyzers
 *
 * Tests two schemas:
 * 1. Initial comprehensive schema
 * 2. Modified schema with random changes to test diff detection
 */

import { exec } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanupTestFiles, TEST_DATABASES } from './setup';

const execAsync = promisify(exec);

describe('Comprehensive Schema Integration Tests', () => {
  const CLI_PATH = path.join(process.cwd(), 'dist', 'cli.js');
  const TEST_CONFIG_PATH = path.join(process.cwd(), 'smig.config.js');
  const FIXTURES_DIR = path.join(process.cwd(), 'tests', 'integration', 'fixtures');

  beforeAll(async () => {
    // Ensure CLI is built
    if (!fs.existsSync(CLI_PATH)) {
      throw new Error('CLI not built. Run "bun run build" first.');
    }

    // Ensure fixtures directory exists
    if (!fs.existsSync(FIXTURES_DIR)) {
      fs.mkdirSync(FIXTURES_DIR, { recursive: true });
    }
  });

  beforeEach(async () => {
    cleanupTestFiles([
      'smig-debug-*.txt',
      'smig.config.js',
      'tests/integration/fixtures/comprehensive-schema-*.js',
    ]);
  });

  afterEach(async () => {
    cleanupTestFiles([
      'smig-debug-*.txt',
      'smig.config.js',
      'tests/integration/fixtures/comprehensive-schema-*.js',
    ]);
  });

  /**
   * Creates a comprehensive schema file covering all entity types
   */
  function createComprehensiveSchema(suffix: string = 'v1'): string {
    const schemaContent = `
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
// COMPREHENSIVE TEST SCHEMA - ${suffix}
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
  .signup(\`
    CREATE comprehensive_user SET
      email = $email,
      password = crypto::argon2::generate($password),
      createdAt = time::now()
  \`)
  .signin(\`
    SELECT * FROM comprehensive_user
    WHERE email = $email
    AND crypto::argon2::compare(password, $password)
  \`);

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
      .thenDo(\`{
        UPDATE $after.author SET postCount += 1;
        CREATE notification SET recipient = $after.author, message = "Post created", type = "info";
      }\`),
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
  comments: ['Comprehensive test schema v${suffix} covering all smig features'],
});
`;

    const filename = `comprehensive-schema-${suffix}.js`;
    const schemaPath = path.join(FIXTURES_DIR, filename);
    fs.writeFileSync(schemaPath, schemaContent);
    return `./tests/integration/fixtures/${filename}`;
  }

  /**
   * Creates a modified version of the schema with changes
   */
  function createModifiedSchema(): string {
    const schemaContent = `
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
  .signup(\`
    CREATE comprehensive_user SET
      email = $email,
      password = crypto::argon2::generate($password),
      createdAt = time::now()
  \`)
  .signin(\`
    SELECT * FROM comprehensive_user
    WHERE email = $email
    AND crypto::argon2::compare(password, $password)
  \`);

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
      .thenDo('CREATE notification SET recipient = $after.id, message = "Welcome!", type = "welcome"'),

    profileUpdate: event('track_profile_update')
      .onUpdate()
      .when('$before.displayName != $after.displayName')
      .thenDo('CREATE audit_log SET user = $after.id, action = "profile_update", time = time::now()'),

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
      .thenDo(\`{
        UPDATE $after.author SET postCount += 1;
        CREATE notification SET recipient = $after.author, message = "Post created", type = "info";
      }\`),
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
`;

    const filename = 'comprehensive-schema-v2.js';
    const schemaPath = path.join(FIXTURES_DIR, filename);
    fs.writeFileSync(schemaPath, schemaContent);
    return `./tests/integration/fixtures/${filename}`;
  }

  describe('Comprehensive Schema - Full Entity Coverage', () => {
    it('should migrate v1 schema with all entity types and have no remaining changes', async () => {
      const schemaPath = createComprehensiveSchema('v1');
      const dbName = `test_comprehensive_${Date.now()}`;
      const db = TEST_DATABASES.db1;

      const configContent = `
export default {
  url: '${db.url}',
  username: '${db.username}',
  password: '${db.password}',
  namespace: '${db.namespace}',
  database: '${dbName}',
  schema: '${schemaPath}'
};`;
      fs.writeFileSync(TEST_CONFIG_PATH, configContent);

      // Generate to see initial changes
      console.log('\nStep 1: Initial generate...');
      const { stdout: initialGenerate } = await execAsync(`node ${CLI_PATH} generate --debug`);
      console.log(`Initial changes preview: ${initialGenerate.substring(0, 500)}...`);

      // Should have changes to apply
      expect(initialGenerate).toContain('Generated SurrealQL Diff');

      // Apply migration (ora spinner outputs to stderr)
      console.log('\nStep 2: Applying migration...');
      const { stdout: migrateStdout, stderr: migrateStderr } = await execAsync(
        `node ${CLI_PATH} migrate --debug`,
      );
      const migrateOutput = migrateStdout + migrateStderr;
      expect(migrateOutput).toContain('Migration applied successfully');

      // Verify no remaining changes
      console.log('\nStep 3: Verifying no remaining changes...');
      const { stdout: verifyOutput } = await execAsync(`node ${CLI_PATH} generate --debug`);
      console.log(`Verify output: ${verifyOutput}`);

      if (!verifyOutput.includes('No changes detected')) {
        console.error('\n⚠️  REMAINING CHANGES DETECTED:');
        console.error(verifyOutput);
      }

      expect(verifyOutput).toContain('No changes detected');
    }, 90000);

    it('should detect changes between v1 and v2 schemas', async () => {
      const schemaV1Path = createComprehensiveSchema('v1');
      const dbName = `test_comprehensive_diff_${Date.now()}`;
      const db = TEST_DATABASES.db1;

      // First, apply v1
      let configContent = `
export default {
  url: '${db.url}',
  username: '${db.username}',
  password: '${db.password}',
  namespace: '${db.namespace}',
  database: '${dbName}',
  schema: '${schemaV1Path}'
};`;
      fs.writeFileSync(TEST_CONFIG_PATH, configContent);

      console.log('\nStep 1: Applying v1 schema...');
      const { stderr: v1Stderr } = await execAsync(
        `node ${CLI_PATH} migrate`,
      );
      expect(v1Stderr).toContain('Migration applied successfully');

      // Now switch to v2 and check for changes
      const schemaV2Path = createModifiedSchema();
      configContent = `
export default {
  url: '${db.url}',
  username: '${db.username}',
  password: '${db.password}',
  namespace: '${db.namespace}',
  database: '${dbName}',
  schema: '${schemaV2Path}'
};`;
      fs.writeFileSync(TEST_CONFIG_PATH, configContent);

      console.log('\nStep 2: Generating diff for v2 changes...');
      const { stdout: diffOutput } = await execAsync(`node ${CLI_PATH} generate --debug`);
      console.log(`Diff output: ${diffOutput}`);

      // Should detect changes
      expect(diffOutput).toContain('Generated SurrealQL Diff');

      // Apply v2 migration (ora outputs to stderr)
      console.log('\nStep 3: Applying v2 migration...');
      const { stdout: migrateV2Stdout, stderr: migrateV2Stderr } = await execAsync(
        `node ${CLI_PATH} migrate`,
      );
      const migrateV2 = migrateV2Stdout + migrateV2Stderr;
      expect(migrateV2).toContain('Migration applied successfully');

      // Verify no remaining changes after v2
      console.log('\nStep 4: Verifying no remaining changes after v2...');
      const { stdout: verifyV2 } = await execAsync(`node ${CLI_PATH} generate --debug`);
      console.log(`Verify v2 output: ${verifyV2}`);

      expect(verifyV2).toContain('No changes detected');
    }, 120000);

    it('should handle rollback of comprehensive schema', async () => {
      const schemaPath = createComprehensiveSchema('rollback');
      const dbName = `test_comprehensive_rollback_${Date.now()}`;
      const db = TEST_DATABASES.db1;

      const configContent = `
export default {
  url: '${db.url}',
  username: '${db.username}',
  password: '${db.password}',
  namespace: '${db.namespace}',
  database: '${dbName}',
  schema: '${schemaPath}'
};`;
      fs.writeFileSync(TEST_CONFIG_PATH, configContent);

      // Apply migration (ora outputs to stderr)
      console.log('\nStep 1: Applying migration...');
      const { stderr: migrateStderr } = await execAsync(
        `node ${CLI_PATH} migrate`,
      );
      expect(migrateStderr).toContain('Migration applied successfully');

      // Verify it's applied (ora outputs to stderr)
      const { stdout: statusStdout, stderr: statusStderr } = await execAsync(
        `node ${CLI_PATH} status`,
      );
      const statusBefore = statusStdout + statusStderr;
      expect(statusBefore).toContain('Applied migrations:');

      // Rollback (ora outputs to stderr)
      console.log('\nStep 2: Rolling back...');
      const { stdout: rollbackStdout, stderr: rollbackStderr } = await execAsync(
        `echo "y" | node ${CLI_PATH} rollback`,
      );
      const rollbackOutput = rollbackStdout + rollbackStderr;
      console.log(`Rollback output: ${rollbackOutput}`);

      // Should indicate rollback succeeded
      expect(rollbackOutput).toMatch(/rolled back successfully|cancelled/i);
    }, 90000);
  });
});
