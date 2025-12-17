/**
 * Tests for multiple statements in events using curly braces
 *
 * Verifies that smig properly handles events with multiple SurrealQL statements
 * wrapped in curly braces { ... }
 */

import { describe, expect, it } from 'vitest';
import {
  bool,
  composeSchema,
  datetime,
  defineSchema,
  event,
  int,
  record,
  string,
} from '../src/schema/concise-schema';

describe('Multiple Statements in Events', () => {
  describe('Event Definition with Multiple Statements', () => {
    it('should accept multiple statements wrapped in curly braces', () => {
      const multiStatementEvent = event('multi_action')
        .onCreate()
        .thenDo(`{
          UPDATE $after.author SET postCount += 1;
          CREATE notification SET recipient = $after.author, message = "Post created";
        }`);

      const built = multiStatementEvent.build();

      expect(built.name).toBe('multi_action');
      expect(built.type).toBe('CREATE');
      expect(built.thenStatement).toContain('UPDATE $after.author SET postCount += 1;');
      expect(built.thenStatement).toContain('CREATE notification SET recipient');
    });

    it('should accept multiple statements with FOR loops', () => {
      const loopEvent = event('notify_followers')
        .onCreate()
        .thenDo(`{
          FOR $follower IN (SELECT VALUE in FROM follow WHERE out = $after.author) {
            CREATE notification SET recipient = $follower, message = "New post!";
          };
          UPDATE $after.author SET lastPostAt = time::now();
        }`);

      const built = loopEvent.build();

      expect(built.name).toBe('notify_followers');
      expect(built.thenStatement).toContain('FOR $follower IN');
      expect(built.thenStatement).toContain('UPDATE $after.author SET lastPostAt');
    });

    it('should accept multiple statements with IF conditions', () => {
      const conditionalEvent = event('conditional_actions')
        .onUpdate()
        .when('$before.status != $after.status')
        .thenDo(`{
          IF $after.status = "published" {
            UPDATE $after.author SET publishedCount += 1;
          };
          CREATE audit_log SET action = "status_change", old = $before.status, new = $after.status;
        }`);

      const built = conditionalEvent.build();

      expect(built.name).toBe('conditional_actions');
      expect(built.when).toBe('$before.status != $after.status');
      expect(built.thenStatement).toContain('IF $after.status = "published"');
      expect(built.thenStatement).toContain('CREATE audit_log');
    });

    it('should accept multiple LET statements followed by actions', () => {
      const letEvent = event('complex_calculation')
        .onCreate()
        .thenDo(`{
          LET $score = array::len($after.tags) * 10;
          LET $multiplier = IF $after.isPremium { 2 } ELSE { 1 };
          UPDATE $after.id SET calculatedScore = $score * $multiplier;
        }`);

      const built = letEvent.build();

      expect(built.name).toBe('complex_calculation');
      expect(built.thenStatement).toContain('LET $score =');
      expect(built.thenStatement).toContain('LET $multiplier =');
      expect(built.thenStatement).toContain('UPDATE $after.id SET calculatedScore');
    });

    it('should work in a full schema definition', () => {
      const postSchema = defineSchema({
        table: 'post',
        schemafull: true,
        fields: {
          title: string().required(),
          content: string().required(),
          author: record('user'),
          viewCount: int().default(0),
          likeCount: int().default(0),
          createdAt: datetime().value('time::now()'),
        },
        events: {
          // Single statement event
          updateViews: event('increment_views')
            .onUpdate()
            .when('$before.viewCount != $after.viewCount')
            .thenDo('UPDATE $after.author SET totalViews += 1'),

          // Multiple statement event
          onCreate: event('post_created_actions')
            .onCreate()
            .thenDo(`{
              UPDATE $after.author SET postCount += 1;
              CREATE notification SET
                recipient = $after.author,
                message = "Your post has been created",
                type = "info",
                createdAt = time::now();
              FOR $follower IN (SELECT VALUE in FROM follow WHERE out = $after.author) {
                CREATE notification SET
                  recipient = $follower,
                  message = "New post from someone you follow",
                  type = "new_post";
              };
            }`),
        },
      });

      expect(postSchema.name).toBe('post');
      expect(postSchema.events).toHaveLength(2);

      const multiEvent = postSchema.events.find((e) => e.name === 'post_created_actions');
      expect(multiEvent).toBeDefined();
      expect(multiEvent?.thenStatement).toContain('UPDATE $after.author SET postCount += 1');
      expect(multiEvent?.thenStatement).toContain('FOR $follower IN');
    });

    it('should preserve semicolons between statements', () => {
      const eventWithSemicolons = event('semicolon_test')
        .onCreate()
        .thenDo(`{
          UPDATE table1 SET field = value;
          UPDATE table2 SET field = value;
          UPDATE table3 SET field = value;
        }`);

      const built = eventWithSemicolons.build();

      // Count semicolons in the statement
      const semicolonCount = (built.thenStatement.match(/;/g) || []).length;
      expect(semicolonCount).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Event Definition - Edge Cases', () => {
    it('should handle empty braces gracefully', () => {
      // This should technically be invalid but let's verify behavior
      const emptyBraces = event('empty_action').onCreate().thenDo('{ }');

      const built = emptyBraces.build();
      expect(built.thenStatement).toBe('{ }');
    });

    it('should handle nested braces in IF statements', () => {
      const nestedBraces = event('nested_braces')
        .onCreate()
        .thenDo(`{
          IF $after.type = "premium" {
            IF $after.verified {
              UPDATE $after.id SET tier = "gold";
            } ELSE {
              UPDATE $after.id SET tier = "silver";
            };
          };
        }`);

      const built = nestedBraces.build();
      expect(built.thenStatement).toContain('IF $after.type = "premium"');
      expect(built.thenStatement).toContain('tier = "gold"');
      expect(built.thenStatement).toContain('tier = "silver"');
    });

    it('should handle statements with string literals containing semicolons', () => {
      const stringLiteral = event('string_semicolon')
        .onCreate()
        .thenDo(`{
          CREATE log SET message = "Action completed; next step pending";
          UPDATE counter SET value += 1;
        }`);

      const built = stringLiteral.build();
      expect(built.thenStatement).toContain('Action completed; next step pending');
    });

    it('should handle onDelete events with multiple cleanup statements', () => {
      const cleanupEvent = event('cleanup_all')
        .onDelete()
        .thenDo(`{
          DELETE notification WHERE recipient = $before.id;
          DELETE follow WHERE in = $before.id OR out = $before.id;
          DELETE like WHERE in = $before.id;
          UPDATE stats SET userCount -= 1;
        }`);

      const built = cleanupEvent.build();
      expect(built.type).toBe('DELETE');
      expect(built.thenStatement).toContain('DELETE notification');
      expect(built.thenStatement).toContain('DELETE follow');
      expect(built.thenStatement).toContain('DELETE like');
      expect(built.thenStatement).toContain('UPDATE stats');
    });
  });

  describe('Schema Composition with Multiple Statement Events', () => {
    it('should compose schema with multiple complex events', () => {
      const userSchema = defineSchema({
        table: 'user',
        schemafull: true,
        fields: {
          name: string().required(),
          email: string().required(),
          isVerified: bool().default(false),
          followerCount: int().default(0),
          createdAt: datetime().value('time::now()'),
        },
        events: {
          onVerify: event('user_verified')
            .onUpdate()
            .when('$before.isVerified = false AND $after.isVerified = true')
            .thenDo(`{
              CREATE notification SET
                recipient = $after.id,
                message = "Your account has been verified!",
                type = "verification";
              UPDATE $after.id SET verifiedAt = time::now();
            }`),
        },
      });

      const followSchema = defineSchema({
        table: 'follow',
        schemafull: true,
        fields: {
          follower: record('user').required(),
          following: record('user').required(),
          createdAt: datetime().value('time::now()'),
        },
        events: {
          onFollow: event('follow_actions')
            .onCreate()
            .thenDo(`{
              UPDATE $after.following SET followerCount += 1;
              CREATE notification SET
                recipient = $after.following,
                message = "You have a new follower!",
                type = "follow";
            }`),
          onUnfollow: event('unfollow_actions')
            .onDelete()
            .thenDo(`{
              UPDATE $before.following SET followerCount -= 1;
            }`),
        },
      });

      const schema = composeSchema({
        models: {
          user: userSchema,
          follow: followSchema,
        },
      });

      expect(schema.tables).toHaveLength(2);

      const userTable = schema.tables.find((t) => t.name === 'user');
      const followTable = schema.tables.find((t) => t.name === 'follow');

      expect(userTable?.events).toHaveLength(1);
      expect(followTable?.events).toHaveLength(2);

      // Verify multi-statement events have correct content
      const verifyEvent = userTable?.events[0];
      expect(verifyEvent?.thenStatement).toContain('CREATE notification');
      expect(verifyEvent?.thenStatement).toContain('UPDATE $after.id SET verifiedAt');

      const followEvent = followTable?.events.find((e) => e.name === 'follow_actions');
      expect(followEvent?.thenStatement).toContain(
        'UPDATE $after.following SET followerCount += 1',
      );
      expect(followEvent?.thenStatement).toContain('CREATE notification');
    });
  });
});
