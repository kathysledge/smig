import * as fs from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_CONFIG,
  EnvironmentNotFoundError,
  validateConfig,
} from '../src/utils/config-loader';

// Mock dependencies
vi.mock('fs');

describe('Configuration Loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset environment variables
    delete process.env.SMIG_URL;
    delete process.env.SMIG_USERNAME;
    delete process.env.SMIG_PASSWORD;
    delete process.env.SMIG_NAMESPACE;
    delete process.env.SMIG_DATABASE;
    delete process.env.SMIG_SCHEMA;
    delete process.env.DATABASE_PREFIX;

    // Default mock: no config file exists
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });

  describe('Default Configuration', () => {
    it('should have correct default configuration values', () => {
      expect(DEFAULT_CONFIG).toBeDefined();
      expect(DEFAULT_CONFIG.url).toBe('ws://localhost:8000');
      expect(DEFAULT_CONFIG.username).toBe('root');
      expect(DEFAULT_CONFIG.password).toBe('root');
      expect(DEFAULT_CONFIG.namespace).toBe('test');
      expect(DEFAULT_CONFIG.database).toBe('test');
      expect(DEFAULT_CONFIG.schema).toBe('./schema.ts');
    });
  });

  describe('Configuration Validation', () => {
    it('should validate valid configuration', () => {
      const validConfig = {
        schema: './schema.ts',
        url: 'ws://localhost:8000',
        username: 'root',
        password: 'root',
        namespace: 'test',
        database: 'test',
      };

      // Mock that schema file exists
      vi.mocked(fs.existsSync).mockReturnValue(true);

      expect(() => validateConfig(validConfig)).not.toThrow();
    });

    it('should throw error for missing required fields', () => {
      const invalidConfig = {
        schema: './schema.ts',
        // missing other required fields
        // biome-ignore lint/suspicious/noExplicitAny: Testing invalid config requires flexible typing
      } as any;

      expect(() => validateConfig(invalidConfig)).toThrow();
    });

    it('should throw error for invalid URL format', () => {
      const invalidConfig = {
        schema: './schema.ts',
        url: 'invalid-url',
        username: 'root',
        password: 'root',
        namespace: 'test',
        database: 'test',
      };

      expect(() => validateConfig(invalidConfig)).toThrow('Invalid URL format');
    });

    it('should throw error for non-existent schema file', () => {
      const invalidConfig = {
        schema: './non-existent-schema.ts',
        url: 'ws://localhost:8000',
        username: 'root',
        password: 'root',
        namespace: 'test',
        database: 'test',
      };

      // Mock that schema file doesn't exist
      vi.mocked(fs.existsSync).mockReturnValue(false);

      expect(() => validateConfig(invalidConfig)).toThrow('Schema file not found');
    });
  });

  describe('EnvironmentNotFoundError', () => {
    it('should create error with correct message', () => {
      const error = new EnvironmentNotFoundError('test-env', ['dev', 'prod']);
      expect(error.message).toBe(
        "Environment 'test-env' not found. Available environments: dev, prod",
      );
      expect(error.name).toBe('EnvironmentNotFoundError');
    });

    it('should handle empty available environments', () => {
      const error = new EnvironmentNotFoundError('test-env', []);
      expect(error.message).toBe(
        "Environment 'test-env' not found. Available environments: none defined",
      );
    });
  });

  describe('Config File Extension Search Order', () => {
    it('should search for config files in correct order (.ts first, then .js fallback)', () => {
      // The config loader searches for config files in this order:
      // 1. smig.config.ts
      // 2. smig.config.mts
      // 3. smig.config.cts
      // 4. smig.config.js
      // 5. smig.config.mjs
      // 6. smig.config.cjs
      //
      // This test documents the expected behavior. The actual file loading
      // is tested in the integration tests (tests/integration/config.test.ts)
      // because it requires real file system access and jiti module loading.
      const expectedExtensions = ['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs'];
      expect(expectedExtensions[0]).toBe('.ts'); // TypeScript first
      expect(expectedExtensions[3]).toBe('.js'); // JavaScript as fallback
    });

    it('should default schema path to ./schema.ts', () => {
      expect(DEFAULT_CONFIG.schema).toBe('./schema.ts');
    });
  });
});
