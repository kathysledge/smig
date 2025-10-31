import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readdir } from 'fs/promises';
import { existsSync } from 'fs';

// Function to recursively find all TypeScript files in src directory
async function findTsFiles(dir: string, prefix = ''): Promise<Record<string, string>> {
  const entries: Record<string, string> = {};
  
  if (!existsSync(dir)) return entries;
  
  const items = await readdir(dir, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = resolve(dir, item.name);
    const key = prefix ? `${prefix}/${item.name}` : item.name;
    
    if (item.isDirectory()) {
      const subEntries = await findTsFiles(fullPath, key);
      Object.assign(entries, subEntries);
    } else if (item.name.endsWith('.ts') && !item.name.endsWith('.d.ts')) {
      // Exclude .d.ts files as they are type definitions only, not runtime code
      const entryName = key.replace('.ts', '');
      entries[entryName] = fullPath;
    }
  }
  
  return entries;
}

export default defineConfig(async () => {
  // Find all TypeScript entry points
  const entryPoints = await findTsFiles('src');
  
  return {
    build: {
      lib: {
        entry: entryPoints,
        formats: ['es'],
        fileName: (format, entryName) => `${entryName}.js`,
      },
      outDir: 'dist',
      sourcemap: true,
      minify: false,
      target: 'node18',
      ssr: true, // Enable server-side rendering mode (Node.js)
      rollupOptions: {
        external: [
          // External dependencies (don't bundle these)
          'chalk', 'commander', 'date-fns', 'dedent', 'dotenv', 
          'fs-extra', 'glob', 'ora', 'prompts', 'surrealdb', 'zod',
        ],
        output: {
          preserveModules: true,
          preserveModulesRoot: 'src',
          entryFileNames: '[name].js',
          chunkFileNames: '[name].js',
          assetFileNames: '[name].[ext]',
        },
      },
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    esbuild: {
      keepNames: true,
      platform: 'node', // Explicitly target Node.js platform
    },
    define: {
      // Ensure we're in Node.js environment
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
    },
  };
});
