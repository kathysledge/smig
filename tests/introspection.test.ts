/**
 * @fileoverview Tests for schema introspection parsers.
 */

import { describe, expect, it } from 'vitest';
import {
  extractRelationInfo,
  isRelationTable,
  parseAnalyzerDefinition,
  parseEventDefinition,
  parseFieldDefinition,
  parseFunctionDefinition,
  parseIndexDefinition,
  parseScopeDefinition,
  parseTableInfo,
} from '../src/migrator/introspection';

describe('Schema Introspection', () => {
  describe('Field Parser', () => {
    it('should parse a basic string field', () => {
      const field = parseFieldDefinition('name', 'DEFINE FIELD name ON TABLE user TYPE string');
      expect(field.name).toBe('name');
      expect(field.type).toBe('string');
      expect(field.optional).toBe(false);
      expect(field.readonly).toBe(false);
    });

    it('should parse an optional field', () => {
      const field = parseFieldDefinition('age', 'DEFINE FIELD age ON TABLE user TYPE option<int>');
      expect(field.type).toBe('option<int>');
      expect(field.optional).toBe(true);
    });

    it('should parse a readonly field', () => {
      const field = parseFieldDefinition(
        'createdAt',
        'DEFINE FIELD createdAt ON TABLE user TYPE datetime READONLY',
      );
      expect(field.readonly).toBe(true);
    });

    it('should parse a flexible field', () => {
      const field = parseFieldDefinition(
        'data',
        'DEFINE FIELD data ON TABLE user FLEXIBLE TYPE object',
      );
      expect(field.flexible).toBe(true);
    });

    it('should parse field with DEFAULT', () => {
      const field = parseFieldDefinition(
        'active',
        'DEFINE FIELD active ON TABLE user TYPE bool DEFAULT true',
      );
      expect(field.default).toBe('true');
    });

    it('should parse field with VALUE expression', () => {
      const field = parseFieldDefinition(
        'createdAt',
        'DEFINE FIELD createdAt ON TABLE user TYPE datetime VALUE time::now()',
      );
      expect(field.value).toBe('time::now()');
    });

    it('should parse field with computed VALUE (braces)', () => {
      const field = parseFieldDefinition(
        'score',
        'DEFINE FIELD score ON TABLE user TYPE int VALUE { array::len(posts) }',
      );
      expect(field.value).toBe('{ array::len(posts) }');
    });

    it('should parse field with ASSERT', () => {
      const field = parseFieldDefinition(
        'email',
        'DEFINE FIELD email ON TABLE user TYPE string ASSERT $value != NONE',
      );
      expect(field.assert).toBe('$value != NONE');
    });

    it('should parse field with REFERENCES (SurrealDB 3.x)', () => {
      const field = parseFieldDefinition(
        'authorId',
        'DEFINE FIELD authorId ON TABLE post TYPE record<user> REFERENCES user ON DELETE CASCADE',
      );
      expect(field.reference).toBe('user');
      expect(field.onDelete).toBe('CASCADE');
    });
  });

  describe('Index Parser', () => {
    it('should parse a basic BTREE index', () => {
      const idx = parseIndexDefinition(
        'idx_email',
        'DEFINE INDEX idx_email ON TABLE user FIELDS email',
      );
      expect(idx.name).toBe('idx_email');
      expect(idx.columns).toEqual(['email']);
      expect(idx.type).toBe('BTREE');
      expect(idx.unique).toBe(false);
    });

    it('should parse a unique index', () => {
      const idx = parseIndexDefinition(
        'idx_email_unique',
        'DEFINE INDEX idx_email_unique ON TABLE user FIELDS email UNIQUE',
      );
      expect(idx.unique).toBe(true);
    });

    it('should parse a composite index', () => {
      const idx = parseIndexDefinition(
        'idx_user_date',
        'DEFINE INDEX idx_user_date ON TABLE post FIELDS userId, createdAt',
      );
      expect(idx.columns).toEqual(['userId', 'createdAt']);
    });

    it('should parse a SEARCH index', () => {
      const idx = parseIndexDefinition(
        'idx_search',
        'DEFINE INDEX idx_search ON TABLE post FIELDS content SEARCH ANALYZER english HIGHLIGHTS',
      );
      expect(idx.type).toBe('SEARCH');
      expect(idx.analyzer).toBe('english');
      expect(idx.highlights).toBe(true);
    });

    it('should parse an HNSW vector index', () => {
      const idx = parseIndexDefinition(
        'idx_embedding',
        'DEFINE INDEX idx_embedding ON TABLE post FIELDS embedding HNSW DIMENSION 384 DIST COSINE EFC 200 M 16',
      );
      expect(idx.type).toBe('HNSW');
      expect(idx.dimension).toBe(384);
      expect(idx.dist).toBe('COSINE');
      expect(idx.efc).toBe(200);
      expect(idx.m).toBe(16);
    });

    it('should parse an MTREE vector index', () => {
      const idx = parseIndexDefinition(
        'idx_geo',
        'DEFINE INDEX idx_geo ON TABLE location FIELDS coords MTREE DIMENSION 3 DIST EUCLIDEAN CAPACITY 40',
      );
      expect(idx.type).toBe('MTREE');
      expect(idx.dimension).toBe(3);
      expect(idx.dist).toBe('EUCLIDEAN');
      expect(idx.capacity).toBe(40);
    });
  });

  describe('Event Parser', () => {
    it('should parse an UPDATE event', () => {
      const evt = parseEventDefinition(
        'on_update',
        'DEFINE EVENT on_update ON TABLE user WHEN $event = "UPDATE" THEN (UPDATE $after SET updatedAt = time::now())',
      );
      expect(evt.name).toBe('on_update');
      expect(evt.type).toBe('UPDATE');
      expect(evt.when).toContain('$event = "UPDATE"');
    });

    it('should parse a CREATE event', () => {
      const evt = parseEventDefinition(
        'on_create',
        'DEFINE EVENT on_create ON TABLE user WHEN $event = "CREATE" THEN (CREATE log SET action = "created")',
      );
      expect(evt.type).toBe('CREATE');
    });

    it('should parse a DELETE event', () => {
      const evt = parseEventDefinition(
        'on_delete',
        'DEFINE EVENT on_delete ON TABLE user WHEN $event = "DELETE" THEN (DELETE related WHERE userId = $before.id)',
      );
      expect(evt.type).toBe('DELETE');
    });
  });

  describe('Function Parser', () => {
    it('should parse a basic function', () => {
      const fn = parseFunctionDefinition(
        'fn::days_since',
        'DEFINE FUNCTION fn::days_since($time: datetime) -> float { RETURN (time::now() - $time) / 86400; }',
      );
      expect(fn.name).toBe('fn::days_since');
      expect(fn.parameters).toEqual([{ name: 'time', type: 'datetime' }]);
      expect(fn.returnType).toBe('float');
      expect(fn.body).toContain('RETURN');
    });

    it('should parse a function with multiple parameters', () => {
      const fn = parseFunctionDefinition(
        'fn::calc',
        'DEFINE FUNCTION fn::calc($a: int, $b: int) -> int { RETURN $a + $b; }',
      );
      expect(fn.parameters).toEqual([
        { name: 'a', type: 'int' },
        { name: 'b', type: 'int' },
      ]);
    });

    it('should parse a function with no parameters', () => {
      const fn = parseFunctionDefinition(
        'fn::now_str',
        'DEFINE FUNCTION fn::now_str() -> string { RETURN time::format(time::now(), "%Y-%m-%d"); }',
      );
      expect(fn.parameters).toEqual([]);
    });
  });

  describe('Scope/Access Parser', () => {
    it('should parse a basic scope', () => {
      const scope = parseScopeDefinition(
        'user',
        'DEFINE SCOPE user SESSION 7d SIGNUP (CREATE user SET email = $email) SIGNIN (SELECT * FROM user WHERE email = $email)',
      );
      expect(scope.name).toBe('user');
      expect(scope.session).toBe('7d');
      expect(scope.signup).toContain('CREATE user');
      expect(scope.signin).toContain('SELECT');
    });

    it('should parse a scope with signin only', () => {
      const scope = parseScopeDefinition(
        'api',
        'DEFINE SCOPE api SESSION 30d SIGNIN (SELECT * FROM api_key WHERE key = $key)',
      );
      expect(scope.session).toBe('30d');
      expect(scope.signup).toBeNull();
      expect(scope.signin).toContain('api_key');
    });
  });

  describe('Analyzer Parser', () => {
    it('should parse a basic analyzer', () => {
      const analyzer = parseAnalyzerDefinition(
        'english_search',
        'DEFINE ANALYZER english_search TOKENIZERS blank,class FILTERS lowercase,snowball(english)',
      );
      expect(analyzer.name).toBe('english_search');
      expect(analyzer.tokenizers).toEqual(['blank', 'class']);
      expect(analyzer.filters).toContain('lowercase');
      expect(analyzer.filters).toContain('snowball(english)');
    });

    it('should parse an analyzer with function', () => {
      const analyzer = parseAnalyzerDefinition(
        'custom',
        'DEFINE ANALYZER custom FUNCTION fn::my_tokenizer',
      );
      expect(analyzer.function).toBe('my_tokenizer');
    });
  });

  describe('Relation Detection', () => {
    it('should detect a relation table with in/out fields', () => {
      const tableInfo = {
        name: 'follows',
        type: 'NORMAL',
        fields: [
          { name: 'in', type: 'record<user>' },
          { name: 'out', type: 'record<user>' },
          { name: 'createdAt', type: 'datetime' },
        ],
      };
      expect(isRelationTable('follows', tableInfo)).toBe(true);
    });

    it('should detect a relation table with TYPE RELATION', () => {
      const tableInfo = {
        name: 'authored',
        type: 'RELATION',
        fields: [],
      };
      expect(isRelationTable('authored', tableInfo)).toBe(true);
    });

    it('should not detect a normal table as relation', () => {
      const tableInfo = {
        name: 'user',
        type: 'NORMAL',
        fields: [
          { name: 'name', type: 'string' },
          { name: 'email', type: 'string' },
        ],
      };
      expect(isRelationTable('user', tableInfo)).toBe(false);
    });

    it('should extract relation info from in/out fields', () => {
      const tableInfo = {
        name: 'follows',
        fields: [
          { name: 'in', type: 'record<user>' },
          { name: 'out', type: 'record<post>' },
        ],
      };
      const info = extractRelationInfo(tableInfo);
      expect(info.from).toBe('user');
      expect(info.to).toBe('post');
    });
  });

  describe('Table Parser Integration', () => {
    it('should parse complete table info from INFO FOR TABLE result', () => {
      const infoResult = {
        tb: 'DEFINE TABLE user TYPE NORMAL SCHEMAFULL',
        fields: {
          name: 'DEFINE FIELD name ON TABLE user TYPE string',
          email: 'DEFINE FIELD email ON TABLE user TYPE string',
          age: 'DEFINE FIELD age ON TABLE user TYPE option<int>',
        },
        indexes: {
          idx_email: 'DEFINE INDEX idx_email ON TABLE user FIELDS email UNIQUE',
        },
        events: {
          on_create:
            'DEFINE EVENT on_create ON TABLE user WHEN $event = "CREATE" THEN { CREATE log SET action = "user_created" }',
        },
      };

      const tableInfo = parseTableInfo('user', infoResult);

      expect(tableInfo.name).toBe('user');
      expect(tableInfo.schemafull).toBe(true);
      expect(tableInfo.type).toBe('NORMAL');
      expect(tableInfo.isRelation).toBe(false);
      expect(tableInfo.fields).toHaveLength(3);
      expect(tableInfo.indexes).toHaveLength(1);
      expect(tableInfo.events).toHaveLength(1);
    });

    it('should detect relation tables and extract relation info', () => {
      const infoResult = {
        tb: 'DEFINE TABLE follows TYPE RELATION SCHEMAFULL',
        fields: {
          in: 'DEFINE FIELD in ON TABLE follows TYPE record<user>',
          out: 'DEFINE FIELD out ON TABLE follows TYPE record<user>',
          followedAt: 'DEFINE FIELD followedAt ON TABLE follows TYPE datetime',
        },
        indexes: {},
        events: {},
      };

      const tableInfo = parseTableInfo('follows', infoResult);

      expect(tableInfo.name).toBe('follows');
      expect(tableInfo.type).toBe('RELATION');
      expect(tableInfo.isRelation).toBe(true);
      expect(tableInfo.relationInfo).toEqual({ from: 'user', to: 'user' });
      expect(tableInfo.fields).toHaveLength(3);
    });

    it('should parse table with changefeed', () => {
      const infoResult = {
        tb: 'DEFINE TABLE audit TYPE NORMAL SCHEMAFULL CHANGEFEED 7d INCLUDE ORIGINAL',
        fields: {
          action: 'DEFINE FIELD action ON TABLE audit TYPE string',
        },
        indexes: {},
        events: {},
      };

      const tableInfo = parseTableInfo('audit', infoResult);

      expect(tableInfo.changefeedDuration).toBe('7d');
      expect(tableInfo.changefeedIncludeOriginal).toBe(true);
    });

    it('should parse DROP table', () => {
      const infoResult = {
        tb: 'DEFINE TABLE temp TYPE NORMAL SCHEMAFULL DROP',
        fields: {},
        indexes: {},
        events: {},
      };

      const tableInfo = parseTableInfo('temp', infoResult);

      expect(tableInfo.drop).toBe(true);
    });

    it('should skip array wildcard fields', () => {
      const infoResult = {
        tb: 'DEFINE TABLE user TYPE NORMAL SCHEMAFULL',
        fields: {
          tags: 'DEFINE FIELD tags ON TABLE user TYPE array<string>',
          'tags[*]': 'DEFINE FIELD tags[*] ON TABLE user TYPE string',
        },
        indexes: {},
        events: {},
      };

      const tableInfo = parseTableInfo('user', infoResult);

      expect(tableInfo.fields).toHaveLength(1);
      expect((tableInfo.fields as Array<{ name: string }>)[0].name).toBe('tags');
    });
  });
});

describe('Checksum Utilities', () => {
  it('should calculate and verify checksums', async () => {
    const { calculateChecksum, verifyChecksum, parseChecksum } = await import(
      '../src/migrator/utils'
    );

    const content = 'DEFINE TABLE user SCHEMAFULL;';
    const checksum = calculateChecksum(content);

    expect(checksum).toMatch(/^sha256:/);
    expect(verifyChecksum(content, checksum)).toBe(true);
    expect(verifyChecksum('different content', checksum)).toBe(false);

    const parsed = parseChecksum(checksum);
    expect(parsed.algorithm).toBe('sha256');
    expect(parsed.hash).toHaveLength(64); // SHA256 hex
  });
});
