/**
 * Integration tests for vector indexes (HNSW and MTREE)
 * 
 * Tests AI/ML embedding vector indexes for semantic search.
 */

import { exec } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanupTestFiles, TEST_DATABASES } from './setup';

const execAsync = promisify(exec);

describe('Vector Index Integration Tests', () => {
  const CLI_PATH = path.join(process.cwd(), 'dist', 'cli.js');
  const TEST_CONFIG_PATH = path.join(process.cwd(), 'smig.config.js');
  const FIXTURES_DIR = path.join(process.cwd(), 'tests', 'integration', 'fixtures');

  beforeAll(async () => {
    if (!fs.existsSync(CLI_PATH)) {
      throw new Error('CLI not built. Run "bun run build" first.');
    }
    if (!fs.existsSync(FIXTURES_DIR)) {
      fs.mkdirSync(FIXTURES_DIR, { recursive: true });
    }
  });

  beforeEach(async () => {
    cleanupTestFiles([
      'smig-debug-*.txt',
      'smig.config.js',
      'tests/integration/fixtures/vector-*.js',
    ]);
  });

  afterEach(async () => {
    cleanupTestFiles([
      'smig-debug-*.txt',
      'smig.config.js',
      'tests/integration/fixtures/vector-*.js',
    ]);
  });

  function createSchema(name: string, content: string): string {
    const filename = `vector-${name}.js`;
    const schemaPath = path.join(FIXTURES_DIR, filename);
    fs.writeFileSync(schemaPath, content);
    return `./tests/integration/fixtures/${filename}`;
  }

  function createConfig(schemaPath: string, dbName: string): void {
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
  }

  describe('HNSW indexes', () => {
    it('should create HNSW index with default options', async () => {
      const dbName = `test_hnsw_default_${Date.now()}`;

      const schemaPath = createSchema('hnsw-default', `
import { defineSchema, composeSchema, string, array, index } from '../../../dist/schema/concise-schema.ts';

export default composeSchema({
  models: {
    document: defineSchema({
      table: 'document',
      fields: {
        title: string(),
        embedding: array('float'),
      },
      indexes: {
        embeddingIdx: index(['embedding']).hnsw().dimension(1536),
      }
    })
  },
  relations: {}
});`);

      createConfig(schemaPath, dbName);

      const { stdout } = await execAsync(`node ${CLI_PATH} generate --debug`);
      
      expect(stdout).toContain('DEFINE INDEX embeddingIdx');
      expect(stdout).toContain('HNSW');
      expect(stdout).toContain('DIMENSION 1536');
    }, 60000);

    it('should create HNSW index with custom distance metric', async () => {
      const dbName = `test_hnsw_cosine_${Date.now()}`;

      const schemaPath = createSchema('hnsw-cosine', `
import { defineSchema, composeSchema, string, array, index } from '../../../dist/schema/concise-schema.ts';

export default composeSchema({
  models: {
    article: defineSchema({
      table: 'article',
      fields: {
        content: string(),
        vector: array('float'),
      },
      indexes: {
        vectorIdx: index(['vector']).hnsw().dimension(768).dist('COSINE').m(16).efc(100),
      }
    })
  },
  relations: {}
});`);

      createConfig(schemaPath, dbName);

      const { stdout } = await execAsync(`node ${CLI_PATH} generate --debug`);
      
      expect(stdout).toContain('DEFINE INDEX vectorIdx');
      expect(stdout).toContain('HNSW');
      expect(stdout).toContain('DIMENSION 768');
      expect(stdout).toContain('COSINE');
    }, 60000);

    it('should migrate and verify HNSW index', async () => {
      const dbName = `test_hnsw_migrate_${Date.now()}`;

      const schemaPath = createSchema('hnsw-migrate', `
import { defineSchema, composeSchema, string, array, index } from '../../../dist/schema/concise-schema.ts';

export default composeSchema({
  models: {
    embedding_store: defineSchema({
      table: 'embedding_store',
      fields: {
        key: string(),
        data: array('float'),
      },
      indexes: {
        dataIdx: index(['data']).hnsw().dimension(512),
      }
    })
  },
  relations: {}
});`);

      createConfig(schemaPath, dbName);

      // Apply migration
      const { stderr } = await execAsync(`node ${CLI_PATH} migrate`);
      expect(stderr).toContain('Migration applied successfully');

      // Verify no changes remain
      const { stdout } = await execAsync(`node ${CLI_PATH} generate`);
      expect(stdout).toContain('No changes detected');
    }, 60000);
  });

  describe('MTREE indexes', () => {
    it('should create MTREE index with default options', async () => {
      const dbName = `test_mtree_default_${Date.now()}`;

      const schemaPath = createSchema('mtree-default', `
import { defineSchema, composeSchema, string, array, index } from '../../../dist/schema/concise-schema.ts';

export default composeSchema({
  models: {
    image: defineSchema({
      table: 'image',
      fields: {
        filename: string(),
        features: array('float'),
      },
      indexes: {
        featuresIdx: index(['features']).mtree().dimension(256),
      }
    })
  },
  relations: {}
});`);

      createConfig(schemaPath, dbName);

      const { stdout } = await execAsync(`node ${CLI_PATH} generate --debug`);
      
      expect(stdout).toContain('DEFINE INDEX featuresIdx');
      expect(stdout).toContain('MTREE');
      expect(stdout).toContain('DIMENSION 256');
    }, 60000);

    it('should create MTREE index with custom capacity', async () => {
      const dbName = `test_mtree_capacity_${Date.now()}`;

      const schemaPath = createSchema('mtree-capacity', `
import { defineSchema, composeSchema, string, array, index } from '../../../dist/schema/concise-schema.ts';

export default composeSchema({
  models: {
    point: defineSchema({
      table: 'point',
      fields: {
        label: string(),
        coords: array('float'),
      },
      indexes: {
        coordsIdx: index(['coords']).mtree().dimension(128).dist('EUCLIDEAN').capacity(50),
      }
    })
  },
  relations: {}
});`);

      createConfig(schemaPath, dbName);

      const { stdout } = await execAsync(`node ${CLI_PATH} generate --debug`);
      
      expect(stdout).toContain('MTREE');
      expect(stdout).toContain('DIMENSION 128');
      expect(stdout).toContain('CAPACITY 50');
    }, 60000);
  });

  describe('SEARCH indexes', () => {
    it('should create full-text SEARCH index', async () => {
      const dbName = `test_search_${Date.now()}`;

      const schemaPath = createSchema('search', `
import { defineSchema, composeSchema, string, index, analyzer } from '../../../dist/schema/concise-schema.ts';

const textAnalyzer = analyzer('text_analyzer')
  .tokenizers(['blank', 'class'])
  .filters(['lowercase', 'ascii', 'snowball(english)']);

export default composeSchema({
  models: {
    blog_post: defineSchema({
      table: 'blog_post',
      fields: {
        title: string(),
        body: string(),
      },
      indexes: {
        contentSearch: index(['title', 'body']).search().analyzer('text_analyzer').bm25(1.2, 0.75).highlights(),
      }
    })
  },
  relations: {},
  analyzers: {
    text_analyzer: textAnalyzer,
  }
});`);

      createConfig(schemaPath, dbName);

      const { stdout } = await execAsync(`node ${CLI_PATH} generate --debug`);
      
      expect(stdout).toContain('DEFINE INDEX contentSearch');
      expect(stdout).toContain('SEARCH');
      expect(stdout).toContain('ANALYZER text_analyzer');
      expect(stdout).toContain('BM25');
    }, 60000);
  });
});
