#!/usr/bin/env node

/**
 * @fileoverview Command-line interface for the SurrealDB Migration Tool (smig).
 *
 * This CLI provides comprehensive database schema management capabilities for SurrealDB,
 * including migration application, status checking, rollback functionality, and diff generation.
 * The tool supports both interactive and non-interactive usage patterns, making it suitable
 * for both development workflows and automated deployment pipelines.
 *
 * ## Available Commands
 *
 * - `migrate` - Apply schema changes to the database
 * - `status` - Show current migration status and pending changes
 * - `rollback` - Rollback the last migration or a specific migration
 * - `generate` - Generate SurrealQL diff from schema file
 * - `init` - Initialize a new schema file with example structure
 * - `test` - Test database connection and verify configuration
 *
 * ## Global Options
 *
 * All commands support the following global options:
 * - `--url` - SurrealDB server URL (default: ws://localhost:8000)
 * - `--namespace` - SurrealDB namespace (default: test)
 * - `--database` - SurrealDB database (default: test)
 * - `--username` - SurrealDB username (default: root)
 * - `--password` - SurrealDB password (default: root)
 * - `--schema` - Path to TypeScript schema file (default: ./schema.ts)
 *
 * ## Configuration
 *
 * Configuration is loaded with the following precedence (highest to lowest):
 * 1. Command line arguments
 * 2. smig.config.ts file (or .js fallback)
 * 3. Environment variables (.env file)
 * 4. Built-in defaults
 *
 * ### Environment Variables (.env)
 * - `SMIG_URL` - Database server URL
 * - `SMIG_NAMESPACE` - Database namespace
 * - `SMIG_DATABASE` - Database name
 * - `SMIG_USERNAME` - Authentication username
 * - `SMIG_PASSWORD` - Authentication password
 * - `SMIG_SCHEMA` - Path to schema file
 *
 * ### Configuration File (smig.config.ts)
 * ```typescript
 * export default {
 *   schema: "./schema.ts",
 *   url: process.env.SMIG_URL || "ws://localhost:8000",  // .env variables available
 *   username: "root",
 *   password: "root",
 *   namespace: "test",
 *   database: "test",
 *   environments: {
 *     dev: {
 *       url: "ws://localhost:8000",
 *       namespace: "dev",
 *       database: "citadel_dev"
 *     },
 *     prod: {
 *       url: process.env.PROD_DB_URL,  // Can reference .env and system vars
 *       namespace: "production",
 *       database: "citadel"
 *     }
 *   }
 * };
 * ```
 *
 * @example
 * ```zsh
 * # Apply migrations using default config
 * bun smig migrate
 *
 * # Apply migrations to production environment
 * bun smig migrate --env prod
 *
 * # Override specific settings
 * bun smig migrate --env prod --database citadel_v2
 *
 * # Check current configuration
 * bun smig config
 *
 * # Check status
 * bun smig status --env dev
 *
 * # Generate diff without applying
 * bun smig generate --output migration.sql
 *
 * # Initialize new schema
 * bun smig init --output my-schema.ts
 * ```
 */

import { writeFile } from 'node:fs/promises';
// import * as dotenv from "dotenv";
import * as path from 'node:path';
import * as clack from '@clack/prompts';
import chalk from 'chalk';
import { Command } from 'commander';
import ora from 'ora';
import { loadSchemaFromFile, MigrationManager } from './migrator/migration-manager';
import type { DatabaseConfig } from './types/schema';
import { type ConfigOptions, loadConfig, validateConfig } from './utils/config-loader.js';
import { DebugLogger, debugLog, setDebugLogger } from './utils/debug-logger';

// Note: .env loading is now handled by the config loader to avoid duplicates

/**
 * Global CLI options interface matching Commander's option definitions
 */
interface GlobalOptions {
  url?: string;
  namespace?: string;
  database?: string;
  username?: string;
  password?: string;
  schema?: string;
  env?: string;
}

/**
 * Loads and validates database configuration from CLI options, config file, and environment variables.
 *
 * This helper function merges configuration from multiple sources according to the precedence order:
 * 1. CLI arguments (highest priority)
 * 2. smig.config.js file
 * 3. Environment variables (.env file)
 * 4. Default values (lowest priority)
 *
 * @param globalOpts - Global CLI options from commander (url, namespace, database, etc.)
 * @param commandOpts - Command-specific options (currently unused but reserved for future use)
 * @returns Resolved and validated database configuration with optional environment list
 * @throws {Error} If configuration validation fails (missing required fields, invalid values)
 *
 * @example
 * ```typescript
 * const config = await getConfigFromOptions(program.opts());
 * // config.url, config.namespace, config.database, etc. are all validated and ready to use
 * ```
 */
async function getConfigFromOptions(
  globalOpts: GlobalOptions,
): Promise<DatabaseConfig & { availableEnvironments?: string[] }> {
  const configOptions: ConfigOptions = {
    url: globalOpts.url,
    namespace: globalOpts.namespace,
    database: globalOpts.database,
    username: globalOpts.username,
    password: globalOpts.password,
    schema: globalOpts.schema,
    env: globalOpts.env,
  };

  const config = await loadConfig(configOptions);

  try {
    validateConfig(config);
  } catch (error) {
    console.error(
      chalk.red(`Configuration error: ${error instanceof Error ? error.message : error}`),
    );
    process.exit(1);
  }

  return {
    url: config.url,
    namespace: config.namespace,
    database: config.database,
    username: config.username,
    password: config.password,
    schema: config.schema,
    availableEnvironments: config.availableEnvironments,
  };
}

const program = new Command();

program
  .name('smig')
  .description(
    'Automatic SurrealDB 3.x migrations with a type-safe schema DSL.\n\n' +
      'Features: Vector indexes (HNSW/MTREE), ALTER/RENAME support, ACCESS/JWT auth,\n' +
      'bidirectional migrations, rename tracking via .was(), and more.',
  )
  .version('1.0.0-beta.2')
  .configureHelp({
    showGlobalOptions: true,
  });

// Global options
program
  .option('-u, --url <url>', 'SurrealDB server URL (overrides config and env)')
  .option('-n, --namespace <namespace>', 'SurrealDB namespace (overrides config and env)')
  .option('-d, --database <database>', 'SurrealDB database (overrides config and env)')
  .option('-U, --username <username>', 'SurrealDB username (overrides config and env)')
  .option('-p, --password <password>', 'SurrealDB password (overrides config and env)')
  .option('-s, --schema <path>', 'Path to schema file (overrides config and env)')
  .option('--env <environment>', 'Environment name from smig.config.ts');

// Migrate command
program
  .command('migrate')
  .description('Apply schema changes to the database')
  .option('--debug', 'Enable debug logging to file')
  .option('--dry-run', 'Show what would be changed without applying')
  .action(async (options) => {
    const globalOpts = program.opts();

    // Initialize debug logger if debug flag is set
    if (options.debug) {
      const debugLogger = new DebugLogger(true);
      setDebugLogger(debugLogger);
    }

    const spinner = ora('Initializing migration...').start();
    let migrationManager: MigrationManager | undefined;

    try {
      // Load configuration using the new system
      spinner.text = 'Loading configuration...';
      const config = await getConfigFromOptions(globalOpts);

      // Load schema from file
      spinner.text = 'Loading schema file...';
      const schemaPath = path.resolve(config.schema);
      const schema = await loadSchemaFromFile(schemaPath);

      // Initialize migration manager
      spinner.text = 'Connecting to database...';
      migrationManager = new MigrationManager(config);
      spinner.text = 'Initializing...';
      await migrationManager.initialize();
      spinner.text = 'Done initializing...';

      // Check if dry-run mode
      if (options.dryRun) {
        spinner.text = 'Generating migration diff (dry run)...';
        const hasChanges = await migrationManager.hasChanges(schema);

        if (hasChanges) {
          const { up, down } = await migrationManager.generateDiff(schema);
          spinner.succeed(chalk.blue('Dry run - changes detected (not applied)'));

          console.log(`\n${chalk.cyan('Would apply (up):')}`);
          console.log('─'.repeat(50));
          console.log(up);

          console.log(`\n${chalk.cyan('Would rollback (down):')}`);
          console.log('─'.repeat(50));
          console.log(down);
        } else {
          spinner.succeed(chalk.green('Dry run - no changes detected'));
        }
      } else {
        // Apply migration
        spinner.text = 'Applying migration...';
        await migrationManager.migrate(schema);

        spinner.succeed(chalk.green(`Migration applied successfully`));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Handle "no changes" as a success case, not an error
      if (errorMessage.includes('No changes detected')) {
        spinner.succeed(chalk.green('Database schema is up to date'));
        console.log(chalk.yellow('No changes detected - no migration needed.'));
      } else {
        spinner.fail(chalk.red(`Migration failed: ${errorMessage}`));
        process.exit(1);
      }
    } finally {
      // Always close the connection to prevent hanging
      if (migrationManager) {
        await migrationManager.close();
      }
      // Force exit to prevent SDK timer keeping event loop alive
      process.exit(0);
    }
  });

// Status command
program
  .command('status')
  .description('Show migration status')
  .action(async () => {
    const globalOpts = program.opts();
    const spinner = ora('Loading configuration...').start();

    try {
      // Load configuration using the new system
      const config = await getConfigFromOptions(globalOpts);

      spinner.text = 'Checking migration status...';

      const migrationManager = new MigrationManager(config);
      await migrationManager.initialize();

      const status = await migrationManager.status();

      spinner.succeed(chalk.green('Migration status retrieved'));

      console.log('\n📊 Migration Status:');
      console.log(`Applied migrations: ${status.length}`);

      if (status.length > 0) {
        console.log('\nApplied migrations:');
        for (const item of status) {
          if (item.migration) {
            console.log(`  - ${item.migration.id} (${item.migration.appliedAt.toISOString()})`);
          }
        }
      } else {
        console.log('\nNo migrations applied yet.');
      }

      // Check for pending changes
      try {
        const schemaPath = path.resolve(config.schema);
        const schema = await loadSchemaFromFile(schemaPath);
        const hasChanges = await migrationManager.hasChanges(schema);

        if (hasChanges) {
          console.log('\n🔄 Pending changes detected:');
          console.log('Run "bun smig migrate" to apply changes');
        } else {
          console.log('\n✅ Database is up to date with schema');
        }
      } catch (_error) {
        console.log('\n⚠️  Could not check for pending changes (smig)');
      }

      await migrationManager.close();
      process.exit(0);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      spinner.fail(chalk.red(`Failed to get status: ${errorMessage}`));
      process.exit(1);
    }
  });

// Rollback command
program
  .command('rollback')
  .description('Rollback migrations from the database')
  .option(
    '-i, --id <id>',
    "Migration ID to rollback (defaults to last migration). Can be just the ID part, '_migrations:' prefix will be added automatically if missing.",
  )
  .option(
    '-t, --to <id>',
    "Rollback all migrations after and including this migration ID. Can be just the ID part, '_migrations:' prefix will be added automatically if missing.",
  )
  .option('--debug', 'Enable debug logging to file')
  .action(async (options) => {
    const globalOpts = program.opts();

    // Initialize debug logger if debug flag is set
    if (options.debug) {
      const debugLogger = new DebugLogger(true);
      setDebugLogger(debugLogger);
    }

    const spinner = ora('Loading configuration...').start();

    let migrationManager: MigrationManager | null = null;
    try {
      // Load configuration using the new system
      const config = await getConfigFromOptions(globalOpts);

      spinner.text = 'Rolling back migration...';

      migrationManager = new MigrationManager(config);
      await migrationManager.initialize();

      const status = await migrationManager.status();

      if (status.length === 0) {
        spinner.fail(chalk.red('No migrations to rollback'));
        return;
      }

      // Helper function to normalize migration ID
      const normalizeMigrationId = (id: string): string => {
        if (!id) return id;
        // Add _migrations: prefix if not already present
        return id.startsWith('_migrations:') ? id : `_migrations:${id}`;
      };

      // Determine rollback strategy
      if (options.to && options.id) {
        spinner.fail(chalk.red('Cannot specify both --id and --to options'));
        return;
      }

      let migrationsToRollback: string[] = [];
      let rollbackType = '';

      if (options.to) {
        // Normalize the target migration ID
        const normalizedTo = normalizeMigrationId(options.to);

        // Rollback all migrations from latest back to and including the specified migration
        const targetIndex = status.findIndex((s) => s.migration?.id === normalizedTo);
        if (targetIndex === -1) {
          spinner.fail(chalk.red(`Migration "${normalizedTo}" not found`));
          return;
        }

        // Get all migrations from the end back to the target (inclusive)
        migrationsToRollback = status
          .slice(targetIndex)
          .reverse()
          .map((s) => s.migration?.id)
          .filter((id): id is string => typeof id === 'string');
        rollbackType = `rollback to migration "${normalizedTo}" (${migrationsToRollback.length} migrations)`;
      } else {
        // Single migration rollback
        let migrationId = options.id;
        if (!migrationId) {
          const lastMigration = status[status.length - 1];
          if (lastMigration.migration) {
            migrationId = lastMigration.migration.id;
          }
        } else {
          // Normalize the provided migration ID
          migrationId = normalizeMigrationId(migrationId);
        }

        if (!migrationId) {
          spinner.fail(chalk.red('No migration to rollback'));
          return;
        }

        migrationsToRollback = [migrationId];
        rollbackType = `rollback migration "${migrationId}"`;
      }

      // Stop the spinner before prompting for user input
      spinner.stop();

      // Confirm rollback
      const confirmed = await clack.confirm({
        message: `Are you sure you want to ${rollbackType}?`,
        initialValue: false,
      });

      if (clack.isCancel(confirmed) || !confirmed) {
        clack.cancel(chalk.yellow('Rollback cancelled'));
        process.exit(0);
      }

      // Restart the spinner for the actual rollback
      spinner.start('Rolling back migration(s)...');

      // Execute rollbacks in order (latest first)
      for (const migrationId of migrationsToRollback) {
        spinner.text = `Rolling back migration: ${migrationId}`;
        await migrationManager.rollback(migrationId);
      }

      spinner.succeed(
        chalk.green(
          `✅ ${migrationsToRollback.length === 1 ? 'Migration' : 'Migrations'} rolled back successfully: ${migrationsToRollback.join(', ')}`,
        ),
      );

      // Connection will be closed in finally block
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      spinner.fail(chalk.red(`Rollback failed: ${errorMessage}`));
      process.exit(1);
    } finally {
      if (migrationManager) {
        await migrationManager.close();
      }
      process.exit(0);
    }
  });

// Generate command
program
  .command('generate')
  .description('Generate SurrealQL diff from schema file')
  .option('-o, --output <path>', 'Output file path (defaults to stdout)')
  .option('--debug', 'Enable debug logging to file')
  .action(async (options) => {
    const globalOpts = program.opts();

    // Initialize debug logger if debug flag is set
    if (options.debug) {
      const debugLogger = new DebugLogger(true);
      setDebugLogger(debugLogger);
    }

    const spinner = ora('Loading configuration...').start();

    try {
      // Load configuration using the new system
      const config = await getConfigFromOptions(globalOpts);

      spinner.text = 'Loading schema file...';
      const schemaPath = path.resolve(config.schema);
      const schema = await loadSchemaFromFile(schemaPath);

      spinner.text = 'Generating SurrealQL diff...';

      const migrationManager = new MigrationManager(config);
      await migrationManager.initialize();

      // Check if there are changes first
      const hasChanges = await migrationManager.hasChanges(schema);

      if (hasChanges) {
        // Generate the actual diff
        const { up, down } = await migrationManager.generateDiff(schema);

        spinner.succeed(chalk.green('SurrealQL diff generated successfully'));

        if (options.output) {
          await writeFile(options.output, up, 'utf-8');
          console.log(chalk.blue(`📄 SurrealQL written to: ${options.output}`));
        }

        console.log(`\n${chalk.cyan('Generated SurrealQL Diff:')}`);
        console.log('='.repeat(50));
        console.log(up);

        console.log(`\n${chalk.cyan('Generated Rollback Migration:')}`);
        console.log('='.repeat(50));
        console.log(down);
      } else {
        spinner.succeed(chalk.green('Schema analysis completed'));
        console.log(chalk.yellow('No changes detected - database schema is up to date.'));
      }

      // Close the database connection
      await migrationManager.close();
      process.exit(0);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : '';
      spinner.fail(chalk.red(`Generation failed: ${errorMessage}`));
      if (options.debug && errorStack) {
        console.error(chalk.gray(errorStack));
      }
      process.exit(1);
    }
  });

// Init command
program
  .command('init')
  .description('Initialize a new schema and config file')
  .option('-o, --output <path>', 'Schema file path', './schema.ts')
  .option('-c, --config <path>', 'Config file path', './smig.config.ts')
  .option('--no-config', 'Skip creating config file')
  .option('--debug', 'Enable debug logging to file')
  .action(async (options) => {
    // Initialize debug logger if debug flag is set
    if (options.debug) {
      const debugLogger = new DebugLogger(true);
      setDebugLogger(debugLogger);
    }

    const spinner = ora('Creating project files...').start();

    try {
      const fs = await import('fs-extra');
      const schemaPath = path.resolve(options.output);
      // options.config is false when --no-config is used, otherwise it's the path string
      const createConfig = options.config !== false;
      const configPath = createConfig ? path.resolve(options.config) : null;

      // Check if schema file already exists
      if (await fs.pathExists(schemaPath)) {
        spinner.stop();

        const overwrite = await clack.confirm({
          message: `File '${schemaPath}' already exists. Do you want to overwrite it?`,
          initialValue: false,
        });

        if (clack.isCancel(overwrite) || !overwrite) {
          clack.cancel('Schema file creation cancelled.');
          process.exit(0);
        }

        spinner.start('Creating project files...');
      }

      // Track whether to create config (may change based on user response)
      let shouldCreateConfig = createConfig;

      // Check if config file already exists (only if we're creating one)
      if (createConfig && configPath && (await fs.pathExists(configPath))) {
        spinner.stop();

        const overwriteConfig = await clack.confirm({
          message: `File '${configPath}' already exists. Do you want to overwrite it?`,
          initialValue: false,
        });

        if (clack.isCancel(overwriteConfig) || !overwriteConfig) {
          // Just skip config creation, continue with schema
          spinner.start('Creating schema file...');
          shouldCreateConfig = false;
        } else {
          spinner.start('Creating project files...');
        }
      }

      const template = `import {
  // Field types
  string,
  int,
  float,
  bool,
  datetime,
  uuid,
  array,
  record,
  // Indexes
  index,
  // Schema builders
  defineSchema,
  defineRelation,
  composeSchema,
  // Common patterns
  cf,
  ci,
  ce,
  // Entities (SurrealDB 3.x)
  fn,
  analyzer,
  access,
  param,
} from 'smig';

/**
 * smig Schema File (SurrealDB 3.x)
 *
 * This template showcases smig’s full capabilities:
 * - Type-safe schema definitions
 * - Vector indexes for AI/ML (HNSW, MTREE)
 * - ACCESS authentication (JWT, RECORD)
 * - Rename tracking with .was()
 * - And much more!
 */

// =============================================================================
// USER MODEL
// =============================================================================
const userModel = defineSchema({
  table: 'user',
  fields: {
    // Basic fields
    name: string().required(),
    email: string().required(),

    // Optional fields with defaults
    isActive: bool().default(true),
    role: string().default('user'),

    // Timestamps (using common field patterns)
    createdAt: cf.timestamp(),
    updatedAt: cf.timestamp(),

    // Vector embedding for AI search (384 dimensions)
    embedding: array('float').comment('User profile embedding'),
  },
  indexes: {
    // Unique email constraint
    emailIndex: index(['email']).unique(),

    // Vector index for similarity search (HNSW algorithm)
    embeddingIndex: index(['embedding'])
      .hnsw()
      .dimension(384)
      .dist('COSINE')
      .comment('AI-powered user search'),
  },
});

// =============================================================================
// POST MODEL
// =============================================================================
const postModel = defineSchema({
  table: 'post',
  fields: {
    title: string().required(),
    content: string(),
    author: record('user').required(),
    isPublished: bool().default(false),
    viewCount: int().default(0).readonly(),
    createdAt: cf.timestamp(),

    // Content embedding for semantic search
    contentEmbedding: array('float'),
  },
  indexes: {
    authorIndex: index(['author']),
    publishedIndex: index(['isPublished', 'createdAt']),

    // Full-text search with custom analyzer
    contentSearch: index(['content'])
      .search()
      .analyzer('english_analyzer')
      .highlights(),
  },
});

// =============================================================================
// LIKE RELATION (Graph Edge)
// =============================================================================
const likeRelation = defineRelation({
  name: 'like',
  from: 'user',
  to: 'post',
  fields: {
    createdAt: cf.timestamp(),
  },
});

// =============================================================================
// CUSTOM FUNCTION
// =============================================================================
const daysSinceFunction = fn('fn::days_since')
  .param('date', 'datetime')
  .returns('int')
  .body(\`
    RETURN math::floor((time::now() - $date) / 86400);
  \`);

// =============================================================================
// TEXT ANALYZER (Full-text Search)
// =============================================================================
const englishAnalyzer = analyzer('english_analyzer')
  .tokenizers(['blank', 'class'])
  .filters(['lowercase', 'snowball(english)']);

// =============================================================================
// ACCESS DEFINITION (Authentication)
// =============================================================================
const userAccess = access('user')
  .record()
  .signup(\`
    CREATE user SET
      email = $email,
      password = crypto::argon2::generate($password)
  \`)
  .signin(\`
    SELECT * FROM user WHERE
      email = $email AND
      crypto::argon2::compare(password, $password)
  \`)
  .session('7d');

// =============================================================================
// GLOBAL PARAMETER
// =============================================================================
const appVersion = param('app_version').value("'1.0.0'");

// =============================================================================
// COMPOSE COMPLETE SCHEMA
// =============================================================================
const fullSchema = composeSchema({
  models: {
    user: userModel,
    post: postModel,
  },
  relations: {
    like: likeRelation,
  },
  functions: {
    days_since: daysSinceFunction,
  },
  analyzers: {
    english_analyzer: englishAnalyzer,
  },
  scopes: {
    user: userAccess,
  },
});

export default fullSchema;
`;

      await writeFile(schemaPath, template, 'utf-8');

      // Create config file if not disabled
      if (shouldCreateConfig && configPath) {
        const configTemplate = `/**
 * smig Configuration File
 *
 * This file configures your database connection and schema location.
 * Environment variables can override these values.
 *
 * Environment variables:
 * - SURREAL_URL, SURREAL_NAMESPACE, SURREAL_DATABASE
 * - SURREAL_USERNAME, SURREAL_PASSWORD
 */
export default {
  // Path to your schema file
  schema: './schema.ts',

  // SurrealDB connection settings
  url: 'ws://localhost:8000',
  namespace: 'test',
  database: 'test',
  username: 'root',
  password: 'root',

  // Environment-specific overrides (optional)
  // Use with: bun smig migrate --env production
  // environments: {
  //   production: {
  //     url: 'wss://your-server.com',
  //     namespace: 'production',
  //     database: 'myapp',
  //     username: process.env.SURREAL_USERNAME,
  //     password: process.env.SURREAL_PASSWORD,
  //   },
  // },
};
`;

        await writeFile(configPath, configTemplate, 'utf-8');
      }

      if (shouldCreateConfig && configPath) {
        spinner.succeed(chalk.green('Project files created'));
        console.log(chalk.blue(`\n📄 Schema: ${schemaPath}`));
        console.log(chalk.blue(`⚙️  Config: ${configPath}`));
      } else {
        spinner.succeed(chalk.green(`Schema file created: ${schemaPath}`));
      }

      console.log(chalk.blue('\n📝 Next steps:'));
      console.log('1. Edit the schema file to define your models');
      if (shouldCreateConfig) {
        console.log('2. Update smig.config.ts with your database credentials');
        console.log('3. Run "bun smig migrate" to apply to database');
        console.log('4. Run "bun smig status" to check migration status');
      } else {
        console.log('2. Run "bun smig migrate" to apply to database');
        console.log('3. Run "bun smig status" to check migration status');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      spinner.fail(chalk.red(`Failed to create project files: ${errorMessage}`));
      process.exit(1);
    }
  });

// Test command
program
  .command('test')
  .description('Test database connection')
  .action(async () => {
    const globalOpts = program.opts();
    const spinner = ora('Loading configuration...').start();

    try {
      // Load configuration using the new system
      const config = await getConfigFromOptions(globalOpts);

      spinner.text = 'Testing database connection...';

      const { SurrealClient } = await import('./database/surreal-client');
      const client = new SurrealClient(config);

      await client.connect();

      // Test a simple query
      await client.executeQuery('SELECT * FROM _migrations LIMIT 1');

      await client.disconnect();

      spinner.succeed(chalk.green('Database connection successful'));
      console.log(chalk.blue(`📊 Connected to: ${config.url}`));
      console.log(chalk.blue(`📁 Namespace: ${config.namespace}`));
      console.log(chalk.blue(`🗄️  Database: ${config.database}`));
      process.exit(0);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      spinner.fail(chalk.red(`Database connection failed: ${errorMessage}`));
      process.exit(1);
    }
  });

// Config command
program
  .command('config')
  .description('Show current configuration and available environments')
  .option('--show-secrets', 'Show password and other sensitive values')
  .option('--debug', 'Enable debug logging to file')
  .action(async (options) => {
    const globalOpts = program.opts();

    // Initialize debug logger if debug flag is set
    if (options.debug) {
      const debugLogger = new DebugLogger(true);
      setDebugLogger(debugLogger);
    }
    const spinner = ora('Loading configuration...').start();

    try {
      // Load configuration using the new system
      const configWithEnvs = await getConfigFromOptions(globalOpts);
      const config = { ...configWithEnvs };
      delete config.availableEnvironments;

      // Extract available environments from config load
      const environments = configWithEnvs.availableEnvironments || [];

      // Debug logging for config command
      if (options.debug) {
        debugLog('Config command executed', {
          globalOptions: globalOpts,
          commandOptions: options,
          selectedEnvironment: globalOpts.env || 'default',
          availableEnvironments: environments,
          finalConfig: options.showSecrets ? config : { ...config, password: '[HIDDEN]' },
        });
      }

      spinner.succeed(chalk.green('Configuration loaded'));

      console.log(chalk.bold('\n🔧 Current Configuration:'));
      console.log(chalk.blue(`  Schema:    ${config.schema}`));
      console.log(chalk.blue(`  URL:       ${config.url}`));
      console.log(chalk.blue(`  Namespace: ${config.namespace}`));
      console.log(chalk.blue(`  Database:  ${config.database}`));
      console.log(chalk.blue(`  Username:  ${config.username}`));
      console.log(chalk.blue(`  Password:  ${options.showSecrets ? config.password : '***'}`));

      if (globalOpts.env) {
        console.log(chalk.yellow(`  Environment: ${globalOpts.env}`));
      }

      if (environments.length > 0) {
        console.log(chalk.bold('\n🌍 Available Environments:'));
        environments.forEach((env: string) => {
          const prefix = env === globalOpts.env ? chalk.green('→ ') : '  ';
          console.log(`${prefix}${env}`);
        });
        console.log(chalk.dim('\nUse --env <name> to select an environment'));
      }

      console.log(chalk.bold('\n📋 Configuration Sources (in order of precedence):'));
      console.log('  1. Command line arguments');
      console.log('  2. smig.config.ts (or .js fallback)');
      console.log('  3. .env file');
      console.log('  4. Built-in defaults');
    } catch (error) {
      spinner.fail(
        chalk.red(`Configuration error: ${error instanceof Error ? error.message : error}`),
      );
      process.exit(1);
    }
  });

// Validate command - validates schema without database connection
program
  .command('validate')
  .description('Validate schema file syntax and structure (no database required)')
  .option('--debug', 'Enable debug logging to file')
  .action(async (options) => {
    const globalOpts = program.opts();

    // Initialize debug logger if debug flag is set
    if (options.debug) {
      const debugLogger = new DebugLogger(true);
      setDebugLogger(debugLogger);
    }

    const spinner = ora('Validating schema...').start();

    try {
      // Get schema path from options (no database connection needed)
      const schemaPath = path.resolve(globalOpts.schema || './schema.ts');

      spinner.text = 'Loading schema file...';
      const schema = await loadSchemaFromFile(schemaPath);

      // Validate schema structure
      const issues: string[] = [];

      // Check tables
      if (!schema.tables || schema.tables.length === 0) {
        issues.push('⚠️  No tables defined in schema');
      } else {
        for (const table of schema.tables) {
          if (!table.name) {
            issues.push('❌ Table missing name property');
          }
          if (!table.fields || table.fields.length === 0) {
            issues.push(`⚠️  Table "${table.name}" has no fields defined`);
          }
        }
      }

      // Check relations
      for (const relation of schema.relations || []) {
        if (!relation.name) {
          issues.push('❌ Relation missing name property');
        }
        if (!relation.from || !relation.to) {
          issues.push(`❌ Relation "${relation.name}" missing from/to properties`);
        }
      }

      // Check functions
      for (const func of schema.functions || []) {
        if (!func.name) {
          issues.push('❌ Function missing name property');
        }
        if (!func.body) {
          issues.push(`❌ Function "${func.name}" missing body`);
        }
      }

      // Check analyzers
      for (const analyzer of schema.analyzers || []) {
        if (!analyzer.name) {
          issues.push('❌ Analyzer missing name property');
        }
        if (!analyzer.tokenizers || analyzer.tokenizers.length === 0) {
          issues.push(`⚠️  Analyzer "${analyzer.name}" has no tokenizers`);
        }
      }

      spinner.succeed(chalk.green('Schema validation complete'));

      // Display summary
      console.log(chalk.bold('\n📋 Schema Summary:'));
      console.log(chalk.blue(`  Tables:    ${schema.tables.length}`));
      console.log(chalk.blue(`  Relations: ${schema.relations.length}`));
      console.log(chalk.blue(`  Functions: ${(schema.functions || []).length}`));
      console.log(chalk.blue(`  Analyzers: ${(schema.analyzers || []).length}`));
      console.log(chalk.blue(`  Scopes:    ${(schema.scopes || []).length}`));

      // Display field/index counts
      let totalFields = 0;
      let totalIndexes = 0;
      let totalEvents = 0;
      for (const table of [...schema.tables, ...schema.relations]) {
        totalFields += table.fields?.length || 0;
        totalIndexes += table.indexes?.length || 0;
        totalEvents += table.events?.length || 0;
      }
      console.log(chalk.blue(`  Fields:    ${totalFields}`));
      console.log(chalk.blue(`  Indexes:   ${totalIndexes}`));
      console.log(chalk.blue(`  Events:    ${totalEvents}`));

      // Display issues
      if (issues.length > 0) {
        console.log(chalk.bold('\n⚠️  Validation Issues:'));
        for (const issue of issues) {
          console.log(`  ${issue}`);
        }
      } else {
        console.log(chalk.green('\n✅ Schema is valid!'));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      spinner.fail(chalk.red(`Schema validation failed: ${errorMessage}`));
      process.exit(1);
    }
  });

// Diff command (alias for generate)
program
  .command('diff')
  .description('Generate migration diff between schema and database (alias for generate)')
  .option('-o, --output <path>', 'Output file path (defaults to stdout)')
  .option('--debug', 'Enable debug logging to file')
  .action(async (options) => {
    // Delegate to generate command
    const globalOpts = program.opts();

    if (options.debug) {
      const debugLogger = new DebugLogger(true);
      setDebugLogger(debugLogger);
    }

    const spinner = ora('Loading configuration...').start();

    try {
      const config = await getConfigFromOptions(globalOpts);

      spinner.text = 'Loading schema file...';
      const schemaPath = path.resolve(config.schema);
      const schema = await loadSchemaFromFile(schemaPath);

      spinner.text = 'Connecting to database...';
      const migrationManager = new MigrationManager(config);
      await migrationManager.initialize();

      spinner.text = 'Generating migration diff...';
      const hasChanges = await migrationManager.hasChanges(schema);

      if (hasChanges) {
        const { up, down } = await migrationManager.generateDiff(schema);

        spinner.succeed(chalk.green('Migration diff generated'));

        if (options.output) {
          await writeFile(options.output, up, 'utf-8');
          console.log(chalk.blue(`📄 Migration written to: ${options.output}`));
        }

        console.log(`\n${chalk.cyan('Up Migration (apply changes):')}`);
        console.log('─'.repeat(50));
        console.log(up);

        console.log(`\n${chalk.cyan('Down Migration (rollback):')}`);
        console.log('─'.repeat(50));
        console.log(down);
      } else {
        spinner.succeed(chalk.green('No changes detected'));
        console.log(chalk.yellow('Database schema matches the schema definition.'));
      }

      await migrationManager.close();
      process.exit(0);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      spinner.fail(chalk.red(`Diff generation failed: ${errorMessage}`));
      process.exit(1);
    }
  });

// Mermaid command
program
  .command('mermaid')
  .description('Generate Mermaid ER diagram from schema')
  .option('-o, --output <path>', 'Output file path (defaults to schema-diagram.mermaid)')
  .option('--debug', 'Enable debug logging to file')
  .action(async (options) => {
    const globalOpts = program.opts();

    // Initialize debug logger if debug flag is set
    if (options.debug) {
      const debugLogger = new DebugLogger(true);
      setDebugLogger(debugLogger);
    }

    const spinner = ora('Loading configuration...').start();

    try {
      // Load configuration using the new system
      const config = await getConfigFromOptions(globalOpts);

      spinner.text = 'Loading schema file...';
      const schemaPath = path.resolve(config.schema);
      const schema = await loadSchemaFromFile(schemaPath);

      spinner.stop();

      // Prompt for diagram detail level
      const detailLevel = await clack.select({
        message: 'Select diagram detail level:',
        options: [
          {
            value: 'minimal',
            label: 'Minimal (executive summary)',
            hint: 'Entities with field names and types only',
          },
          {
            value: 'detailed',
            label: 'Detailed (comprehensive view)',
            hint: 'All entity details including constraints, defaults, and computed fields',
          },
        ],
        initialValue: 'minimal',
      });

      if (clack.isCancel(detailLevel)) {
        clack.cancel(chalk.yellow('Diagram generation cancelled'));
        process.exit(0);
      }

      // Determine output path
      const outputPath = options.output || path.resolve('schema-diagram.mermaid');

      // Check if file exists and prompt to overwrite
      const fs = await import('fs-extra');
      if (await fs.pathExists(outputPath)) {
        const overwrite = await clack.confirm({
          message: `File '${outputPath}' already exists. Do you want to overwrite it?`,
          initialValue: false,
        });

        if (clack.isCancel(overwrite) || !overwrite) {
          clack.cancel(chalk.yellow('Diagram generation cancelled'));
          process.exit(0);
        }
      }

      spinner.start('Generating Mermaid diagram...');

      // Generate the diagram
      const { generateMermaidDiagram } = await import('./migrator/mermaid-generator');
      const diagram = generateMermaidDiagram(schema, {
        level: detailLevel as 'minimal' | 'detailed',
        includeComments: true,
      });

      // Write to file
      await writeFile(outputPath, diagram, 'utf-8');

      spinner.succeed(chalk.green('Mermaid diagram generated successfully'));
      console.log(chalk.blue(`📊 Diagram written to: ${outputPath}`));
      console.log(
        chalk.dim(
          '\nYou can visualize this diagram at https://newmo-oss.github.io/mermaid-viewer/',
        ),
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      spinner.fail(chalk.red(`Diagram generation failed: ${errorMessage}`));
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();
