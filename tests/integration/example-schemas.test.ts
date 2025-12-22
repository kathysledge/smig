/**
 * Integration tests for all example schemas
 *
 * These tests verify that:
 * 1. Each example schema can be loaded
 * 2. Each schema can be migrated to the database
 * 3. After migration, running generate shows no additional changes needed
 * 4. The schema can be rolled back successfully
 *
 * This catches issues like the notification type field modification that persists
 * in social-network-schema.js
 */

import { exec } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanupTestFiles, TEST_DATABASES } from './setup';

const execAsync = promisify(exec);

describe('Example Schema Integration Tests', () => {
  const CLI_PATH = path.join(process.cwd(), 'dist', 'cli.js');
  const TEST_CONFIG_PATH = path.join(process.cwd(), 'smig.config.js');
  // Use relative paths for schema configs since validateConfig joins with cwd
  const EXAMPLES_REL_DIR = './examples';

  // Track which tables were created for proper cleanup
  let createdDatabases: string[] = [];

  beforeAll(async () => {
    // Ensure CLI is built
    if (!fs.existsSync(CLI_PATH)) {
      throw new Error('CLI not built. Run "bun run build" first.');
    }
  });

  beforeEach(async () => {
    // Clean up any existing test files
    cleanupTestFiles(['smig-debug-*.txt', 'smig.config.js']);
    createdDatabases = [];
  });

  afterEach(async () => {
    // Clean up test config and debug files
    cleanupTestFiles(['smig-debug-*.txt', 'smig.config.js']);
    // Note: Database tables are left in place - each test uses a unique database name
  }, 30000);

  /**
   * Helper to create a unique test database name
   */
  function createTestDbName(schemaName: string): string {
    const timestamp = Date.now();
    const dbName = `test_${schemaName}_${timestamp}`;
    createdDatabases.push(dbName);
    return dbName;
  }

  /**
   * Helper to run a full migration cycle and verify no remaining changes
   */
  async function runMigrationCycleTest(schemaPath: string, schemaName: string): Promise<void> {
    const dbName = createTestDbName(schemaName);
    const db = TEST_DATABASES.db1;

    // Create config for this test
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

    // Step 1: Run generate to see what changes are needed initially
    console.log(`\n[${schemaName}] Step 1: Initial generate...`);
    const { stdout: initialGenerate } = await execAsync(`node ${CLI_PATH} generate --debug`);
    console.log(`  Initial generate output: ${initialGenerate.substring(0, 200)}...`);

    // Ensure there are changes to apply (except for empty schemas)
    if (!initialGenerate.includes('No changes detected')) {
      expect(initialGenerate).toMatch(/DEFINE|Generated SurrealQL Diff/);
    }

    // Step 2: Run migrate (ora spinner outputs to stderr, so capture both)
    console.log(`[${schemaName}] Step 2: Migrating...`);
    const { stdout: migrateStdout, stderr: migrateStderr } = await execAsync(
      `node ${CLI_PATH} migrate --debug`,
    );
    const migrateOutput = migrateStdout + migrateStderr;
    console.log(`  Migrate output: ${migrateOutput.substring(0, 200)}...`);

    // Migration should succeed
    const successMessages = ['Migration applied successfully', 'No changes detected', 'up to date'];
    const migrationSucceeded = successMessages.some((msg) => migrateOutput.includes(msg));
    expect(migrationSucceeded).toBe(true);

    // Step 3: Run generate again - should show NO changes needed
    console.log(`[${schemaName}] Step 3: Verifying no remaining changes...`);
    const { stdout: verifyGenerate } = await execAsync(`node ${CLI_PATH} generate --debug`);
    console.log(`  Verify generate output: ${verifyGenerate}`);

    // THIS IS THE CRITICAL CHECK: After migration, there should be no pending changes
    if (!verifyGenerate.includes('No changes detected')) {
      console.error(`\n⚠️  FAILED: ${schemaName} has remaining changes after migration:`);
      console.error(verifyGenerate);

      // Extract and show the specific changes
      const diffMatch = verifyGenerate.match(
        /Generated SurrealQL Diff:[\s\S]*?={50}([\s\S]*?)Generated Rollback/,
      );
      if (diffMatch) {
        console.error('\nRemaining changes:');
        console.error(diffMatch[1]);
      }
    }

    expect(verifyGenerate).toContain('No changes detected');
  }

  describe('Minimal Example Schema', () => {
    it('should migrate and have no remaining changes', async () => {
      const schemaRelPath = `${EXAMPLES_REL_DIR}/minimal-example.ts`;
      expect(fs.existsSync(path.join(process.cwd(), schemaRelPath))).toBe(true);
      await runMigrationCycleTest(schemaRelPath, 'minimal');
    }, 60000);
  });

  describe('Social Network Schema', () => {
    it('should migrate and have no remaining changes', async () => {
      const schemaRelPath = `${EXAMPLES_REL_DIR}/social-network-schema.ts`;
      expect(fs.existsSync(path.join(process.cwd(), schemaRelPath))).toBe(true);
      await runMigrationCycleTest(schemaRelPath, 'social_network');
    }, 90000);
  });

  describe('Social Platform Schema', () => {
    it('should migrate and have no remaining changes', async () => {
      const schemaRelPath = `${EXAMPLES_REL_DIR}/social-platform-schema.ts`;
      expect(fs.existsSync(path.join(process.cwd(), schemaRelPath))).toBe(true);
      await runMigrationCycleTest(schemaRelPath, 'social_platform');
    }, 90000);
  });

  describe('Blog Example Schema', () => {
    it('should migrate and have no remaining changes', async () => {
      const schemaRelPath = `${EXAMPLES_REL_DIR}/blog-example.ts`;
      expect(fs.existsSync(path.join(process.cwd(), schemaRelPath))).toBe(true);
      await runMigrationCycleTest(schemaRelPath, 'blog_example');
    }, 60000);
  });

  describe('E-commerce Example Schema', () => {
    it('should migrate and have no remaining changes', async () => {
      const schemaRelPath = `${EXAMPLES_REL_DIR}/ecommerce-example.ts`;
      expect(fs.existsSync(path.join(process.cwd(), schemaRelPath))).toBe(true);
      await runMigrationCycleTest(schemaRelPath, 'ecommerce');
    }, 90000);
  });

  describe('AI Embeddings Example Schema', () => {
    it('should migrate and have no remaining changes', async () => {
      const schemaRelPath = `${EXAMPLES_REL_DIR}/ai-embeddings-example.ts`;
      expect(fs.existsSync(path.join(process.cwd(), schemaRelPath))).toBe(true);
      await runMigrationCycleTest(schemaRelPath, 'ai_embeddings');
    }, 90000);
  });

  describe('Rollback Tests', () => {
    it('should rollback minimal example successfully', async () => {
      const schemaRelPath = `${EXAMPLES_REL_DIR}/minimal-example.ts`;
      const dbName = createTestDbName('minimal_rollback');
      const db = TEST_DATABASES.db1;

      const configContent = `
export default {
  url: '${db.url}',
  username: '${db.username}',
  password: '${db.password}',
  namespace: '${db.namespace}',
  database: '${dbName}',
  schema: '${schemaRelPath}'
};`;
      fs.writeFileSync(TEST_CONFIG_PATH, configContent);

      // Apply migration (capture stderr for ora spinner output)
      const { stdout: migrateStdout, stderr: migrateStderr } = await execAsync(
        `node ${CLI_PATH} migrate`,
      );
      const migrateOutput = migrateStdout + migrateStderr;
      expect(migrateOutput).toMatch(/Migration applied successfully|No changes detected/);

      // Check status to get migration ID (ora outputs to stderr)
      const { stdout: statusStdout, stderr: statusStderr } = await execAsync(
        `node ${CLI_PATH} status`,
      );
      const statusOutput = statusStdout + statusStderr;
      expect(statusOutput).toContain('Applied migrations:');

      // Rollback (answer 'y' to confirmation, capture both streams)
      const { stdout: rollbackStdout, stderr: rollbackStderr } = await execAsync(
        `echo "y" | node ${CLI_PATH} rollback`,
      );
      const rollbackOutput = rollbackStdout + rollbackStderr;

      const rollbackSuccess = ['rolled back successfully', 'No migrations to rollback'].some(
        (msg) => rollbackOutput.includes(msg) || statusOutput.includes('Applied migrations: 0'),
      );
      expect(rollbackSuccess).toBe(true);
    }, 60000);
  });

  describe('Idempotency Tests', () => {
    it('should be idempotent - multiple migrations produce same result', async () => {
      const schemaRelPath = `${EXAMPLES_REL_DIR}/minimal-example.ts`;
      const dbName = createTestDbName('idempotent');
      const db = TEST_DATABASES.db1;

      const configContent = `
export default {
  url: '${db.url}',
  username: '${db.username}',
  password: '${db.password}',
  namespace: '${db.namespace}',
  database: '${dbName}',
  schema: '${schemaRelPath}'
};`;
      fs.writeFileSync(TEST_CONFIG_PATH, configContent);

      // First migration (capture stderr for ora spinner output)
      const { stdout: firstStdout, stderr: firstStderr } = await execAsync(
        `node ${CLI_PATH} migrate`,
      );
      const firstMigrate = firstStdout + firstStderr;
      expect(firstMigrate).toMatch(/Migration applied successfully|No changes detected/);

      // Second migration attempt - should detect no changes
      const { stdout: secondStdout, stderr: secondStderr } = await execAsync(
        `node ${CLI_PATH} migrate`,
      );
      const secondMigrate = secondStdout + secondStderr;
      expect(secondMigrate).toMatch(/No changes detected|up to date/);

      // Third migration attempt - still no changes
      const { stdout: thirdStdout, stderr: thirdStderr } = await execAsync(
        `node ${CLI_PATH} migrate`,
      );
      const thirdMigrate = thirdStdout + thirdStderr;
      expect(thirdMigrate).toMatch(/No changes detected|up to date/);
    }, 90000);
  });
});
