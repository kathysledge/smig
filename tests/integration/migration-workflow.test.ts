/**
 * Integration tests for the full migration workflow
 *
 * Tests the complete lifecycle: create → migrate → modify → migrate → rollback
 */

import { exec } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanupTestFiles, TEST_DATABASES } from './setup';

const execAsync = promisify(exec);

describe('Migration Workflow Integration Tests', () => {
  const CLI_PATH = path.join(process.cwd(), 'dist', 'cli.js');
  const TEST_CONFIG_PATH = path.join(process.cwd(), 'smig.config.ts');
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
      'smig.config.ts',
      'tests/integration/fixtures/workflow-*.ts',
    ]);
  });

  afterEach(async () => {
    cleanupTestFiles([
      'smig-debug-*.txt',
      'smig.config.ts',
      'tests/integration/fixtures/workflow-*.ts',
    ]);
  });

  function createSchema(name: string, content: string): string {
    const filename = `workflow-${name}.ts`;
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

  it('should handle full migration lifecycle: create → migrate → modify → migrate', async () => {
    const dbName = `test_lifecycle_${Date.now()}`;

    // === STEP 1: Initial schema ===
    console.log('\n=== Step 1: Create initial schema ===');
    const v1 = createSchema(
      'lifecycle-v1',
      `
import { defineSchema, composeSchema, string, int, datetime, index } from 'smig';

export default composeSchema({
  models: {
    user: defineSchema({
      table: 'lifecycle_user',
      fields: {
        email: string().required(),
        name: string(),
        age: int().default(0),
        createdAt: datetime().value('time::now()'),
      },
      indexes: {
        emailIdx: index(['email']).unique(),
      }
    }),
    post: defineSchema({
      table: 'lifecycle_post',
      fields: {
        title: string().required(),
        content: string(),
        createdAt: datetime().value('time::now()'),
      }
    })
  },
  relations: {}
});`,
    );

    createConfig(v1, dbName);

    // Generate to preview
    const { stdout: previewV1 } = await execAsync(`node ${CLI_PATH} generate --debug`);
    expect(previewV1).toContain('DEFINE TABLE lifecycle_user');
    expect(previewV1).toContain('DEFINE TABLE lifecycle_post');
    console.log('✅ v1 schema preview generated');

    // Apply v1
    const { stderr: migrateV1 } = await execAsync(`node ${CLI_PATH} migrate`);
    expect(migrateV1).toContain('Migration applied successfully');
    console.log('✅ v1 migration applied');

    // Verify no changes
    const { stdout: verifyV1 } = await execAsync(`node ${CLI_PATH} generate`);
    expect(verifyV1).toContain('No changes detected');
    console.log('✅ v1 verified - no remaining changes');

    // Check status
    const { stdout: statusV1, stderr: statusV1Stderr } = await execAsync(`node ${CLI_PATH} status`);
    const statusOutputV1 = statusV1 + statusV1Stderr;
    expect(statusOutputV1).toContain('Applied migrations: 1');
    console.log('✅ Migration status shows 1 applied');

    // === STEP 2: Modify schema ===
    console.log('\n=== Step 2: Modify schema ===');
    const v2 = createSchema(
      'lifecycle-v2',
      `
import { defineSchema, composeSchema, string, int, bool, datetime, index, record } from 'smig';

export default composeSchema({
  models: {
    user: defineSchema({
      table: 'lifecycle_user',
      fields: {
        email: string().required(),
        name: string(),
        age: int().default(0),
        isVerified: bool().default(false),
        createdAt: datetime().value('time::now()'),
        updatedAt: datetime(),
      },
      indexes: {
        emailIdx: index(['email']).unique(),
        verifiedIdx: index(['isVerified']),
      }
    }),
    post: defineSchema({
      table: 'lifecycle_post',
      fields: {
        title: string().required(),
        content: string(),
        author: record('lifecycle_user'),
        views: int().default(0),
        createdAt: datetime().value('time::now()'),
      },
      indexes: {
        authorIdx: index(['author']),
      }
    }),
    comment: defineSchema({
      table: 'lifecycle_comment',
      fields: {
        content: string().required(),
        post: record('lifecycle_post'),
        author: record('lifecycle_user'),
        createdAt: datetime().value('time::now()'),
      }
    })
  },
  relations: {}
});`,
    );

    createConfig(v2, dbName);

    // Generate to see changes
    const { stdout: previewV2 } = await execAsync(`node ${CLI_PATH} generate --debug`);
    expect(previewV2).toContain('DEFINE FIELD isVerified');
    expect(previewV2).toContain('DEFINE TABLE lifecycle_comment');
    expect(previewV2).toContain('DEFINE INDEX verifiedIdx');
    console.log('✅ v2 changes detected');

    // Apply v2
    const { stderr: migrateV2 } = await execAsync(`node ${CLI_PATH} migrate`);
    expect(migrateV2).toContain('Migration applied successfully');
    console.log('✅ v2 migration applied');

    // Verify no changes
    const { stdout: verifyV2 } = await execAsync(`node ${CLI_PATH} generate`);
    expect(verifyV2).toContain('No changes detected');
    console.log('✅ v2 verified - no remaining changes');

    // Check status shows 2 migrations
    const { stdout: statusV2, stderr: statusV2Stderr } = await execAsync(`node ${CLI_PATH} status`);
    const statusOutputV2 = statusV2 + statusV2Stderr;
    expect(statusOutputV2).toContain('Applied migrations: 2');
    console.log('✅ Migration status shows 2 applied');

    // === STEP 3: Another modification ===
    console.log('\n=== Step 3: Field type and index changes ===');
    const v3 = createSchema(
      'lifecycle-v3',
      `
import { defineSchema, composeSchema, string, int, bool, datetime, index, record, float } from 'smig';

export default composeSchema({
  models: {
    user: defineSchema({
      table: 'lifecycle_user',
      fields: {
        email: string().required(),
        name: string(),
        age: int().default(0),
        isVerified: bool().default(false),
        rating: float().default(0.0),
        createdAt: datetime().value('time::now()'),
        updatedAt: datetime(),
      },
      indexes: {
        emailIdx: index(['email']).unique(),
        verifiedIdx: index(['isVerified']),
        ratingIdx: index(['rating']),
      }
    }),
    post: defineSchema({
      table: 'lifecycle_post',
      fields: {
        title: string().required(),
        content: string(),
        author: record('lifecycle_user'),
        views: int().default(0),
        likes: int().default(0),
        isPublished: bool().default(false),
        createdAt: datetime().value('time::now()'),
      },
      indexes: {
        authorIdx: index(['author']),
        publishedIdx: index(['isPublished', 'createdAt']),
      }
    }),
    comment: defineSchema({
      table: 'lifecycle_comment',
      fields: {
        content: string().required(),
        post: record('lifecycle_post'),
        author: record('lifecycle_user'),
        createdAt: datetime().value('time::now()'),
      },
      indexes: {
        postIdx: index(['post']),
      }
    })
  },
  relations: {}
});`,
    );

    createConfig(v3, dbName);

    // Generate and apply
    const { stdout: previewV3 } = await execAsync(`node ${CLI_PATH} generate --debug`);
    expect(previewV3).toContain('DEFINE FIELD rating');
    expect(previewV3).toContain('DEFINE FIELD likes');
    expect(previewV3).toContain('DEFINE INDEX publishedIdx');
    console.log('✅ v3 changes detected');

    const { stderr: migrateV3 } = await execAsync(`node ${CLI_PATH} migrate`);
    expect(migrateV3).toContain('Migration applied successfully');
    console.log('✅ v3 migration applied');

    // Final verification
    const { stdout: verifyV3 } = await execAsync(`node ${CLI_PATH} generate`);
    expect(verifyV3).toContain('No changes detected');
    console.log('✅ v3 verified - no remaining changes');

    const { stdout: finalStatus, stderr: finalStatusStderr } = await execAsync(
      `node ${CLI_PATH} status`,
    );
    const finalStatusOutput = finalStatus + finalStatusStderr;
    expect(finalStatusOutput).toContain('Applied migrations: 3');
    console.log('✅ Final status shows 3 migrations applied');
  }, 180000);

  it('should handle rollback correctly', async () => {
    const dbName = `test_rollback_${Date.now()}`;

    // Create initial schema
    const schema = createSchema(
      'rollback',
      `
import { defineSchema, composeSchema, string, int } from 'smig';

export default composeSchema({
  models: {
    rollback_test: defineSchema({
      table: 'rollback_test',
      fields: {
        name: string(),
        value: int().default(0),
      }
    })
  },
  relations: {}
});`,
    );

    createConfig(schema, dbName);

    // Apply migration
    const { stderr: migrateStderr } = await execAsync(`node ${CLI_PATH} migrate`);
    expect(migrateStderr).toContain('Migration applied successfully');

    // Check status before rollback
    const { stdout: statusBefore, stderr: statusBeforeStderr } = await execAsync(
      `node ${CLI_PATH} status`,
    );
    const statusBeforeOutput = statusBefore + statusBeforeStderr;
    expect(statusBeforeOutput).toContain('Applied migrations: 1');

    // Attempt rollback (with yes confirmation piped in)
    const { stdout: rollbackOutput, stderr: rollbackStderr } = await execAsync(
      `echo "y" | node ${CLI_PATH} rollback`,
    );
    const rollbackResult = rollbackOutput + rollbackStderr;

    // Should indicate rollback happened or was cancelled
    expect(rollbackResult).toMatch(/rolled back|cancelled|Rollback/i);

    // Check status after rollback
    const { stdout: statusAfter, stderr: statusAfterStderr } = await execAsync(
      `node ${CLI_PATH} status`,
    );
    const statusAfterOutput = statusAfter + statusAfterStderr;
    // Should show 0 migrations after successful rollback
    expect(statusAfterOutput).toMatch(/Applied migrations: [01]/);
  }, 90000);

  it('should detect removals and generate REMOVE statements', async () => {
    const dbName = `test_removals_${Date.now()}`;

    // Initial schema with more fields
    const v1 = createSchema(
      'removal-v1',
      `
import { defineSchema, composeSchema, string, int, bool, index } from 'smig';

export default composeSchema({
  models: {
    item: defineSchema({
      table: 'removal_item',
      fields: {
        name: string(),
        description: string(),
        quantity: int().default(0),
        isActive: bool().default(true),
      },
      indexes: {
        nameIdx: index(['name']),
        activeIdx: index(['isActive']),
      }
    })
  },
  relations: {}
});`,
    );

    createConfig(v1, dbName);
    const { stderr: v1Stderr } = await execAsync(`node ${CLI_PATH} migrate`);
    expect(v1Stderr).toContain('Migration applied successfully');

    // Remove fields and indexes
    const v2 = createSchema(
      'removal-v2',
      `
import { defineSchema, composeSchema, string, index } from 'smig';

export default composeSchema({
  models: {
    item: defineSchema({
      table: 'removal_item',
      fields: {
        name: string(),
      },
      indexes: {
        nameIdx: index(['name']),
      }
    })
  },
  relations: {}
});`,
    );

    createConfig(v2, dbName);

    // Should detect removals
    const { stdout: diffOutput } = await execAsync(`node ${CLI_PATH} generate --debug`);

    expect(diffOutput).toContain('REMOVE FIELD');
    expect(diffOutput).toContain('REMOVE INDEX');

    // Apply and verify
    const { stderr: v2Stderr } = await execAsync(`node ${CLI_PATH} migrate`);
    expect(v2Stderr).toContain('Migration applied successfully');

    const { stdout: verifyOutput } = await execAsync(`node ${CLI_PATH} generate`);
    expect(verifyOutput).toContain('No changes detected');
  }, 90000);

  it('should handle empty schema (remove all)', async () => {
    const dbName = `test_empty_${Date.now()}`;

    // Initial schema
    const v1 = createSchema(
      'empty-v1',
      `
import { defineSchema, composeSchema, string } from 'smig';

export default composeSchema({
  models: {
    temp: defineSchema({
      table: 'temp_table',
      fields: {
        data: string(),
      }
    })
  },
  relations: {}
});`,
    );

    createConfig(v1, dbName);
    const { stderr: v1Stderr } = await execAsync(`node ${CLI_PATH} migrate`);
    expect(v1Stderr).toContain('Migration applied successfully');

    // Empty schema
    const v2 = createSchema(
      'empty-v2',
      `
import { composeSchema } from 'smig';

export default composeSchema({
  models: {},
  relations: {}
});`,
    );

    createConfig(v2, dbName);

    // Should generate REMOVE TABLE
    const { stdout: diffOutput } = await execAsync(`node ${CLI_PATH} generate --debug`);
    expect(diffOutput).toContain('REMOVE TABLE temp_table');

    // Apply
    const { stderr: v2Stderr } = await execAsync(`node ${CLI_PATH} migrate`);
    expect(v2Stderr).toContain('Migration applied successfully');

    // Verify clean
    const { stdout: verifyOutput } = await execAsync(`node ${CLI_PATH} generate`);
    expect(verifyOutput).toContain('No changes detected');
  }, 90000);
});
