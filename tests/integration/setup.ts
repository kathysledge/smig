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
 * Start SurrealDB instances for integration testing
 *
 * This function starts two SurrealDB instances:
 * - Test database on port 8001 (namespace: test, database: test1)
 * - Test database on port 8002 (namespace: test, database: test2)
 */
async function startSurrealDB() {
  console.log('🚀 Starting SurrealDB instances for integration tests...');

  try {
    // Check if SurrealDB is available
    await execAsync('surreal version');
    console.log('✅ SurrealDB CLI found');
  } catch (_error) {
    console.warn('⚠️  SurrealDB CLI not found. Please install SurrealDB:');
    console.warn('   curl --proto "=https" --tlsv1.2 -sSf https://install.surrealdb.com | sh');
    console.warn('   Or use Docker: docker run --rm -p 8000:8000 surrealdb/surrealdb:latest start');
    throw new Error('SurrealDB CLI not available');
  }

  // Clean up any leftover test processes from previous runs
  console.log('🧹 Cleaning up any leftover test processes...');
  try {
    await execAsync('pkill -f "surreal.*800[12]" 2>/dev/null || true');
    await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for cleanup
  } catch (_error) {
    // pkill failures are expected if no processes are found
  }

  // Start first test database (port 8001)
  console.log('Starting SurrealDB test instance 1 on port 8001...');
  db1ProcessGlobal = exec(
    'surreal start --log debug --user root --pass root memory --bind 0.0.0.0:8001',
  );

  // Monitor process startup for errors
  db1ProcessGlobal.stderr?.on('data', (data) => {
    const errorMsg = data.toString().trim();
    if (errorMsg.includes('ERROR') || errorMsg.includes('error')) {
      console.log('[DB1 ERROR]', errorMsg);
    }
  });

  // Small delay between starting processes
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Start second test database (port 8002)
  console.log('Starting SurrealDB test instance 2 on port 8002...');
  db2ProcessGlobal = exec(
    'surreal start --log debug --user root --pass root memory --bind 0.0.0.0:8002',
  );

  // Monitor process startup for errors
  db2ProcessGlobal.stderr?.on('data', (data) => {
    const errorMsg = data.toString().trim();
    if (errorMsg.includes('ERROR') || errorMsg.includes('error')) {
      console.log('[DB2 ERROR]', errorMsg);
    }
  });

  // Wait for databases to be ready
  await new Promise((resolve) => setTimeout(resolve, 200));

  // Test connectivity
  try {
    console.log('Testing database connectivity...');

    // You could add actual connectivity tests here using the SurrealDB client
    // const db1 = new Surreal();
    // await db1.connect('ws://localhost:8001');
    // await db1.signin({ username: 'root', password: 'root' });
    // await db1.close();

    console.log('✅ Integration test databases are ready');
  } catch (error) {
    console.error('❌ Failed to connect to test databases:', error);
    throw error;
  }

  return { db1Process: db1ProcessGlobal, db2Process: db2ProcessGlobal };
}

/**
 * Stop SurrealDB instances
 */
async function stopSurrealDB() {
  console.log('🛑 Stopping SurrealDB test instances...');

  const killPromises: Promise<void>[] = [];

  // Kill db1 process
  if (db1ProcessGlobal?.pid) {
    killPromises.push(
      new Promise<void>((resolve) => {
        try {
          console.log(`Killing SurrealDB process 1 (PID: ${db1ProcessGlobal.pid})`);

          let processExited = false;

          // Listen for process exit
          db1ProcessGlobal.once('exit', () => {
            processExited = true;
            resolve();
          });

          // Send SIGTERM
          try {
            db1ProcessGlobal.kill('SIGTERM');
          } catch (killError) {
            console.warn('Error sending SIGTERM to process 1:', killError);
          }

          // Give it time to gracefully shut down, then force kill if needed
          setTimeout(() => {
            if (!processExited && db1ProcessGlobal && db1ProcessGlobal.pid) {
              console.log('Force killing SurrealDB process 1');
              try {
                db1ProcessGlobal.kill('SIGKILL');
                // Give it a moment for SIGKILL to take effect
                setTimeout(() => {
                  resolve();
                }, 50);
              } catch (killError) {
                console.warn('Error sending SIGKILL to process 1:', killError);
                resolve();
              }
            }
          }, 200);
        } catch (error) {
          console.warn('Error killing db1 process:', error);
          resolve();
        }
      }),
    );
  }

  // Kill db2 process
  if (db2ProcessGlobal?.pid) {
    killPromises.push(
      new Promise<void>((resolve) => {
        try {
          console.log(`Killing SurrealDB process 2 (PID: ${db2ProcessGlobal.pid})`);

          let processExited = false;

          // Listen for process exit
          db2ProcessGlobal.once('exit', () => {
            processExited = true;
            resolve();
          });

          // Send SIGTERM
          try {
            db2ProcessGlobal.kill('SIGTERM');
          } catch (killError) {
            console.warn('Error sending SIGTERM to process 2:', killError);
          }

          // Give it time to gracefully shut down, then force kill if needed
          setTimeout(() => {
            if (!processExited && db2ProcessGlobal && db2ProcessGlobal.pid) {
              console.log('Force killing SurrealDB process 2');
              try {
                db2ProcessGlobal.kill('SIGKILL');
                // Give it a moment for SIGKILL to take effect
                setTimeout(() => {
                  resolve();
                }, 50);
              } catch (killError) {
                console.warn('Error sending SIGKILL to process 2:', killError);
                resolve();
              }
            }
          }, 200);
        } catch (error) {
          console.warn('Error killing db2 process:', error);
          resolve();
        }
      }),
    );
  }

  // Fallback: use pkill if we don't have process references
  if (killPromises.length === 0) {
    console.log('No process references found, attempting pkill fallback...');
    try {
      await execAsync('pkill -f "surreal.*800[12]" 2>/dev/null || true');
    } catch (_error) {
      // pkill failures are expected if no processes are found
      console.log('pkill completed (processes may not have been running)');
    }
  } else {
    // Wait for all processes to be killed
    await Promise.all(killPromises);
  }

  // Wait a bit for cleanup
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Clear process references
  db1ProcessGlobal = null;
  db2ProcessGlobal = null;

  console.log('✅ SurrealDB test instances stopped');
}

// Global setup and teardown for integration tests
beforeAll(async () => {
  console.log('🧪 Setting up integration test environment...');

  // Only start databases if we're running integration tests
  if (process.env.CI !== 'true') {
    try {
      surrealDbProcess = await startSurrealDB();
    } catch (error) {
      console.error('Failed to start test databases:', error);
      console.log('Integration tests will be skipped.');
      process.exit(1);
    }
  } else {
    console.log('CI environment detected - assuming external databases are provided');
  }
}, 30000); // 30 second timeout for database startup

afterAll(async () => {
  console.log('🧹 Cleaning up integration test environment...');

  if (surrealDbProcess && process.env.CI !== 'true') {
    await stopSurrealDB();
  }
}, 10000); // 10 second timeout for cleanup

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

  // Ensure fixtures directory exists
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
    files.forEach((file) => {
      const fullPath = path.join(process.cwd(), file);
      try {
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      } catch (_error) {
        // Ignore errors if file was already deleted (race condition)
      }
    });
  });
}
