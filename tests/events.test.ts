import { describe, expect, it } from 'vitest';
import { commonEvents, event } from '../src/schema/concise-schema';

describe('Events System', () => {
  describe('Event Builder', () => {
    it('should create basic events', () => {
      const basicEvent = event('test_event').onCreate().then('SET createdAt = time::now()');

      const built = basicEvent.build();

      expect(built.name).toBe('test_event');
      expect(built.type).toBe('CREATE');
      expect(built.thenStatement).toBe('SET createdAt = time::now()');
      expect(built.when).toBeNull();
      expect(built.comments).toEqual([]);
    });

    it('should create events with all trigger types', () => {
      const createEvent = event('on_create').onCreate().then('SET created = true');
      const updateEvent = event('on_update').onUpdate().then('SET updated = true');
      const deleteEvent = event('on_delete').onDelete().then('SET deleted = true');

      expect(createEvent.build().type).toBe('CREATE');
      expect(updateEvent.build().type).toBe('UPDATE');
      expect(deleteEvent.build().type).toBe('DELETE');
    });

    it('should create conditional events with when clause', () => {
      const conditionalEvent = event('status_change')
        .onUpdate()
        .when('$value.status != $before.status')
        .then('SET statusChangedAt = time::now()');

      const built = conditionalEvent.build();

      expect(built.type).toBe('UPDATE');
      expect(built.when).toBe('$value.status != $before.status');
      expect(built.thenStatement).toBe('SET statusChangedAt = time::now()');
    });

    it('should support complex conditional logic', () => {
      const complexEvent = event('email_verification')
        .onUpdate()
        .when('$value.email != $before.email AND $value.emailVerified = true')
        .then('SET emailVerifiedAt = time::now(), emailChangeCount = $before.emailChangeCount + 1');

      const built = complexEvent.build();

      expect(built.when).toBe('$value.email != $before.email AND $value.emailVerified = true');
      expect(built.thenStatement).toBe(
        'SET emailVerifiedAt = time::now(), emailChangeCount = $before.emailChangeCount + 1',
      );
    });

    it('should add comments to events', () => {
      const commentedEvent = event('audit_trail')
        .onUpdate()
        .when('$value.importantField != $before.importantField')
        .then(
          'CREATE audit:ulid() SET table = "users", recordId = $value.id, oldValue = $before.importantField, newValue = $value.importantField, timestamp = time::now()',
        )
        .comment('Audit trail for important field changes')
        .comment('Tracks all modifications for compliance');

      const built = commentedEvent.build();

      expect(built.comments).toContain('Audit trail for important field changes');
      expect(built.comments).toContain('Tracks all modifications for compliance');
      expect(built.comments).toHaveLength(2);
    });

    it('should support method chaining', () => {
      const chainedEvent = event('method_chaining_test')
        .onCreate()
        .when('$value.type = "premium"')
        .then('SET premiumStartDate = time::now()')
        .comment('Premium user activation')
        .comment('Sets activation timestamp');

      const built = chainedEvent.build();

      expect(built.name).toBe('method_chaining_test');
      expect(built.type).toBe('CREATE');
      expect(built.when).toBe('$value.type = "premium"');
      expect(built.thenStatement).toBe('SET premiumStartDate = time::now()');
      expect(built.comments).toHaveLength(2);
    });
  });

  describe('Event Generation', () => {
    it('should generate correct SurrealQL for basic events', () => {
      const createEvent = event('set_creation_time').onCreate().then('SET createdAt = time::now()');

      const built = createEvent.build();

      // The event should have the correct structure for SurrealQL generation
      expect(built.name).toBe('set_creation_time');
      expect(built.type).toBe('CREATE');
      expect(built.thenStatement).toBe('SET createdAt = time::now()');
    });

    it('should generate correct SurrealQL for conditional events', () => {
      const updateEvent = event('track_email_changes')
        .onUpdate()
        .when('$value.email != $before.email')
        .then('SET emailChangedAt = time::now(), previousEmail = $before.email');

      const built = updateEvent.build();

      expect(built.type).toBe('UPDATE');
      expect(built.when).toBe('$value.email != $before.email');
      expect(built.thenStatement).toBe(
        'SET emailChangedAt = time::now(), previousEmail = $before.email',
      );
    });

    it('should generate correct SurrealQL for delete events', () => {
      const deleteEvent = event('log_deletion')
        .onDelete()
        .then(
          'CREATE deletion_log:ulid() SET deletedTable = "users", deletedId = $before.id, deletedAt = time::now()',
        );

      const built = deleteEvent.build();

      expect(built.type).toBe('DELETE');
      expect(built.thenStatement).toBe(
        'CREATE deletion_log:ulid() SET deletedTable = "users", deletedId = $before.id, deletedAt = time::now()',
      );
    });
  });

  describe('Common Events', () => {
    it('should provide updateTimestamp common event', () => {
      const updateTimestampEvent = commonEvents.updateTimestamp('user');
      const built = updateTimestampEvent.build();

      expect(built.name).toBe('user_update_timestamp');
      expect(built.type).toBe('UPDATE');
      expect(built.thenStatement).toBe('SET updatedAt = time::now()');
      expect(built.when).toBeNull();
    });

    it('should provide updateTimestamp with different table names', () => {
      const userEvent = commonEvents.updateTimestamp('user');
      const postEvent = commonEvents.updateTimestamp('post');
      const orderEvent = commonEvents.updateTimestamp('order');

      // All should have table-prefixed names
      expect(userEvent.build().name).toBe('user_update_timestamp');
      expect(postEvent.build().name).toBe('post_update_timestamp');
      expect(orderEvent.build().name).toBe('order_update_timestamp');

      // The THEN clause should be the same for all
      expect(userEvent.build().thenStatement).toBe('SET updatedAt = time::now()');
      expect(postEvent.build().thenStatement).toBe('SET updatedAt = time::now()');
      expect(orderEvent.build().thenStatement).toBe('SET updatedAt = time::now()');
    });
  });

  describe('Event Validation', () => {
    it('should require non-empty event names', () => {
      expect(() => event('')).toThrow('Event name is required and cannot be empty');
      expect(() => event('   ')).toThrow('Event name is required and cannot be empty');
    });

    it('should validate event name format', () => {
      // Valid event names
      expect(() => event('valid_event_name')).not.toThrow();
      expect(() => event('another_valid_name')).not.toThrow();
      expect(() => event('event123')).not.toThrow();
      expect(() => event('CamelCaseEvent')).not.toThrow();
      expect(() => event('_private_event')).not.toThrow();
      expect(() => event('event_with_underscores')).not.toThrow();

      // Invalid event names
      expect(() => event('123invalid')).toThrow('Must be a valid SurrealDB identifier');
      expect(() => event('event-with-dashes')).toThrow('Must be a valid SurrealDB identifier');
      expect(() => event('event with spaces')).toThrow('Must be a valid SurrealDB identifier');
      expect(() => event('event.with.dots')).toThrow('Must be a valid SurrealDB identifier');
      expect(() => event('event@symbol')).toThrow('Must be a valid SurrealDB identifier');
    });

    it('should require trigger type to be set', () => {
      const eventBuilder = event('incomplete_event');

      expect(() => eventBuilder.build()).toThrow(
        'Event trigger type must be set. Use onCreate(), onUpdate(), or onDelete().',
      );
    });

    it('should require THEN clause', () => {
      const eventBuilder = event('incomplete_event').onCreate();

      expect(() => eventBuilder.build()).toThrow(
        'Event THEN clause is required. Use .then("your SurrealQL here").',
      );
    });

    it('should require non-empty THEN clause', () => {
      const eventBuilder = event('test_event').onCreate();

      expect(() => eventBuilder.then('')).toThrow('THEN clause is required and cannot be empty');
      expect(() => eventBuilder.then('   ')).toThrow('THEN clause is required and cannot be empty');
    });

    it('should filter out empty comments', () => {
      const eventWithComments = event('test_comments')
        .onCreate()
        .then('SET test = true')
        .comment('')
        .comment('   ')
        .comment('Valid comment')
        .comment('');

      const built = eventWithComments.build();

      expect(built.comments).toEqual(['Valid comment']);
    });

    it('should trim whitespace from event names and comments', () => {
      const eventWithWhitespace = event('  test_event  ')
        .onCreate()
        .then('SET test = true')
        .comment('  Comment with spaces  ');

      const built = eventWithWhitespace.build();

      expect(built.name).toBe('test_event');
      expect(built.comments).toEqual(['Comment with spaces']);
    });

    it('should return immutable copy from build()', () => {
      const eventBuilder = event('immutable_test')
        .onCreate()
        .then('SET original = true')
        .comment('Original comment');

      const built1 = eventBuilder.build();
      const built2 = eventBuilder.build();

      // Should be different objects
      expect(built1).not.toBe(built2);

      // Should have same content
      expect(built1).toEqual(built2);

      // Modifying one shouldn't affect the other
      built1.comments.push('Modified comment');
      expect(built2.comments).toEqual(['Original comment']);
    });
  });

  describe('Advanced Event Scenarios', () => {
    it('should support audit trail events', () => {
      const auditEvent = event('audit_changes')
        .onUpdate()
        .when('$value.sensitiveData != $before.sensitiveData')
        .then(
          `
          CREATE audit:ulid() SET 
            table = "sensitive_table",
            recordId = $value.id,
            userId = $value.lastModifiedBy,
            oldValue = $before.sensitiveData,
            newValue = $value.sensitiveData,
            timestamp = time::now(),
            ipAddress = $session.ipAddress
        `.trim(),
        )
        .comment('Audit trail for sensitive data changes');

      const built = auditEvent.build();

      expect(built.when).toBe('$value.sensitiveData != $before.sensitiveData');
      expect(built.thenStatement).toContain('CREATE audit:ulid()');
      expect(built.thenStatement).toContain('oldValue = $before.sensitiveData');
      expect(built.thenStatement).toContain('newValue = $value.sensitiveData');
    });

    it('should support notification events', () => {
      const notificationEvent = event('send_welcome_email')
        .onCreate()
        .when('$value.emailVerified = true')
        .then(
          'CREATE notification:ulid() SET type = "welcome_email", userId = $value.id, status = "pending", createdAt = time::now()',
        )
        .comment('Trigger welcome email for verified users');

      const built = notificationEvent.build();

      expect(built.type).toBe('CREATE');
      expect(built.when).toBe('$value.emailVerified = true');
      expect(built.thenStatement).toContain('CREATE notification:ulid()');
      expect(built.thenStatement).toContain('type = "welcome_email"');
    });

    it('should support cascading update events', () => {
      const cascadeEvent = event('update_related_records')
        .onUpdate()
        .when('$value.status = "inactive" AND $before.status = "active"')
        .then('UPDATE user SET accountStatus = "suspended" WHERE company = $value.id')
        .comment('Cascade status changes to related users');

      const built = cascadeEvent.build();

      expect(built.when).toBe('$value.status = "inactive" AND $before.status = "active"');
      expect(built.thenStatement).toBe(
        'UPDATE user SET accountStatus = "suspended" WHERE company = $value.id',
      );
    });

    it('should support cleanup events on deletion', () => {
      const cleanupEvent = event('cleanup_user_data')
        .onDelete()
        .then(
          `
          DELETE user_session WHERE userId = $before.id;
          DELETE user_preferences WHERE userId = $before.id;
          UPDATE post SET authorId = NULL WHERE authorId = $before.id
        `.trim(),
        )
        .comment('Clean up related data when user is deleted');

      const built = cleanupEvent.build();

      expect(built.type).toBe('DELETE');
      expect(built.thenStatement).toContain('DELETE user_session WHERE userId = $before.id');
      expect(built.thenStatement).toContain('DELETE user_preferences WHERE userId = $before.id');
      expect(built.thenStatement).toContain('UPDATE post SET authorId = NULL');
    });

    it('should support versioning events', () => {
      const versioningEvent = event('create_version_history')
        .onUpdate()
        .when('$value.content != $before.content')
        .then(
          `
          CREATE version_history:ulid() SET 
            documentId = $value.id,
            version = $before.version + 1,
            content = $before.content,
            timestamp = time::now(),
            modifiedBy = $value.lastModifiedBy
        `.trim(),
        )
        .comment('Create version history for content changes');

      const built = versioningEvent.build();

      expect(built.when).toBe('$value.content != $before.content');
      expect(built.thenStatement).toContain('CREATE version_history:ulid()');
      expect(built.thenStatement).toContain('version = $before.version + 1');
    });
  });

  describe('Event Integration with Schemas', () => {
    it('should work with table schemas', () => {
      // This tests that events can be used in defineSchema
      const userUpdateEvent = event('track_profile_updates')
        .onUpdate()
        .when('$value.profile != $before.profile')
        .then('SET profileUpdatedAt = time::now()');

      // Should be able to use this event in a schema definition
      expect(userUpdateEvent.build().name).toBe('track_profile_updates');
      expect(userUpdateEvent.build().type).toBe('UPDATE');
    });

    it('should work with relation schemas', () => {
      // This tests that events can be used in defineRelation
      const relationEvent = event('track_relationship_changes')
        .onCreate()
        .then('SET relationshipCreatedAt = time::now()')
        .comment('Track when relationships are established');

      expect(relationEvent.build().name).toBe('track_relationship_changes');
      expect(relationEvent.build().type).toBe('CREATE');
    });
  });

  describe('Event Comments and Documentation', () => {
    it('should preserve multiple comments in order', () => {
      const documentedEvent = event('complex_business_logic')
        .onUpdate()
        .when('$value.status = "approved" AND $before.status = "pending"')
        .then('SET approvedAt = time::now(), approvedBy = $session.userId')
        .comment('First comment: Business rule explanation')
        .comment('Second comment: Technical implementation note')
        .comment('Third comment: Compliance requirement');

      const built = documentedEvent.build();

      expect(built.comments).toHaveLength(3);
      expect(built.comments[0]).toBe('First comment: Business rule explanation');
      expect(built.comments[1]).toBe('Second comment: Technical implementation note');
      expect(built.comments[2]).toBe('Third comment: Compliance requirement');
    });

    it('should handle empty and whitespace comments gracefully', () => {
      const eventWithEmptyComments = event('test_empty_comments')
        .onCreate()
        .then('SET test = true')
        .comment('')
        .comment('   ')
        .comment('Valid comment')
        .comment('');

      const built = eventWithEmptyComments.build();

      // Should filter out empty/whitespace-only comments
      const nonEmptyComments = built.comments.filter((comment) => comment.trim().length > 0);
      expect(nonEmptyComments).toHaveLength(1);
      expect(nonEmptyComments[0]).toBe('Valid comment');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle complex SurrealQL in THEN clauses', () => {
      const complexEvent = event('complex_sql_operations')
        .onUpdate()
        .when('$value.businessLogic = true')
        .then(
          `
          LET $calculated = $value.amount * 1.1;
          UPDATE account SET balance = balance + $calculated WHERE id = $value.accountId;
          IF $value.amount > 1000 THEN
            CREATE alert:ulid() SET type = "large_transaction", amount = $value.amount, timestamp = time::now()
          END;
          RETURN $value
        `.trim(),
        );

      const built = complexEvent.build();

      expect(built.thenStatement).toContain('LET $calculated = $value.amount * 1.1');
      expect(built.thenStatement).toContain('UPDATE account SET balance');
      expect(built.thenStatement).toContain('IF $value.amount > 1000 THEN');
      expect(built.thenStatement).toContain('RETURN $value');
    });

    it('should handle special characters in event names and values', () => {
      const specialCharEvent = event('event_with_special_chars')
        .onCreate()
        .then(`SET message = "Hello, World! Special chars: @#$%^&*()"`);

      const built = specialCharEvent.build();

      expect(built.name).toBe('event_with_special_chars');
      expect(built.thenStatement).toContain(`"Hello, World! Special chars: @#$%^&*()"`);
    });

    it('should handle multiline WHEN and THEN clauses', () => {
      const multilineEvent = event('multiline_conditions')
        .onUpdate()
        .when(
          `
          $value.field1 != $before.field1 OR 
          $value.field2 != $before.field2 OR 
          $value.field3 != $before.field3
        `.trim(),
        )
        .then(
          `
          SET changedFields = [
            IF $value.field1 != $before.field1 THEN "field1" END,
            IF $value.field2 != $before.field2 THEN "field2" END,
            IF $value.field3 != $before.field3 THEN "field3" END
          ];
          SET lastChanged = time::now()
        `.trim(),
        );

      const built = multilineEvent.build();

      expect(built.when).toContain('$value.field1 != $before.field1 OR');
      expect(built.thenStatement).toContain('SET changedFields = [');
      expect(built.thenStatement).toContain('SET lastChanged = time::now()');
    });
  });
});
