import { describe, expect, it } from 'vitest';
import {
  array,
  bool,
  commonEvents,
  commonFields,
  commonIndexes,
  composeSchema,
  datetime,
  defineRelation,
  defineSchema,
  event,
  index,
  int,
  object,
  option,
  record,
  string,
} from '../src/schema/concise-schema';

describe('Concise Schema System', () => {
  describe('Field Types', () => {
    it('should create basic field types', () => {
      const stringField = string();
      const intField = int();
      const boolField = bool();
      const datetimeField = datetime();

      expect(stringField.build().type).toBe('string');
      expect(intField.build().type).toBe('int');
      expect(boolField.build().type).toBe('bool');
      expect(datetimeField.build().type).toBe('datetime');
    });

    it('should create complex field types', () => {
      const arrayField = array('string');
      const recordField = record('user');
      const objectField = object();

      expect(arrayField.build().type).toBe('array<string>');
      expect(recordField.build().type).toBe('record<user>');
      expect(objectField.build().type).toBe('object');
    });

    it('should apply field modifiers', () => {
      const field = string()
        .default('test')
        .value('rand::ulid()')
        .assert('$value != NONE')
        .comment('Test field');

      const built = field.build();
      expect(built.default).toBe('test');
      expect(built.value).toBe('rand::ulid()');
      expect(built.assert).toBe('$value != NONE');
      expect(built.comment).toBe('Test field');
    });

    it('should create optional fields using option type', () => {
      const optionalStringField = option('string');
      const optionalIntField = option('int');
      const untypedOptionField = option();

      expect(optionalStringField.build().type).toBe('option<string>');
      expect(optionalIntField.build().type).toBe('option<int>');
      expect(untypedOptionField.build().type).toBe('option');
    });

    it('should apply validation helpers', () => {
      const emailField = string().assert('$value ~ /^[^@]+@[^@]+\\.[^@]+$/');
      const urlField = string().assert('$value ~ /^https?:\\/\\/.+/');
      const regexField = string().assert('$value ~ /^[a-z]+$/');
      const rangeField = int().assert('$value >= 1 AND $value <= 100');
      const lengthField = string().assert('string::len($value) >= 1 AND string::len($value) <= 50');

      expect(emailField.build().assert).toBe('$value ~ /^[^@]+@[^@]+\\.[^@]+$/');
      expect(urlField.build().assert).toBe('$value ~ /^https?:\\/\\/.+/');
      expect(regexField.build().assert).toBe('$value ~ /^[a-z]+$/');
      expect(rangeField.build().assert).toBe('$value >= 1 AND $value <= 100');
      expect(lengthField.build().assert).toBe(
        'string::len($value) >= 1 AND string::len($value) <= 50',
      );
    });
  });

  describe('Index Types', () => {
    it('should create basic indexes', () => {
      const indexObj = index(['email', 'createdAt']).unique().comment('Email index');

      const built = indexObj.build();
      expect(built.columns).toEqual(['email', 'createdAt']);
      expect(built.unique).toBe(true);
      expect(built.type).toBe('BTREE');
      expect(built.comments).toContain('Email index');
    });

    it('should create search indexes', () => {
      const searchIndex = index(['content']).search().analyzer('english').highlights();

      const built = searchIndex.build();
      expect(built.type).toBe('SEARCH');
      expect(built.analyzer).toBe('english');
      expect(built.highlights).toBe(true);
    });

    it('should create different index types', () => {
      const btreeIndex = index(['id']).btree();
      const hashIndex = index(['email']).hash();
      const mtreeIndex = index(['location']).mtree();

      expect(btreeIndex.build().type).toBe('BTREE');
      expect(hashIndex.build().type).toBe('HASH');
      expect(mtreeIndex.build().type).toBe('MTREE');
    });
  });

  describe('Event Types', () => {
    it('should create basic events', () => {
      const eventObj = event('update_timestamp')
        .onUpdate()
        .thenDo('SET updatedAt = time::now()')
        .comment('Update timestamp');

      const built = eventObj.build();
      expect(built.name).toBe('update_timestamp');
      expect(built.type).toBe('UPDATE');
      expect(built.thenStatement).toBe('SET updatedAt = time::now()');
      expect(built.comments).toContain('Update timestamp');
    });

    it('should create conditional events', () => {
      const eventObj2 = event('mark_edited')
        .onUpdate()
        .when('$value.content != $before.content')
        .thenDo('SET isEdited = true');

      const built = eventObj2.build();
      expect(built.type).toBe('UPDATE');
      expect(built.when).toBe('$value.content != $before.content');
      expect(built.thenStatement).toBe('SET isEdited = true');
    });
  });

  describe('Schema Definition', () => {
    it('should create a basic schema', () => {
      const schema = defineSchema({
        table: 'user',
        schemafull: true,
        comments: ['User table'],
        fields: {
          // SurrealDB will auto-generate IDs, no need for manual ID field
          name: string().required(),
          email: string().assert('$value ~ /^[^@]+@[^@]+\\.[^@]+$/').unique(),
          createdAt: datetime().value('time::now()'),
        },
        indexes: {
          email: index(['email']).unique(),
        },
        events: {
          updateTimestamp: event('update_timestamp')
            .onUpdate()
            .thenDo('SET updatedAt = time::now()'),
        },
      });

      expect(schema.name).toBe('user');
      expect(schema.schemafull).toBe(true);
      expect(schema.fields).toHaveLength(3);
      expect(schema.indexes).toHaveLength(1);
      expect(schema.events).toHaveLength(1);
      expect(schema.comments).toContain('User table');
    });

    it('should create a relation', () => {
      const relation = defineRelation({
        name: 'like',
        from: 'user',
        to: 'post',
        comments: ['User likes on posts'],
        fields: {
          // SurrealDB auto-generates IDs, just add custom fields
          createdAt: commonFields.timestamp(),
          rating: option('int'),
        },
        indexes: {
          unique: index(['in', 'out']).unique(),
        },
      });

      expect(relation.name).toBe('like');
      expect(relation.from).toBe('user');
      expect(relation.to).toBe('post');
      expect(relation.fields).toHaveLength(4); // in, out, createdAt, rating
      expect(relation.indexes).toHaveLength(1);
      expect(relation.comments).toContain('User likes on posts');
    });
  });

  describe('Common Patterns', () => {
    it('should provide common fields', () => {
      const timestampField = commonFields.timestamp();
      const emptyTimestampField = commonFields.emptyTimestamp();
      const metadataField = commonFields.metadata();

      expect(timestampField.build().type).toBe('datetime');
      expect(timestampField.build().value).toBe('time::now()');
      expect(emptyTimestampField.build().type).toBe('datetime');
      expect(metadataField.build().type).toBe('option<object>');
    });

    it('should provide common indexes', () => {
      const primaryIndex = commonIndexes.primary('user');
      const createdAtIndex = commonIndexes.createdAt('user');
      const contentSearchIndex = commonIndexes.contentSearch('post');

      expect(primaryIndex.build().columns).toEqual(['id']);
      expect(primaryIndex.build().unique).toBe(true);
      expect(createdAtIndex.build().columns).toEqual(['createdAt']);
      expect(contentSearchIndex.build().type).toBe('SEARCH');
      expect(contentSearchIndex.build().analyzer).toBe('english');
    });

    it('should provide common events', () => {
      const updateTimestampEvent = commonEvents.updateTimestamp('user');

      expect(updateTimestampEvent.build().type).toBe('UPDATE');
      expect(updateTimestampEvent.build().thenStatement).toBe('SET updatedAt = time::now()');
    });
  });

  describe('Schema Composition', () => {
    it('should compose a complete schema', () => {
      const userModel = defineSchema({
        table: 'user',
        fields: {
          email: string().assert('$value ~ /^[^@]+@[^@]+\\.[^@]+$/').unique(),
          name: string().required(),
        },
      });

      const postModel = defineSchema({
        table: 'post',
        fields: {
          content: string(),
          author: record('user'),
          createdAt: commonFields.timestamp(),
        },
      });

      const likeRelation = defineRelation({
        name: 'like',
        from: 'user',
        to: 'post',
        fields: {
          createdAt: commonFields.timestamp(),
        },
      });

      const fullSchema = composeSchema({
        models: {
          userModel,
          postModel,
        },
        relations: {
          likeRelation,
        },
        comments: ['Test schema'],
      });

      expect(fullSchema.tables).toHaveLength(2);
      expect(fullSchema.relations).toHaveLength(1);
      expect(fullSchema.comments).toContain('Test schema');
    });
  });

  // Note: Generator tests removed - ConciseSchemaGenerator has been replaced with MigrationManager.generateDiff()
});
