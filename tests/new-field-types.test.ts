/**
 * @fileoverview Tests for new SurrealDB 3.x field types and features.
 */

import { describe, expect, it } from 'vitest';
import {
  array,
  bytes,
  datetime,
  defineSchema,
  int,
  literal,
  nullType,
  number,
  range,
  record,
  set,
  string,
} from '../src/schema';

describe('New Field Types (SurrealDB 3.x)', () => {
  describe('bytes()', () => {
    it('should create a bytes field', () => {
      const field = bytes().build();
      expect(field.type).toBe('bytes');
    });

    it('should support readonly modifier', () => {
      const field = bytes().readonly().build();
      expect(field.type).toBe('bytes');
      expect(field.readonly).toBe(true);
    });
  });

  describe('number()', () => {
    it('should create a number field', () => {
      const field = number().build();
      expect(field.type).toBe('number');
    });

    it('should support default values', () => {
      const field = number().default(0).build();
      expect(field.type).toBe('number');
      expect(field.default).toBe(0);
    });
  });

  describe('nullType()', () => {
    it('should create a null field', () => {
      const field = nullType().build();
      expect(field.type).toBe('null');
    });
  });

  describe('literal()', () => {
    it('should create a literal type with string values', () => {
      const field = literal('active', 'pending', 'inactive').build();
      expect(field.type).toBe('"active" | "pending" | "inactive"');
    });

    it('should create a literal type with numeric values', () => {
      const field = literal(1, 2, 3).build();
      expect(field.type).toBe('1 | 2 | 3');
    });

    it('should create a literal type with boolean values', () => {
      const field = literal(true, false).build();
      expect(field.type).toBe('true | false');
    });

    it('should create a literal type with mixed values', () => {
      const field = literal('yes', 'no', 1, 0, true).build();
      expect(field.type).toBe('"yes" | "no" | 1 | 0 | true');
    });
  });

  describe('range()', () => {
    it('should create a range field without element type', () => {
      const field = range().build();
      expect(field.type).toBe('range');
    });

    it('should create a typed range field', () => {
      const field = range('datetime').build();
      expect(field.type).toBe('range<datetime>');
    });

    it('should create an int range', () => {
      const field = range('int').build();
      expect(field.type).toBe('range<int>');
    });
  });

  describe('set()', () => {
    it('should create a basic set field', () => {
      const field = set('string').build();
      expect(field.type).toBe('set<string>');
    });

    it('should create a set with min length', () => {
      const field = set('string', 1).build();
      expect(field.type).toBe('set<string, 1>');
    });

    it('should create a set with min and max length', () => {
      const field = set('string', 1, 10).build();
      expect(field.type).toBe('set<string, 1, 10>');
    });

    it('should support default values', () => {
      const field = set('string').default([]).build();
      expect(field.type).toBe('set<string>');
      expect(field.default).toEqual([]);
    });
  });

  describe('array() with length constraints', () => {
    it('should create array with min length', () => {
      const field = array('string', 1).build();
      expect(field.type).toBe('array<string, 1>');
    });

    it('should create array with min and max length', () => {
      const field = array('int', 0, 100).build();
      expect(field.type).toBe('array<int, 0, 100>');
    });
  });
});

describe('New Field Modifiers (SurrealDB 3.x)', () => {
  describe('.defaultAlways()', () => {
    it('should set defaultAlways flag', () => {
      const field = datetime().defaultAlways('time::now()').build();
      expect(field.default).toBe('time::now()');
      expect(field.defaultAlways).toBe(true);
    });
  });

  describe('.references()', () => {
    it('should set reference to another table', () => {
      const field = record('user').references('user').build();
      expect(field.reference).toBe('user');
    });
  });

  describe('.onDelete()', () => {
    it('should set ON DELETE CASCADE', () => {
      const field = record('user').references('user').onDelete('CASCADE').build();
      expect(field.reference).toBe('user');
      expect(field.onDelete).toBe('CASCADE');
    });

    it('should set ON DELETE SET NULL', () => {
      const field = record('user').references('user').onDelete('SET NULL').build();
      expect(field.onDelete).toBe('SET NULL');
    });

    it('should set ON DELETE RESTRICT', () => {
      const field = record('user').references('user').onDelete('RESTRICT').build();
      expect(field.onDelete).toBe('RESTRICT');
    });
  });
});

describe('Rename Tracking (.was())', () => {
  describe('Field .was()', () => {
    it('should track single previous name', () => {
      const field = string().was('old_name').build();
      expect(field.previousNames).toEqual(['old_name']);
    });

    it('should track multiple previous names', () => {
      const field = string().was(['name_v1', 'name_v2']).build();
      expect(field.previousNames).toEqual(['name_v1', 'name_v2']);
    });

    it('should accumulate previous names', () => {
      const field = string().was('first').was('second').build();
      expect(field.previousNames).toEqual(['first', 'second']);
    });
  });

  describe('Schema .was()', () => {
    it('should track table previous name in defineSchema', () => {
      const schema = defineSchema({
        table: 'user',
        was: 'users',
        fields: {
          name: string(),
        },
      });
      expect(schema.previousNames).toEqual(['users']);
    });

    it('should track multiple table previous names', () => {
      const schema = defineSchema({
        table: 'account',
        was: ['user', 'users'],
        fields: {
          email: string(),
        },
      });
      expect(schema.previousNames).toEqual(['user', 'users']);
    });
  });
});

describe('Integration: Complete Schema with New Features', () => {
  it('should create a complete schema with new field types', () => {
    const schema = defineSchema({
      table: 'document',
      was: 'documents',
      fields: {
        title: string().required(),
        status: literal('draft', 'published', 'archived'),
        tags: set('string', 0, 20),
        content: bytes().comment('Binary content'),
        validRange: range('datetime'),
        scores: array('int', 0, 10),
        authorId: record('user').references('user').onDelete('SET NULL'),
        createdAt: datetime().defaultAlways('time::now()').readonly(),
        version: int().was('doc_version').default(1),
      },
    });

    expect(schema.name).toBe('document');
    expect(schema.previousNames).toEqual(['documents']);
    expect(schema.fields.length).toBe(9);

    // Check status field (literal)
    const statusField = schema.fields.find((f) => f.name === 'status');
    expect(statusField?.type).toBe('"draft" | "published" | "archived"');

    // Check tags field (set)
    const tagsField = schema.fields.find((f) => f.name === 'tags');
    expect(tagsField?.type).toBe('set<string, 0, 20>');

    // Check content field (bytes)
    const contentField = schema.fields.find((f) => f.name === 'content');
    expect(contentField?.type).toBe('bytes');

    // Check validRange field (range)
    const rangeField = schema.fields.find((f) => f.name === 'validRange');
    expect(rangeField?.type).toBe('range<datetime>');

    // Check scores field (array with bounds)
    const scoresField = schema.fields.find((f) => f.name === 'scores');
    expect(scoresField?.type).toBe('array<int, 0, 10>');

    // Check authorId field (references)
    const authorField = schema.fields.find((f) => f.name === 'authorId');
    expect(authorField?.reference).toBe('user');
    expect(authorField?.onDelete).toBe('SET NULL');

    // Check createdAt field (defaultAlways)
    const createdField = schema.fields.find((f) => f.name === 'createdAt');
    expect(createdField?.defaultAlways).toBe(true);
    expect(createdField?.readonly).toBe(true);

    // Check version field (.was())
    const versionField = schema.fields.find((f) => f.name === 'version');
    expect(versionField?.previousNames).toEqual(['doc_version']);
  });
});
