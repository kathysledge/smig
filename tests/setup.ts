// Test setup file for Vitest
import { config } from 'dotenv';
import { vi } from 'vitest';

// Load environment variables for tests
config({ path: '.env.test', quiet: true });

// Mock console methods to reduce noise in tests
vi.stubGlobal('console', {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
});

// Mock external dependencies for unit tests
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
  readFile: vi.fn(),
  appendFile: vi.fn(),
}));
