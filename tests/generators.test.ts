/**
 * @fileoverview Tests for SQL generators.
 */

import { describe, expect, it } from 'vitest';
import {
  generateTableDefinition,
  generateTableRename,
  generateTableRemove,
  generateFieldDefinition,
  generateFieldRename,
  generateFieldRemove,
  generateIndexDefinition,
  generateIndexRename,
  generateIndexRemove,
  generateEventDefinition,
  generateFunctionDefinition,
  generateAnalyzerDefinition,
  generateAccessDefinition,
  generateParamDefinition,
  generateUserDefinition,
  generateSequenceDefinition,
  generateConfigDefinition,
} from '../src/generators';

describe('SQL Generators', () => {
  describe('Table Generator', () => {
    it('should generate basic DEFINE TABLE', () => {
      const sql = generateTableDefinition({
        name: 'user',
        schemafull: true,
        fields: [],
        indexes: [],
        events: [],
        comments: [],
      });
      expect(sql).toBe('DEFINE TABLE user SCHEMAFULL;');
    });

    it('should generate SCHEMALESS table', () => {
      const sql = generateTableDefinition({
        name: 'logs',
        schemafull: false,
        fields: [],
        indexes: [],
        events: [],
        comments: [],
      });
      expect(sql).toBe('DEFINE TABLE logs SCHEMALESS;');
    });

    it('should generate RELATION table with IN/OUT', () => {
      const sql = generateTableDefinition({
        name: 'follows',
        schemafull: true,
        type: 'RELATION',
        from: 'user',
        to: 'user',
        fields: [],
        indexes: [],
        events: [],
        comments: [],
      });
      expect(sql).toContain('TYPE RELATION');
      expect(sql).toContain('IN user');
      expect(sql).toContain('OUT user');
    });

    it('should generate table with CHANGEFEED', () => {
      const sql = generateTableDefinition({
        name: 'orders',
        schemafull: true,
        changefeedDuration: '7d',
        changefeedIncludeOriginal: true,
        fields: [],
        indexes: [],
        events: [],
        comments: [],
      });
      expect(sql).toContain('CHANGEFEED 7d');
      expect(sql).toContain('INCLUDE ORIGINAL');
    });

    it('should generate table with DROP', () => {
      const sql = generateTableDefinition({
        name: 'temp',
        schemafull: true,
        drop: true,
        fields: [],
        indexes: [],
        events: [],
        comments: [],
      });
      expect(sql).toContain('DROP');
    });

    it('should generate ALTER TABLE RENAME', () => {
      const sql = generateTableRename('old_table', 'new_table');
      expect(sql).toBe('ALTER TABLE old_table RENAME TO new_table;');
    });

    it('should generate REMOVE TABLE', () => {
      const sql = generateTableRemove('user');
      expect(sql).toBe('REMOVE TABLE user;');
    });
  });

  describe('Field Generator', () => {
    it('should generate basic DEFINE FIELD', () => {
      const sql = generateFieldDefinition('user', {
        name: 'email',
        type: 'string',
      });
      expect(sql).toBe('DEFINE FIELD email ON TABLE user TYPE string;');
    });

    it('should generate field with DEFAULT', () => {
      const sql = generateFieldDefinition('user', {
        name: 'active',
        type: 'bool',
        default: true,
      });
      expect(sql).toContain('DEFAULT true');
    });

    it('should generate field with DEFAULT ALWAYS', () => {
      const sql = generateFieldDefinition('user', {
        name: 'updatedAt',
        type: 'datetime',
        default: 'time::now()',
        defaultAlways: true,
      });
      expect(sql).toContain('DEFAULT ALWAYS time::now()');
    });

    it('should generate field with READONLY', () => {
      const sql = generateFieldDefinition('user', {
        name: 'createdAt',
        type: 'datetime',
        readonly: true,
      });
      expect(sql).toContain('READONLY');
    });

    it('should generate field with ASSERT', () => {
      const sql = generateFieldDefinition('user', {
        name: 'age',
        type: 'int',
        assert: '$value >= 0 AND $value <= 150',
      });
      expect(sql).toContain('ASSERT $value >= 0 AND $value <= 150');
    });

    it('should generate FLEXIBLE TYPE field', () => {
      const sql = generateFieldDefinition('user', {
        name: 'metadata',
        type: 'object',
        flexible: true,
      });
      expect(sql).toContain('FLEXIBLE TYPE object');
    });

    it('should generate field with REFERENCES', () => {
      const sql = generateFieldDefinition('post', {
        name: 'authorId',
        type: 'record<user>',
        reference: 'user',
        onDelete: 'CASCADE',
      });
      expect(sql).toContain('REFERENCES user');
      expect(sql).toContain('ON DELETE CASCADE');
    });

    it('should generate ALTER FIELD RENAME', () => {
      const sql = generateFieldRename('user', 'old_name', 'new_name');
      expect(sql).toBe('ALTER FIELD old_name ON TABLE user RENAME TO new_name;');
    });

    it('should generate REMOVE FIELD', () => {
      const sql = generateFieldRemove('user', 'oldField');
      expect(sql).toBe('REMOVE FIELD oldField ON TABLE user;');
    });
  });

  describe('Index Generator', () => {
    it('should generate basic BTREE index', () => {
      const sql = generateIndexDefinition('user', 'idx_email', {
        columns: ['email'],
        type: 'BTREE',
      });
      expect(sql).toBe('DEFINE INDEX idx_email ON TABLE user FIELDS email;');
    });

    it('should generate UNIQUE index', () => {
      const sql = generateIndexDefinition('user', 'idx_email_unique', {
        columns: ['email'],
        type: 'BTREE',
        unique: true,
      });
      expect(sql).toContain('UNIQUE');
    });

    it('should generate SEARCH index with analyzer', () => {
      const sql = generateIndexDefinition('post', 'idx_content_search', {
        columns: ['title', 'content'],
        type: 'SEARCH',
        analyzer: 'english',
        highlights: true,
      });
      expect(sql).toContain('FULLTEXT');
      expect(sql).toContain('ANALYZER english');
      expect(sql).toContain('HIGHLIGHTS');
    });

    it('should generate SEARCH index with BM25', () => {
      const sql = generateIndexDefinition('post', 'idx_search', {
        columns: ['content'],
        type: 'SEARCH',
        bm25: { k1: 1.2, b: 0.75 },
      });
      expect(sql).toContain('BM25(1.2,0.75)');
    });

    it('should generate MTREE vector index', () => {
      const sql = generateIndexDefinition('post', 'idx_embedding', {
        columns: ['embedding'],
        type: 'MTREE',
        dimension: 384,
        dist: 'COSINE',
        capacity: 40,
      });
      expect(sql).toContain('MTREE');
      expect(sql).toContain('DIMENSION 384');
      expect(sql).toContain('DIST COSINE');
      expect(sql).toContain('CAPACITY 40');
    });

    it('should generate HNSW vector index', () => {
      const sql = generateIndexDefinition('post', 'idx_embedding', {
        columns: ['embedding'],
        type: 'HNSW',
        dimension: 1536,
        dist: 'EUCLIDEAN',
        efc: 200,
        m: 16,
      });
      expect(sql).toContain('HNSW');
      expect(sql).toContain('DIMENSION 1536');
      expect(sql).toContain('DIST EUCLIDEAN');
      expect(sql).toContain('EFC 200');
      expect(sql).toContain('M 16');
    });

    it('should generate CONCURRENTLY index', () => {
      const sql = generateIndexDefinition('user', 'idx_large', {
        columns: ['name'],
        type: 'BTREE',
        concurrently: true,
      });
      expect(sql).toContain('CONCURRENTLY');
    });

    it('should generate ALTER INDEX RENAME', () => {
      const sql = generateIndexRename('user', 'old_idx', 'new_idx');
      expect(sql).toBe('ALTER INDEX old_idx ON TABLE user RENAME TO new_idx;');
    });

    it('should generate REMOVE INDEX', () => {
      const sql = generateIndexRemove('user', 'old_idx');
      expect(sql).toBe('REMOVE INDEX old_idx ON TABLE user;');
    });
  });

  describe('Event Generator', () => {
    it('should generate DEFINE EVENT', () => {
      const sql = generateEventDefinition('user', {
        name: 'on_update',
        type: 'UPDATE',
        thenStatement: 'UPDATE $after SET updatedAt = time::now()',
      });
      expect(sql).toContain('DEFINE EVENT on_update');
      expect(sql).toContain('ON TABLE user');
      expect(sql).toContain('WHEN $event = "UPDATE"');
      expect(sql).toContain('THEN');
    });

    it('should generate EVENT with WHEN condition', () => {
      const sql = generateEventDefinition('order', {
        name: 'notify_high_value',
        type: 'CREATE',
        when: '$after.total > 1000',
        thenStatement: 'CREATE notification SET message = "High value order"',
      });
      expect(sql).toContain('WHEN $event = "CREATE"');
      expect(sql).toContain('AND $after.total > 1000');
    });
  });

  describe('Function Generator', () => {
    it('should generate DEFINE FUNCTION', () => {
      const sql = generateFunctionDefinition({
        name: 'days_since',
        parameters: [{ name: 'time', type: 'datetime' }],
        returnType: 'float',
        body: 'RETURN <float> (time::now() - $time) / 60 / 60 / 24;',
      });
      expect(sql).toContain('DEFINE FUNCTION fn::days_since');
      expect(sql).toContain('($time: datetime)');
      expect(sql).toContain('-> float');
      expect(sql).toContain('RETURN');
    });

    it('should generate function with PERMISSIONS', () => {
      const sql = generateFunctionDefinition({
        name: 'admin_only',
        parameters: [],
        body: 'RETURN true;',
        permissions: 'WHERE $auth.role = "admin"',
      });
      expect(sql).toContain('PERMISSIONS WHERE $auth.role = "admin"');
    });
  });

  describe('Analyzer Generator', () => {
    it('should generate DEFINE ANALYZER', () => {
      const sql = generateAnalyzerDefinition({
        name: 'english_search',
        tokenizers: ['class', 'camel', 'blank'],
        filters: ['lowercase', 'ascii', 'snowball(english)'],
      });
      expect(sql).toContain('DEFINE ANALYZER english_search');
      expect(sql).toContain('TOKENIZERS class,camel,blank');
      expect(sql).toContain('FILTERS lowercase,ascii,snowball(english)');
    });

    it('should generate analyzer with custom FUNCTION', () => {
      const sql = generateAnalyzerDefinition({
        name: 'custom_analyzer',
        tokenizers: [],
        filters: [],
        function: 'my_tokenizer',
      });
      expect(sql).toContain('FUNCTION fn::my_tokenizer');
    });
  });

  describe('Access Generator', () => {
    it('should generate JWT ACCESS', () => {
      const sql = generateAccessDefinition({
        name: 'api',
        type: 'JWT',
        level: 'DATABASE',
        algorithm: 'HS256',
        key: 'my-secret-key',
      });
      expect(sql).toContain('DEFINE ACCESS api');
      expect(sql).toContain('ON DATABASE');
      expect(sql).toContain('TYPE JWT');
      expect(sql).toContain('ALGORITHM HS256');
      expect(sql).toContain('KEY "my-secret-key"');
    });

    it('should generate RECORD ACCESS', () => {
      const sql = generateAccessDefinition({
        name: 'user',
        type: 'RECORD',
        level: 'DATABASE',
        signup: 'CREATE user SET email = $email',
        signin: 'SELECT * FROM user WHERE email = $email',
        session: '7d',
      });
      expect(sql).toContain('TYPE RECORD');
      expect(sql).toContain('SIGNUP');
      expect(sql).toContain('SIGNIN');
      expect(sql).toContain('SESSION 7d');
    });
  });

  describe('Param Generator', () => {
    it('should generate DEFINE PARAM', () => {
      const sql = generateParamDefinition({
        name: 'app_name',
        value: '"My Application"',
      });
      expect(sql).toBe('DEFINE PARAM $app_name VALUE "My Application";');
    });
  });

  describe('User Generator', () => {
    it('should generate DEFINE USER', () => {
      const sql = generateUserDefinition({
        name: 'admin',
        password: 'secure-password',
        role: 'OWNER',
        level: 'DATABASE',
      });
      expect(sql).toContain('DEFINE USER admin');
      expect(sql).toContain('ON DATABASE');
      expect(sql).toContain('PASSWORD "secure-password"');
      expect(sql).toContain('ROLES OWNER');
    });

    it('should generate user with multiple ROLES', () => {
      const sql = generateUserDefinition({
        name: 'editor',
        password: 'editor-pass',
        roles: ['EDITOR', 'VIEWER'],
        level: 'NAMESPACE',
      });
      expect(sql).toContain('ON NAMESPACE');
      expect(sql).toContain('ROLES EDITOR, VIEWER');
    });
  });

  describe('Sequence Generator', () => {
    it('should generate DEFINE SEQUENCE', () => {
      const sql = generateSequenceDefinition({
        name: 'order_number',
        start: 1000,
        step: 1,
      });
      expect(sql).toContain('DEFINE SEQUENCE order_number');
      expect(sql).toContain('START 1000');
      expect(sql).toContain('INCREMENT 1');
    });

    it('should generate sequence with CYCLE', () => {
      const sql = generateSequenceDefinition({
        name: 'limited_seq',
        min: 1,
        max: 9999,
        cycle: true,
      });
      expect(sql).toContain('MINVALUE 1');
      expect(sql).toContain('MAXVALUE 9999');
      expect(sql).toContain('CYCLE');
    });
  });

  describe('Config Generator', () => {
    it('should generate DEFINE CONFIG GRAPHQL', () => {
      const sql = generateConfigDefinition({
        type: 'GRAPHQL',
        tablesMode: 'AUTO',
        functionsMode: 'AUTO',
      });
      expect(sql).toContain('DEFINE CONFIG GRAPHQL');
      expect(sql).toContain('TABLES AUTO');
      expect(sql).toContain('FUNCTIONS AUTO');
    });

    it('should generate config with INCLUDE', () => {
      const sql = generateConfigDefinition({
        type: 'GRAPHQL',
        tablesMode: 'INCLUDE',
        tablesList: ['user', 'post'],
      });
      expect(sql).toContain('TABLES INCLUDE user, post');
    });
  });
});

