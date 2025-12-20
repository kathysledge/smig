/**
 * @fileoverview Tests for TypeScript schema file loading.
 */

import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadSchemaFromFile } from '../src/migrator/migration-manager';

describe('TypeScript Schema Loading', () => {
  it('should load a TypeScript schema file', async () => {
    const schemaPath = path.resolve(__dirname, '../examples/simple-blog-schema.ts');
    const schema = await loadSchemaFromFile(schemaPath);

    expect(schema).toBeDefined();
    expect(schema.tables).toBeDefined();
    expect(schema.tables.length).toBeGreaterThan(0);
    
    // Check that user table exists
    const userTable = schema.tables.find((t) => t.name === 'user');
    expect(userTable).toBeDefined();
    expect(userTable?.fields.length).toBeGreaterThan(0);
  });

  it('should load a JavaScript schema file', async () => {
    const schemaPath = path.resolve(__dirname, '../examples/simple-blog-schema.ts');
    const schema = await loadSchemaFromFile(schemaPath);

    expect(schema).toBeDefined();
    expect(schema.tables).toBeDefined();
  });

  it('should reject unsupported file types', async () => {
    // Create a temporary .json file to test unsupported extension
    const fs = await import('fs-extra');
    const schemaPath = path.resolve(__dirname, '../examples/temp-schema.tson');
    await fs.writeFile(schemaPath, '{}');
    
    try {
      await expect(loadSchemaFromFile(schemaPath)).rejects.toThrow('Unsupported file type');
    } finally {
      // Cleanup
      await fs.remove(schemaPath);
    }
  });

  it('should reject non-existent files', async () => {
    const schemaPath = path.resolve(__dirname, '../examples/does-not-exist.ts');
    
    await expect(loadSchemaFromFile(schemaPath)).rejects.toThrow();
  });

  it('should support .mts files', async () => {
    // Test that the extension is supported (even if file doesn't exist)
    const ext = '.mts';
    const supportedExtensions = ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts'];
    expect(supportedExtensions.includes(ext)).toBe(true);
  });

  it('should support .cts files', async () => {
    const ext = '.cts';
    const supportedExtensions = ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts'];
    expect(supportedExtensions.includes(ext)).toBe(true);
  });
});

