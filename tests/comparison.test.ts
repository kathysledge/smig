/**
 * @fileoverview Tests for schema comparison utilities.
 */

import { describe, expect, it } from 'vitest';
import {
  compareAnalyzers,
  compareFields,
  compareFunctions,
  compareIndexes,
  compareScopes,
  detectEntityRename,
  detectFieldRename,
  detectIndexRename,
  normalizeDefault,
  normalizeExpression,
  normalizePermissions,
  normalizeType,
  serializeDefaultValue,
} from '../src/migrator/comparison';

describe('Schema Comparison', () => {
  describe('Normalization', () => {
    describe('normalizePermissions', () => {
      it('should treat null/undefined as FULL', () => {
        expect(normalizePermissions(null)).toBe('FULL');
        expect(normalizePermissions(undefined)).toBe('FULL');
        expect(normalizePermissions('')).toBe('FULL');
      });

      it('should normalize NONE to FULL', () => {
        expect(normalizePermissions('NONE')).toBe('FULL');
      });

      it('should remove deprecated DELETE permission', () => {
        const result = normalizePermissions('FOR select, DELETE, UPDATE');
        expect(result).not.toContain('DELETE');
      });

      it('should normalize whitespace', () => {
        const result = normalizePermissions('FOR   select,   update');
        expect(result).toBe('FOR SELECT, UPDATE');
      });
    });

    describe('normalizeDefault', () => {
      it('should handle null/undefined', () => {
        expect(normalizeDefault(null)).toBe('');
        expect(normalizeDefault(undefined)).toBe('');
      });

      it('should remove outer quotes', () => {
        expect(normalizeDefault("'active'")).toBe('active');
        expect(normalizeDefault('"active"')).toBe('active');
      });

      it('should serialize arrays', () => {
        expect(normalizeDefault(['a', 'b'])).toBe('["a","b"]');
      });

      it('should serialize objects', () => {
        expect(normalizeDefault({ key: 'value' })).toBe('{"key":"value"}');
      });

      it('should remove backticks around function namespaces (SurrealDB v3 beta2+)', () => {
        // SurrealDB v3 beta2 returns function calls with backticks around namespace
        expect(normalizeDefault('`rand`::uuid::v7()')).toBe('rand::uuid::v7()');
        expect(normalizeDefault("`sequence`::nextval('order_number')")).toBe(
          "sequence::nextval('order_number')",
        );
        expect(normalizeDefault('`time`::now()')).toBe('time::now()');
        expect(normalizeDefault('`math`::floor(123)')).toBe('math::floor(123)');
      });

      it('should normalize both backticks and quotes together', () => {
        // Schema uses: sequence::nextval("order_number")
        // DB returns: `sequence`::nextval('order_number')
        expect(normalizeDefault('`sequence`::nextval("order_number")')).toBe(
          "sequence::nextval('order_number')",
        );
        expect(normalizeDefault('sequence::nextval("order_number")')).toBe(
          "sequence::nextval('order_number')",
        );
      });
    });

    describe('normalizeExpression', () => {
      it('should normalize whitespace', () => {
        expect(normalizeExpression('$value   !=   NONE')).toBe('$value != NONE');
      });

      it('should normalize duration (weeks to days)', () => {
        expect(normalizeExpression('1w')).toBe('7d');
        expect(normalizeExpression('2w')).toBe('14d');
      });

      it('should normalize array quotes', () => {
        expect(normalizeExpression('["a", "b"]')).toBe("['a', 'b']");
      });
    });

    describe('normalizeType', () => {
      it('should lowercase types', () => {
        expect(normalizeType('STRING')).toBe('string');
        expect(normalizeType('Int')).toBe('int');
      });

      it('should normalize optional syntax', () => {
        expect(normalizeType('string?')).toBe('option<string>');
      });

      it('should handle null/undefined', () => {
        expect(normalizeType(null)).toBe('any');
        expect(normalizeType(undefined)).toBe('any');
      });
    });

    describe('serializeDefaultValue', () => {
      it('should return NONE for null/undefined', () => {
        expect(serializeDefaultValue(null)).toBe('NONE');
        expect(serializeDefaultValue(undefined)).toBe('NONE');
      });

      it('should not quote function calls', () => {
        expect(serializeDefaultValue('rand::uuid::v7()')).toBe('rand::uuid::v7()');
        expect(serializeDefaultValue('time::now()')).toBe('time::now()');
      });

      it('should quote literal strings', () => {
        expect(serializeDefaultValue('active')).toBe("'active'");
      });

      it('should not quote booleans', () => {
        expect(serializeDefaultValue('true')).toBe('true');
        expect(serializeDefaultValue('false')).toBe('false');
      });

      it('should serialize numbers', () => {
        expect(serializeDefaultValue(42)).toBe('42');
        expect(serializeDefaultValue(3.14)).toBe('3.14');
      });
    });
  });

  describe('Field Comparison', () => {
    it('should detect no changes for identical fields', () => {
      const field = { name: 'email', type: 'string', readonly: false };
      const result = compareFields('user', field, { ...field });
      expect(result.hasChanges).toBe(false);
    });

    it('should detect type changes', () => {
      const result = compareFields(
        'user',
        { name: 'age', type: 'int' },
        { name: 'age', type: 'string' },
      );
      expect(result.hasChanges).toBe(true);
      expect(result.changeDetails.type).toEqual({ old: 'string', new: 'int' });
    });

    it('should detect readonly changes', () => {
      const result = compareFields(
        'user',
        { name: 'id', type: 'uuid', readonly: true },
        { name: 'id', type: 'uuid', readonly: false },
      );
      expect(result.hasChanges).toBe(true);
      expect(result.changeDetails.readonly).toEqual({ old: false, new: true });
    });

    it('should detect default value changes', () => {
      const result = compareFields(
        'user',
        { name: 'status', type: 'string', default: 'active' },
        { name: 'status', type: 'string', default: 'pending' },
      );
      expect(result.hasChanges).toBe(true);
      expect(result.changeDetails.default).toEqual({ old: 'pending', new: 'active' });
    });

    it('should detect permission changes', () => {
      const result = compareFields(
        'user',
        { name: 'email', type: 'string', permissions: 'FOR select, update' },
        { name: 'email', type: 'string', permissions: 'FOR select' },
      );
      expect(result.hasChanges).toBe(true);
    });
  });

  describe('Field Rename Detection', () => {
    it('should detect renamed field', () => {
      const newField = { name: 'fullName', type: 'string', previousName: 'name' };
      const currentFields = [
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string' },
      ];
      expect(detectFieldRename(newField, currentFields)).toBe('name');
    });

    it('should handle multiple previous names', () => {
      const newField = {
        name: 'fullName',
        type: 'string',
        previousName: ['userName', 'name'],
      };
      const currentFields = [{ name: 'name', type: 'string' }];
      expect(detectFieldRename(newField, currentFields)).toBe('name');
    });

    it('should return null for new fields', () => {
      const newField = { name: 'newField', type: 'string' };
      const currentFields = [{ name: 'existingField', type: 'string' }];
      expect(detectFieldRename(newField, currentFields)).toBeNull();
    });
  });

  describe('Index Comparison', () => {
    it('should detect no changes for identical indexes', () => {
      const index = { name: 'idx_email', columns: ['email'], unique: false, type: 'BTREE' };
      const result = compareIndexes(index, { ...index });
      expect(result.hasChanges).toBe(false);
    });

    it('should detect column changes', () => {
      const result = compareIndexes(
        { name: 'idx', columns: ['a', 'b'], type: 'BTREE' },
        { name: 'idx', columns: ['a'], type: 'BTREE' },
      );
      expect(result.hasChanges).toBe(true);
      expect(result.changeType).toBe('recreate');
    });

    it('should detect uniqueness changes', () => {
      const result = compareIndexes(
        { name: 'idx', columns: ['email'], unique: true, type: 'BTREE' },
        { name: 'idx', columns: ['email'], unique: false, type: 'BTREE' },
      );
      expect(result.hasChanges).toBe(true);
      expect(result.changes.unique).toEqual({ old: false, new: true });
    });

    it('should detect type changes', () => {
      const result = compareIndexes(
        { name: 'idx', columns: ['text'], type: 'SEARCH' },
        { name: 'idx', columns: ['text'], type: 'BTREE' },
      );
      expect(result.hasChanges).toBe(true);
      expect(result.changes.type).toEqual({ old: 'BTREE', new: 'SEARCH' });
    });

    it('should detect vector index dimension changes', () => {
      const result = compareIndexes(
        { name: 'idx', columns: ['embedding'], type: 'HNSW', dimension: 768 },
        { name: 'idx', columns: ['embedding'], type: 'HNSW', dimension: 384 },
      );
      expect(result.hasChanges).toBe(true);
      expect(result.changes.dimension).toEqual({ old: 384, new: 768 });
    });
  });

  describe('Index Rename Detection', () => {
    it('should detect renamed index', () => {
      const newIndex = { name: 'idx_user_email', columns: ['email'], previousName: 'idx_email' };
      const currentIndexes = [{ name: 'idx_email', columns: ['email'] }];
      expect(detectIndexRename(newIndex, currentIndexes)).toBe('idx_email');
    });
  });

  describe('Entity Comparison', () => {
    describe('Functions', () => {
      it('should detect no changes for identical functions', () => {
        const func = {
          name: 'fn::test',
          body: 'RETURN 1;',
          parameters: [{ name: 'x', type: 'int' }],
          returnType: 'int',
        };
        expect(compareFunctions(func, { ...func })).toBe(false);
      });

      it('should detect body changes', () => {
        const current = { name: 'fn::test', body: 'RETURN 1;', parameters: [] };
        const updated = { name: 'fn::test', body: 'RETURN 2;', parameters: [] };
        expect(compareFunctions(current, updated)).toBe(true);
      });

      it('should detect parameter changes', () => {
        const current = {
          name: 'fn::test',
          body: 'RETURN $x;',
          parameters: [{ name: 'x', type: 'int' }],
        };
        const updated = {
          name: 'fn::test',
          body: 'RETURN $x;',
          parameters: [{ name: 'x', type: 'string' }],
        };
        expect(compareFunctions(current, updated)).toBe(true);
      });
    });

    describe('Scopes', () => {
      it('should detect no changes for identical scopes', () => {
        const scope = {
          name: 'user',
          session: '7d',
          signup: 'CREATE user',
          signin: 'SELECT * FROM user',
        };
        expect(compareScopes(scope, { ...scope })).toBe(false);
      });

      it('should detect session changes', () => {
        const current = { name: 'user', session: '7d', signup: null, signin: null };
        const updated = { name: 'user', session: '30d', signup: null, signin: null };
        expect(compareScopes(current, updated)).toBe(true);
      });
    });

    describe('Analyzers', () => {
      it('should detect no changes for identical analyzers', () => {
        const analyzer = {
          name: 'english',
          tokenizers: ['blank', 'class'],
          filters: ['lowercase', 'snowball(english)'],
        };
        expect(compareAnalyzers(analyzer, { ...analyzer })).toBe(false);
      });

      it('should detect tokenizer changes', () => {
        const current = { name: 'test', tokenizers: ['blank'], filters: [] };
        const updated = { name: 'test', tokenizers: ['blank', 'class'], filters: [] };
        expect(compareAnalyzers(current, updated)).toBe(true);
      });
    });

    describe('Entity Rename Detection', () => {
      it('should detect renamed entity', () => {
        const newEntity = { name: 'user_v2', was: 'user' };
        const currentEntities = [{ name: 'user' }, { name: 'post' }];
        expect(detectEntityRename(newEntity, currentEntities)).toBe('user');
      });

      it('should handle array of previous names', () => {
        const newEntity = { name: 'customer', was: ['client', 'user'] };
        const currentEntities = [{ name: 'user' }];
        expect(detectEntityRename(newEntity, currentEntities)).toBe('user');
      });
    });
  });
});
