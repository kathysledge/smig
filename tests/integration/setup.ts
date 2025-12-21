// Integration test setup for smig

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from 'dotenv';
import { afterAll, beforeAll } from 'vitest';

const execAsync = promisify(exec);

// Load integration test environment variables
config({ path: '.env.integration', quiet: true });

// biome-ignore lint/suspicious/noExplicitAny: Process handles need flexible typing
let surrealDbProcess: any;
// biome-ignore lint/suspicious/noExplicitAny: Process handles need flexible typing
let db1ProcessGlobal: any = null;
// biome-ignore lint/suspicious/noExplicitAny: Process handles need flexible typing
let db2ProcessGlobal: any = null;

/**
 * Wait for a port to become available
 */
async function waitForPort(port: number, maxAttempts = 20): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      // Try to connect using curl or nc
      await execAsync(`curl -s --max-time 1 http://localhost:${port}/health 2>/dev/null || nc -z localhost ${port} 2>/dev/null`);
      return true;
    } catch {
      // Wait 100ms before retry
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  return false;
}

/**
 * Start SurrealDB instances for integration testing
 */
async function startSurrealDB() {
  console.log('🚀 Starting SurrealDB instances for integration tests...');

  try {
    await execAsync('surreal version');
    console.log('✅ SurrealDB CLI found');
  } catch (_error) {
    console.warn('⚠️  SurrealDB CLI not found. Please install SurrealDB.');
    throw new Error('SurrealDB CLI not available');
  }

  // Clean up any leftover test processes
  console.log('🧹 Cleaning up any leftover test processes...');
  try {
    await execAsync('pkill -f "surreal.*800[12]" 2>/dev/null || true');
    await new Promise((r) => setTimeout(r, 200)); // Brief wait for cleanup
  } catch (_error) {
    // pkill failures are expected if no processes are found
  }

  // Start first test database (port 8001)
  console.log('Starting SurrealDB test instance 1 on port 8001...');
  db1ProcessGlobal = exec(
    'surreal start --log warn --user root --pass root memory --bind 0.0.0.0:8001',
  );

  // Start second test database (port 8002)
  console.log('Starting SurrealDB test instance 2 on port 8002...');
  db2ProcessGlobal = exec(
    'surreal start --log warn --user root --pass root memory --bind 0.0.0.0:8002',
  );

  // Wait for databases to be ready
  console.log('Waiting for databases to be ready...');
  const ready1 = await waitForPort(8001);
  const ready2 = await waitForPort(8002);

  if (!ready1 || !ready2) {
    console.warn('⚠️  Databases may not be fully ready, continuing anyway...');
  }

  console.log('✅ Integration test databases are ready');
  return { db1Process: db1ProcessGlobal, db2Process: db2ProcessGlobal };
}

/**
 * Stop SurrealDB instances
 */
async function stopSurrealDB() {
  console.log('🛑 Stopping SurrealDB test instances...');

  // Kill processes directly
  if (db1ProcessGlobal?.pid) {
    try {
      db1ProcessGlobal.kill('SIGKILL');
    } catch (_error) {
      // Ignore
    }
  }

  if (db2ProcessGlobal?.pid) {
    try {
      db2ProcessGlobal.kill('SIGKILL');
    } catch (_error) {
      // Ignore
    }
  }

  // Fallback: use pkill
  try {
    await execAsync('pkill -f "surreal.*800[12]" 2>/dev/null || true');
  } catch (_error) {
    // Ignore
  }

  db1ProcessGlobal = null;
  db2ProcessGlobal = null;

  console.log('✅ SurrealDB test instances stopped');
}

// Global setup and teardown for integration tests
beforeAll(async () => {
  console.log('🧪 Setting up integration test environment...');

  if (process.env.CI !== 'true') {
    try {
      surrealDbProcess = await startSurrealDB();
    } catch (error) {
      console.error('Failed to start test databases:', error);
      process.exit(1);
    }
  } else {
    console.log('CI environment detected - assuming external databases are provided');
  }
}, 30000);

afterAll(async () => {
  console.log('🧹 Cleaning up integration test environment...');

  if (surrealDbProcess && process.env.CI !== 'true') {
    await stopSurrealDB();
  }
}, 10000);

// Export test database configurations
export const TEST_DATABASES = {
  db1: {
    url: 'ws://localhost:8001',
    username: 'root',
    password: 'root',
    namespace: 'test',
    database: 'test1',
  },
  db2: {
    url: 'ws://localhost:8002',
    username: 'root',
    password: 'root',
    namespace: 'test',
    database: 'test2',
  },
};

// Helper function to create test schema files
export function createTestSchema(content: string, filename = 'test-schema.ts'): string {
  const fs = require('node:fs');
  const path = require('node:path');

  const schemaPath = path.join(process.cwd(), 'tests', 'integration', 'fixtures', filename);

  const fixturesDir = path.dirname(schemaPath);
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }

  fs.writeFileSync(schemaPath, content);
  return `./tests/integration/fixtures/${filename}`;
}

// Helper function to clean up test files
export function cleanupTestFiles(patterns: string[]) {
  const fs = require('node:fs');
  const path = require('node:path');
  const glob = require('glob');

  patterns.forEach((pattern) => {
    const files = glob.sync(pattern, { cwd: process.cwd() });
    files.forEach((file: string) => {
      const fullPath = path.join(process.cwd(), file);
      try {
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      } catch (_error) {
        // Ignore errors
      }
    });
  });
}
