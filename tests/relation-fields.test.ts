import { describe, expect, it } from 'vitest';
import { bool, defineRelation, index, string } from '../src/schema/concise-schema';

describe('defineRelation', () => {
  it('should automatically add mandatory in and out fields', () => {
    const relation = defineRelation({
      name: 'test_relation',
      from: 'user',
      to: 'post',
      fields: {
        id: string().required(),
        createdAt: string(),
      },
      indexes: {
        unique: index(['in', 'out']).unique(),
      },
    });

    // Check that the relation has the mandatory fields
    const fieldNames = relation.fields.map((f) => f.name);
    expect(fieldNames).toContain('in');
    expect(fieldNames).toContain('out');

    // Check that user-defined fields are still present
    expect(fieldNames).toContain('id');
    expect(fieldNames).toContain('createdAt');

    // Check that 'in' field points to the 'from' table
    const inField = relation.fields.find((f) => f.name === 'in');
    expect(inField).toBeDefined();
    expect(inField?.type).toBe('record<user>');

    // Check that 'out' field points to the 'to' table
    const outField = relation.fields.find((f) => f.name === 'out');
    expect(outField).toBeDefined();
    expect(outField?.type).toBe('record<post>');

    // Check that both fields are required
    expect(inField?.optional).toBe(false);
    expect(outField?.optional).toBe(false);
  });

  it('should preserve user-defined field properties', () => {
    const relation = defineRelation({
      name: 'test_relation',
      from: 'user',
      to: 'post',
      fields: {
        id: string().required(),
        isActive: bool().default(true),
      },
    });

    const idField = relation.fields.find((f) => f.name === 'id');
    const isActiveField = relation.fields.find((f) => f.name === 'isActive');

    expect(idField?.type).toBe('string');
    expect(idField?.optional).toBe(false);
    expect(isActiveField?.type).toBe('bool');
    expect(isActiveField?.default).toBe(true);
  });

  it('should handle relations with no custom fields', () => {
    const relation = defineRelation({
      name: 'simple_relation',
      from: 'category',
      to: 'product',
    });

    const fieldNames = relation.fields.map((f) => f.name);
    expect(fieldNames).toEqual(['in', 'out']);

    const inField = relation.fields.find((f) => f.name === 'in');
    const outField = relation.fields.find((f) => f.name === 'out');

    expect(inField?.type).toBe('record<category>');
    expect(outField?.type).toBe('record<product>');
  });

  it('should maintain correct field order (in, out, then custom fields)', () => {
    const relation = defineRelation({
      name: 'ordered_relation',
      from: 'user',
      to: 'group',
      fields: {
        role: string().default('member'),
        joinedAt: string(),
      },
    });

    const fieldNames = relation.fields.map((f) => f.name);
    expect(fieldNames).toEqual(['in', 'out', 'role', 'joinedAt']);
  });
});
