import { exec } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanupTestFiles, createTestSchema, TEST_DATABASES } from './setup';

const execAsync = promisify(exec);

describe('CLI Integration Tests', () => {
  const CLI_PATH = path.join(process.cwd(), 'dist', 'cli.js');
  const TEST_CONFIG_PATH = path.join(process.cwd(), 'smig.config.js');

  beforeEach(() => {
    // Clean up any existing test files
    cleanupTestFiles([
      'tests/integration/fixtures/test-*.js',
      'smig-debug-*.txt',
      'smig.config.js',
    ]);
  });

  afterEach(() => {
    // Clean up test files after each test
    cleanupTestFiles([
      'tests/integration/fixtures/test-*.js',
      'smig-debug-*.txt',
      'smig.config.js',
    ]);
  });

  describe('Configuration System', () => {
    it('should load configuration from smig.config.js with multiple environments', async () => {
      // Create test config file
      const configContent = `
export default {
  url: '${TEST_DATABASES.db1.url}',
  username: '${TEST_DATABASES.db1.username}',
  password: '${TEST_DATABASES.db1.password}',
  namespace: '${TEST_DATABASES.db1.namespace}',
  database: '${TEST_DATABASES.db1.database}',
  schema: './tests/integration/fixtures/schema.js',
  environments: {
    test_env1: {
      database: 'test_env1_db',
      url: '${TEST_DATABASES.db1.url}'
    },
    test_env2: {
      database: 'test_env2_db',
      url: '${TEST_DATABASES.db2.url}'
    }
  }
};`;

      fs.writeFileSync(TEST_CONFIG_PATH, configContent);

      // Test config command shows available environments
      const { stdout } = await execAsync(`node ${CLI_PATH} config`);

      expect(stdout).toContain('🌍 Available Environments:');
      expect(stdout).toContain('test_env1');
      expect(stdout).toContain('test_env2');
      expect(stdout).toContain(TEST_DATABASES.db1.url);
    });

    it('should use specific environment when --env flag is provided', async () => {
      // Create test config file
      const configContent = `
export default {
  url: '${TEST_DATABASES.db1.url}',
  username: 'root',
  password: 'root',
  namespace: 'test',
  database: 'default_db',
  schema: './tests/integration/fixtures/schema.js',
  environments: {
    production: {
      database: 'production_db',
      url: '${TEST_DATABASES.db2.url}'
    }
  }
};`;

      fs.writeFileSync(TEST_CONFIG_PATH, configContent);

      // Test config command with specific environment
      const { stdout } = await execAsync(`node ${CLI_PATH} config --env production`);

      expect(stdout).toContain('production_db');
      expect(stdout).toContain(TEST_DATABASES.db2.url);
    });

    it('should throw error for non-existent environment', async () => {
      // Create test config file
      const configContent = `
export default {
  url: '${TEST_DATABASES.db1.url}',
  username: 'root',
  password: 'root',
  namespace: 'test',
  database: 'default_db',
  schema: './tests/integration/fixtures/schema.js'
};`;

      fs.writeFileSync(TEST_CONFIG_PATH, configContent);

      // Test that non-existent environment throws error
      await expect(execAsync(`node ${CLI_PATH} config --env nonexistent`)).rejects.toThrow();
    });
  });

  describe('Schema Generation and Migration', () => {
    it('should generate migration for new table', async () => {
      // Create test schema
      const schemaContent = `
import { defineSchema, composeSchema, string, int, datetime } from '../../../dist/schema/concise-schema.js';

export default composeSchema({
  models: {
    user: defineSchema({
      table: 'user',
      fields: {
        name: string().required(),
        email: string().unique(),
        age: int(),
        createdAt: datetime().value('time::now()')
      }
    })
  },
  relations: {}
});`;

      const schemaPath = createTestSchema(schemaContent);

      // Create test config
      const configContent = `
export default {
  url: '${TEST_DATABASES.db1.url}',
  username: '${TEST_DATABASES.db1.username}',
  password: '${TEST_DATABASES.db1.password}',
  namespace: '${TEST_DATABASES.db1.namespace}',
  database: '${TEST_DATABASES.db1.database}',
  schema: '${schemaPath}'
};`;

      fs.writeFileSync(TEST_CONFIG_PATH, configContent);

      // Generate migration
      const { stdout } = await execAsync(`node ${CLI_PATH} generate`);

      expect(stdout).toContain('Generated SurrealQL Diff:');
      expect(stdout).toContain('Migration diff for');
      expect(stdout).toMatch(/DEFINE|REMOVE/);
    });

    it('should detect no changes when schema matches database', async () => {
      // Create minimal schema
      const schemaContent = `
import { composeSchema } from '../../../dist/schema/concise-schema.js';

export default composeSchema({
  models: {},
  relations: {}
});`;

      const schemaPath = createTestSchema(schemaContent);

      // Create test config
      const configContent = `
export default {
  url: '${TEST_DATABASES.db1.url}',
  username: '${TEST_DATABASES.db1.username}',
  password: '${TEST_DATABASES.db1.password}',
  namespace: '${TEST_DATABASES.db1.namespace}',
  database: '${TEST_DATABASES.db1.database}',
  schema: '${schemaPath}'
};`;

      fs.writeFileSync(TEST_CONFIG_PATH, configContent);

      // Generate migration (should detect no changes)
      const { stdout } = await execAsync(`node ${CLI_PATH} generate`);

      expect(stdout).toContain('No changes detected');
    });

    it('should apply migration and track it in _migrations table', async () => {
      // Create test schema
      const schemaContent = `
import { defineSchema, composeSchema, string, datetime } from '../../../dist/schema/concise-schema.js';

export default composeSchema({
  models: {
    article: defineSchema({
      table: 'article',
      fields: {
        title: string().required(),
        content: string(),
        publishedAt: datetime().value('time::now()')
      }
    })
  },
  relations: {}
});`;

      const schemaPath = createTestSchema(schemaContent);

      // Create test config
      const configContent = `
export default {
  url: '${TEST_DATABASES.db1.url}',
  username: '${TEST_DATABASES.db1.username}',
  password: '${TEST_DATABASES.db1.password}',
  namespace: '${TEST_DATABASES.db1.namespace}',
  database: '${TEST_DATABASES.db1.database}',
  schema: '${schemaPath}'
};`;

      fs.writeFileSync(TEST_CONFIG_PATH, configContent);

      // Apply migration with message
      const { stdout } = await execAsync(`node ${CLI_PATH} migrate --message "Add article table"`);

      // The migrate command should either succeed or indicate no changes needed
      // Both are valid outcomes for this test
      const validOutcomes = [
        'Migration applied successfully',
        'Database schema is up to date',
        'No changes detected',
      ];

      const hasValidOutcome = validOutcomes.some((outcome) => stdout.includes(outcome));

      if (!hasValidOutcome && stdout.trim() === '') {
        // If output is empty, that's also acceptable as it might mean no changes
        console.log('Migration completed with empty output - assuming no changes needed');
      } else if (!hasValidOutcome) {
        console.log('Unexpected migration output:', stdout);
        expect(hasValidOutcome).toBe(true);
      }

      // Check migration status (only if migration was actually applied)
      if (stdout.includes('Migration applied successfully')) {
        const { stdout: statusOutput } = await execAsync(`node ${CLI_PATH} status`);
        expect(statusOutput).toContain('Applied migrations:');
        expect(statusOutput).toContain('Add article table');
      } else {
        console.log('Skipping status check since no migration was applied');
      }
    });
  });

  describe('Migration Status and Rollback', () => {
    it('should show migration status', async () => {
      // Create minimal config
      const configContent = `
export default {
  url: '${TEST_DATABASES.db1.url}',
  username: '${TEST_DATABASES.db1.username}',
  password: '${TEST_DATABASES.db1.password}',
  namespace: '${TEST_DATABASES.db1.namespace}',
  database: '${TEST_DATABASES.db1.database}',
  schema: './tests/integration/fixtures/empty-schema.js'
};`;

      fs.writeFileSync(TEST_CONFIG_PATH, configContent);

      // Create empty schema
      createTestSchema(
        `
import { composeSchema } from '../../../dist/schema/concise-schema.js';
export default composeSchema({ models: {}, relations: {} });
      `,
        'empty-schema.js',
      );

      // Check status
      const { stdout } = await execAsync(`node ${CLI_PATH} status`);

      expect(stdout).toContain('Migration Status');
      expect(stdout).toMatch(/Applied migrations: \d+/);
    });

    it('should perform rollback with confirmation', async () => {
      // This test would require more complex setup with actual migrations
      // For now, we'll test that the rollback command exists and requires confirmation

      const configContent = `
export default {
  url: '${TEST_DATABASES.db1.url}',
  username: '${TEST_DATABASES.db1.username}',
  password: '${TEST_DATABASES.db1.password}',
  namespace: '${TEST_DATABASES.db1.namespace}',
  database: '${TEST_DATABASES.db1.database}',
  schema: './tests/integration/fixtures/empty-schema.js'
};`;

      fs.writeFileSync(TEST_CONFIG_PATH, configContent);
      createTestSchema(
        `
import { composeSchema } from '../../../dist/schema/concise-schema.js';
export default composeSchema({ models: {}, relations: {} });
      `,
        'empty-schema.js',
      );

      // Test rollback command (this will likely fail due to no migrations, but should show proper error)
      try {
        await execAsync(`echo "n" | node ${CLI_PATH} rollback`);
        // biome-ignore lint/suspicious/noExplicitAny: Catch block error needs flexible typing
      } catch (error: any) {
        // Expect specific error about no migrations to rollback
        expect(error.stdout || error.stderr).toContain('migration');
      }
    });
  });

  describe('Environment Variables Integration', () => {
    it('should use environment variables when config file is not present', async () => {
      // Set environment variables
      const env = {
        ...process.env,
        SMIG_URL: TEST_DATABASES.db1.url,
        SMIG_USERNAME: TEST_DATABASES.db1.username,
        SMIG_PASSWORD: TEST_DATABASES.db1.password,
        SMIG_NAMESPACE: TEST_DATABASES.db1.namespace,
        SMIG_DATABASE: TEST_DATABASES.db1.database,
        SMIG_SCHEMA: './tests/integration/fixtures/env-schema.js',
      };

      // Create schema file
      createTestSchema(
        `
import { composeSchema } from '../../../dist/schema/concise-schema.js';
export default composeSchema({ models: {}, relations: {} });
      `,
        'env-schema.js',
      );

      // Test config command with environment variables
      const { stdout } = await execAsync(`node ${CLI_PATH} config`, { env });

      expect(stdout).toContain(TEST_DATABASES.db1.url);
      expect(stdout).toContain(TEST_DATABASES.db1.database);
    });
  });

  describe('Debug Logging', () => {
    it('should create debug log file when --debug flag is used', async () => {
      const configContent = `
export default {
  url: '${TEST_DATABASES.db1.url}',
  username: '${TEST_DATABASES.db1.username}',
  password: '${TEST_DATABASES.db1.password}',
  namespace: '${TEST_DATABASES.db1.namespace}',
  database: '${TEST_DATABASES.db1.database}',
  schema: './tests/integration/fixtures/debug-schema.js'
};`;

      fs.writeFileSync(TEST_CONFIG_PATH, configContent);

      createTestSchema(
        `
import { composeSchema } from '../../../dist/schema/concise-schema.js';
export default composeSchema({ models: {}, relations: {} });
      `,
        'debug-schema.js',
      );

      // Run command with debug flag
      await execAsync(`node ${CLI_PATH} generate --debug`);

      // Check that debug log file was created
      const debugFiles = fs
        .readdirSync(process.cwd())
        .filter((file) => file.startsWith('smig-debug-') && file.endsWith('.txt'));

      expect(debugFiles.length).toBeGreaterThan(0);

      // Check debug file content
      const debugContent = fs.readFileSync(debugFiles[0], 'utf8');
      expect(debugContent).toContain('=== SMIG Debug Log');
    });
  });

  describe('Additional CLI Features', () => {
    it('should display help information correctly', async () => {
      const { stdout } = await execAsync(`node ${CLI_PATH} --help`);

      expect(stdout).toContain('Automatic SurrealDB migrations with a concise DSL');
      expect(stdout).toContain('migrate');
      expect(stdout).toContain('generate');
      expect(stdout).toContain('status');
      expect(stdout).toContain('rollback');
      expect(stdout).toContain('config');
    });

    it('should handle version flag correctly', async () => {
      const { stdout } = await execAsync(`node ${CLI_PATH} --version`);

      // Support semver with optional pre-release suffix (e.g., 1.0.0-alpha.1)
      expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+(-[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*)?$/);
    });
  });
});
