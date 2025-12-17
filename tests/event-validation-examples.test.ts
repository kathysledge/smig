import { describe, expect, it } from 'vitest';
import { event } from '../src/schema/concise-schema';

describe('Event Validation Examples', () => {
  describe('Developer Experience', () => {
    it('should provide helpful error messages for common mistakes', () => {
      // Empty event name
      expect(() => event('')).toThrow('Event name is required and cannot be empty');

      // Invalid identifier starting with number
      expect(() => event('123_event')).toThrow(
        "Invalid event name '123_event'. Must be a valid SurrealDB identifier (letters, numbers, underscores only, cannot start with number).",
      );

      // Missing trigger type
      expect(() => {
        event('my_event').build();
      }).toThrow('Event trigger type must be set. Use onCreate(), onUpdate(), or onDelete().');

      // Missing THEN clause
      expect(() => {
        event('my_event').onCreate().build();
      }).toThrow('Event THEN clause is required. Use .thenDo("your SurrealQL here").');

      // Empty THEN clause
      expect(() => {
        event('my_event').onCreate().thenDo('');
      }).toThrow('THEN clause is required and cannot be empty');
    });

    it('should prevent common SurrealDB identifier mistakes', () => {
      const invalidNames = [
        '123invalid', // starts with number
        'event-with-dashes', // contains dashes
        'event with spaces', // contains spaces
        'event.with.dots', // contains dots
        'event@symbol', // contains @ symbol
        'event#hash', // contains # symbol
        'event$dollar', // contains $ symbol
        'event%percent', // contains % symbol
        'event+plus', // contains + symbol
        'event=equals', // contains = symbol
        'event(parens)', // contains parentheses
        'event[brackets]', // contains brackets
        'event{braces}', // contains braces
      ];

      invalidNames.forEach((name) => {
        expect(() => event(name)).toThrow('Must be a valid SurrealDB identifier');
      });
    });

    it('should accept all valid SurrealDB identifiers', () => {
      const validNames = [
        'valid_event',
        'anotherValidEvent',
        'Event123',
        '_private_event',
        '__double_underscore',
        'event_with_many_underscores_here',
        'CamelCaseEvent',
        'snake_case_event',
        'mixedCase_snake_Event123',
        'a', // single letter
        '_', // single underscore
        'a1', // letter + number
        '_1', // underscore + number
      ];

      validNames.forEach((name) => {
        expect(() => event(name).onCreate().thenDo('SET test = true')).not.toThrow();
      });
    });
  });

  describe('Real-world Validation Scenarios', () => {
    it('should catch incomplete audit event definition', () => {
      expect(() => {
        // Incomplete audit event - missing THEN clause
        event('audit_user_changes').onUpdate().when('$value.email != $before.email').build(); // Should fail here
      }).toThrow('Event THEN clause is required');
    });

    it('should catch invalid notification event name', () => {
      expect(() => {
        // Invalid event name with special characters
        event('notify-admin@email.com')
          .onCreate()
          .thenDo('CREATE notification:ulid() SET type = "admin_alert"');
      }).toThrow('Must be a valid SurrealDB identifier');
    });

    it('should catch empty cleanup action', () => {
      expect(() => {
        // Empty THEN clause in cleanup event
        event('cleanup_user_data').onDelete().thenDo('   '); // Whitespace-only should fail
      }).toThrow('THEN clause is required and cannot be empty');
    });

    it('should validate complete business logic events', () => {
      // This should work - complete event with all required parts
      const businessEvent = event('process_payment')
        .onUpdate()
        .when('$value.status = "paid" AND $before.status = "pending"')
        .thenDo(`
          UPDATE account SET balance = balance + $value.amount WHERE id = $value.accountId;
          CREATE audit:ulid() SET action = "payment_processed", amount = $value.amount, timestamp = time::now();
          CREATE notification:ulid() SET type = "payment_success", userId = $value.userId, amount = $value.amount
        `)
        .comment('Process payment when status changes from pending to paid')
        .comment('Updates account balance and creates audit trail');

      expect(() => businessEvent.build()).not.toThrow();

      const built = businessEvent.build();
      expect(built.name).toBe('process_payment');
      expect(built.type).toBe('UPDATE');
      expect(built.when).toBe('$value.status = "paid" AND $before.status = "pending"');
      expect(built.thenStatement).toContain('UPDATE account SET balance');
      expect(built.comments).toHaveLength(2);
    });
  });

  describe('Migration from Unvalidated Code', () => {
    it('should help developers fix existing unvalidated events', () => {
      // Examples of what used to work but now needs fixing

      // OLD: event('').build() - worked but was invalid
      // NEW: Must provide valid name
      expect(() => event('')).toThrow('Event name is required and cannot be empty');

      // OLD: event('test').build() - worked but was incomplete
      // NEW: Must set trigger type and action
      expect(() => event('test').build()).toThrow('Event trigger type must be set');

      // OLD: event('test').onCreate().build() - worked but was incomplete
      // NEW: Must provide THEN clause
      expect(() => event('test').onCreate().build()).toThrow('Event THEN clause is required');

      // FIXED: Complete event definition
      expect(() => {
        event('test').onCreate().thenDo('SET created = true').build();
      }).not.toThrow();
    });

    it('should maintain backward compatibility for valid events', () => {
      // Events that were valid before should still work
      const validEvents = [
        event('user_created').onCreate().thenDo('SET createdAt = time::now()'),
        event('user_updated').onUpdate().thenDo('SET updatedAt = time::now()'),
        event('user_deleted').onDelete().thenDo('CREATE audit:ulid() SET deleted = $before'),
        event('conditional_update')
          .onUpdate()
          .when('$value.status != $before.status')
          .thenDo('SET statusChangedAt = time::now()'),
      ];

      validEvents.forEach((eventBuilder) => {
        expect(() => eventBuilder.build()).not.toThrow();
      });
    });
  });

  describe('Error Message Quality', () => {
    it('should provide actionable error messages', () => {
      // Test that error messages guide developers to the solution

      try {
        event('incomplete').build();
      } catch (error) {
        expect(error.message).toMatch(/Use onCreate\(\), onUpdate\(\), or onDelete\(\)/);
      }

      try {
        event('incomplete').onCreate().build();
      } catch (error) {
        expect(error.message).toMatch(/Use \.thenDo\("your SurrealQL here"\)/);
      }

      try {
        event('123invalid');
      } catch (error) {
        expect(error.message).toMatch(/Must be a valid SurrealDB identifier/);
        expect(error.message).toMatch(/cannot start with number/);
      }

      try {
        event('test').onCreate().thenDo('');
      } catch (error) {
        expect(error.message).toMatch(/THEN clause is required and cannot be empty/);
      }
    });
  });
});
