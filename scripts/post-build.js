#!/usr/bin/env node

import { readFile, writeFile, chmod } from 'fs/promises';
import { existsSync } from 'fs';

/**
 * Post-build script to:
 * 1. Add shebang to CLI file
 * 2. Make CLI file executable
 */
async function postBuild() {
  try {
    const cliPath = './dist/cli.js';
    
    if (!existsSync(cliPath)) {
      console.error('CLI file not found at dist/cli.js');
      process.exit(1);
    }

    // Read the CLI file
    let content = await readFile(cliPath, 'utf8');
    
    // Add shebang if not present
    if (!content.startsWith('#!')) {
      content = '#!/usr/bin/env node\n' + content;
      await writeFile(cliPath, content, 'utf8');
      console.log('Added shebang to CLI file');
    }

    // Make executable
    await chmod(cliPath, 0o755);
    console.log('Made CLI file executable');

    console.log('Post-build completed successfully!');
  } catch (error) {
    console.error('Post-build failed:', error);
    process.exit(1);
  }
}

postBuild();
