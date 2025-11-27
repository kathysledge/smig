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
 * - `--schema` - Path to JavaScript schema file (default: ./schema.js)
 *
 * ## Configuration
 *
 * Configuration is loaded with the following precedence (highest to lowest):
 * 1. Command line arguments
 * 2. smig.config.js file
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
 * ### Configuration File (smig.config.js)
 * ```javascript
 * module.exports = {
 *   schema: "./schema.js",
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
 * ```bash
 * # Apply migrations using default config
 * smig migrate
 *
 * # Apply migrations to production environment
 * smig migrate --env prod
 *
 * # Override specific settings
 * smig migrate --env prod --database citadel_v2
 *
 * # Check current configuration
 * smig config
 *
 * # Check status
 * smig status --env dev
 *
 * # Generate diff without applying
 * smig generate --output migration.sql
 *
 * # Initialize new schema
 * smig init --output my-schema.js
 * ```
 */

import { writeFile } from "node:fs/promises";
// import * as dotenv from "dotenv";
import * as path from "node:path";
import * as clack from "@clack/prompts";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { loadSchemaFromFile, MigrationManager } from "./migrator/migration-manager";
import type { DatabaseConfig } from "./types/schema";
import { type ConfigOptions, loadConfig, validateConfig } from "./utils/config-loader.js";
import { DebugLogger, debugLog, setDebugLogger } from "./utils/debug-logger";

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
  .name("smig")
  .description("Automatic SurrealDB migrations with a concise DSL")
  .version("0.4.4")
  .configureHelp({
    showGlobalOptions: true,
  });

// Global options
program
  .option("-u, --url <url>", "SurrealDB server URL (overrides config and env)")
  .option("-n, --namespace <namespace>", "SurrealDB namespace (overrides config and env)")
  .option("-d, --database <database>", "SurrealDB database (overrides config and env)")
  .option("-U, --username <username>", "SurrealDB username (overrides config and env)")
  .option("-p, --password <password>", "SurrealDB password (overrides config and env)")
  .option("-s, --schema <path>", "Path to schema file (overrides config and env)")
  .option("--env <environment>", "Environment name from smig.config.js");

// Migrate command
program
  .command("migrate")
  .description("Apply schema changes to the database")
  .option("--debug", "Enable debug logging to file")
  .option("-m, --message <message>", "Migration message for tracking purposes")

  .action(async (options) => {
    const globalOpts = program.opts();

    // Initialize debug logger if debug flag is set
    if (options.debug) {
      const debugLogger = new DebugLogger(true);
      setDebugLogger(debugLogger);
    }

    const spinner = ora("Initializing migration...").start();
    let migrationManager: MigrationManager | undefined;

    try {
      // Load configuration using the new system
      spinner.text = "Loading configuration...";
      const config = await getConfigFromOptions(globalOpts);

      // Load schema from file
      spinner.text = "Loading schema file...";
      const schemaPath = path.resolve(config.schema);
      const schema = await loadSchemaFromFile(schemaPath);

      // Initialize migration manager
      spinner.text = "Connecting to database...";
      migrationManager = new MigrationManager(config);
      spinner.text = "Initializing...";
      await migrationManager.initialize();
      spinner.text = "Done initializing...";

      // Apply migration
      spinner.text = "Applying migration...";
      await migrationManager.migrate(schema, undefined, undefined, options.message);

      spinner.succeed(chalk.green(`Migration applied successfully`));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Handle "no changes" as a success case, not an error
      if (errorMessage.includes("No changes detected")) {
        spinner.succeed(chalk.green("Database schema is up to date"));
        console.log(chalk.yellow("No changes detected - no migration needed."));
      } else {
        spinner.fail(chalk.red(`Migration failed: ${errorMessage}`));
        process.exit(1);
      }
    } finally {
      // Always close the connection to prevent hanging
      if (migrationManager) {
        await migrationManager.close();
      }
    }
  });

// Status command
program
  .command("status")
  .description("Show migration status")
  .action(async () => {
    const globalOpts = program.opts();
    const spinner = ora("Loading configuration...").start();

    try {
      // Load configuration using the new system
      const config = await getConfigFromOptions(globalOpts);

      spinner.text = "Checking migration status...";

      const migrationManager = new MigrationManager(config);
      await migrationManager.initialize();

      const status = await migrationManager.status();

      spinner.succeed(chalk.green("Migration status retrieved"));

      console.log("\n📊 Migration Status:");
      console.log(`Applied migrations: ${status.length}`);

      if (status.length > 0) {
        console.log("\nApplied migrations:");
        for (const item of status) {
          if (item.migration) {
            console.log(`  - ${item.migration.id} (${item.migration.appliedAt.toISOString()})`);
          }
        }
      } else {
        console.log("\nNo migrations applied yet.");
      }

      // Check for pending changes
      try {
        const schemaPath = path.resolve(config.schema);
        const schema = await loadSchemaFromFile(schemaPath);
        const hasChanges = await migrationManager.hasChanges(schema);

        if (hasChanges) {
          console.log("\n🔄 Pending changes detected:");
          console.log('Run "smig migrate" to apply changes');
        } else {
          console.log("\n✅ Database is up to date with schema");
        }
      } catch (_error) {
        console.log("\n⚠️  Could not check for pending changes (smig)");
      }

      await migrationManager.close();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      spinner.fail(chalk.red(`Failed to get status: ${errorMessage}`));
      process.exit(1);
    }
  });

// Rollback command
program
  .command("rollback")
  .description("Rollback migrations from the database")
  .option(
    "-i, --id <id>",
    "Migration ID to rollback (defaults to last migration). Can be just the ID part, '_migrations:' prefix will be added automatically if missing.",
  )
  .option(
    "-t, --to <id>",
    "Rollback all migrations after and including this migration ID. Can be just the ID part, '_migrations:' prefix will be added automatically if missing.",
  )
  .option("--debug", "Enable debug logging to file")
  .action(async (options) => {
    const globalOpts = program.opts();

    // Initialize debug logger if debug flag is set
    if (options.debug) {
      const debugLogger = new DebugLogger(true);
      setDebugLogger(debugLogger);
    }

    const spinner = ora("Loading configuration...").start();

    let migrationManager: MigrationManager | null = null;
    try {
      // Load configuration using the new system
      const config = await getConfigFromOptions(globalOpts);

      spinner.text = "Rolling back migration...";

      migrationManager = new MigrationManager(config);
      await migrationManager.initialize();

      const status = await migrationManager.status();

      if (status.length === 0) {
        spinner.fail(chalk.red("No migrations to rollback"));
        return;
      }

      // Helper function to normalize migration ID
      const normalizeMigrationId = (id: string): string => {
        if (!id) return id;
        // Add _migrations: prefix if not already present
        return id.startsWith("_migrations:") ? id : `_migrations:${id}`;
      };

      // Determine rollback strategy
      if (options.to && options.id) {
        spinner.fail(chalk.red("Cannot specify both --id and --to options"));
        return;
      }

      let migrationsToRollback: string[] = [];
      let rollbackType = "";

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
          .filter((id): id is string => typeof id === "string");
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
          spinner.fail(chalk.red("No migration to rollback"));
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
        clack.cancel(chalk.yellow("Rollback cancelled"));
        process.exit(0);
      }

      // Restart the spinner for the actual rollback
      spinner.start("Rolling back migration(s)...");

      // Execute rollbacks in order (latest first)
      for (const migrationId of migrationsToRollback) {
        spinner.text = `Rolling back migration: ${migrationId}`;
        await migrationManager.rollback(migrationId);
      }

      spinner.succeed(
        chalk.green(
          `✅ ${migrationsToRollback.length === 1 ? "Migration" : "Migrations"} rolled back successfully: ${migrationsToRollback.join(", ")}`,
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
    }
  });

// Generate command
program
  .command("generate")
  .description("Generate SurrealQL diff from schema file")
  .option("-o, --output <path>", "Output file path (defaults to stdout)")
  .option("--debug", "Enable debug logging to file")
  .action(async (options) => {
    const globalOpts = program.opts();

    // Initialize debug logger if debug flag is set
    if (options.debug) {
      const debugLogger = new DebugLogger(true);
      setDebugLogger(debugLogger);
    }

    const spinner = ora("Loading configuration...").start();

    try {
      // Load configuration using the new system
      const config = await getConfigFromOptions(globalOpts);

      spinner.text = "Loading schema file...";
      const schemaPath = path.resolve(config.schema);
      const schema = await loadSchemaFromFile(schemaPath);

      spinner.text = "Generating SurrealQL diff...";

      const migrationManager = new MigrationManager(config);
      await migrationManager.initialize();

      // Check if there are changes first
      const hasChanges = await migrationManager.hasChanges(schema);

      if (hasChanges) {
        // Generate the actual diff
        const { up, down } = await migrationManager.generateDiff(schema);

        spinner.succeed(chalk.green("SurrealQL diff generated successfully"));

        if (options.output) {
          await writeFile(options.output, up, "utf-8");
          console.log(chalk.blue(`📄 SurrealQL written to: ${options.output}`));
        }

        console.log(`\n${chalk.cyan("Generated SurrealQL Diff:")}`);
        console.log("=".repeat(50));
        console.log(up);

        console.log(`\n${chalk.cyan("Generated Rollback Migration:")}`);
        console.log("=".repeat(50));
        console.log(down);
      } else {
        spinner.succeed(chalk.green("Schema analysis completed"));
        console.log(chalk.yellow("No changes detected - database schema is up to date."));
      }

      // Close the database connection
      await migrationManager.close();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      spinner.fail(chalk.red(`Generation failed: ${errorMessage}`));
      process.exit(1);
    }
  });

// Init command
program
  .command("init")
  .description("Initialize a new schema file")
  .option("-o, --output <path>", "Output file path", "./schema.js")
  .option("--debug", "Enable debug logging to file")
  .action(async (options) => {
    // Initialize debug logger if debug flag is set
    if (options.debug) {
      const debugLogger = new DebugLogger(true);
      setDebugLogger(debugLogger);
    }

    const spinner = ora("Creating schema file...").start();

    try {
      const fs = await import("fs-extra");
      const outputPath = path.resolve(options.output);

      // Check if file already exists
      if (await fs.pathExists(outputPath)) {
        spinner.stop();

        const overwrite = await clack.confirm({
          message: `File '${outputPath}' already exists. Do you want to overwrite it?`,
          initialValue: false,
        });

        if (clack.isCancel(overwrite) || !overwrite) {
          clack.cancel("Schema file creation cancelled.");
          process.exit(0);
        }

        spinner.start("Creating schema file...");
      }

      const template = `import {
  string,
  int,
  bool,
  datetime,
  record,
  index,
  defineSchema,
  defineRelation,
  composeSchema,
  cf,
  ci,
  ce
} from 'smig';

/**
 * Example Schema File
 *
 * This is a basic example schema to get you started.
 * Modify the tables and fields according to your needs.
 */

// User model - represents application users
const userModel = defineSchema({
  table: 'user',
  schemafull: true,
  fields: {
    name: string(),
    email: string(),
    isActive: bool().default(true),
    createdAt: cf.timestamp(), // Timestamp field
  },
  indexes: {
    emailIndex: index(['email']).unique(), // Unique email constraint
  },
});

// Post model - represents blog posts
const postModel = defineSchema({
  table: 'post',
  schemafull: true,
  fields: {
    title: string(),
    content: string(),
    author: cf.owner('user'), // Foreign key to user
    isPublished: bool().default(false),
    createdAt: cf.timestamp(), // Created timestamp
    updatedAt: cf.timestamp(), // Updated timestamp
  },
  indexes: {
    authorIndex: index(['author']), // Fast lookups by author
    createdAtIndex: ci.createdAt('post'), // Created date index
  },
});

// Like relation - represents users liking posts
const likeRelation = defineRelation({
  name: 'like',
  from: 'user',
  to: 'post',
  fields: {
    createdAt: cf.timestamp(), // When the like was created
  },
});

// Compose the complete schema
const fullSchema = composeSchema({
  models: {
    user: userModel,
    post: postModel,
  },
  relations: {
    like: likeRelation,
  },
});

export default fullSchema;
`;

      await writeFile(outputPath, template, "utf-8");

      spinner.succeed(chalk.green(`Schema file created: ${outputPath}`));
      console.log(chalk.blue("\n📝 Next steps:"));
      console.log("1. Edit the schema file to define your models");
      console.log('2. Run "smig migrate" to apply to database');
      console.log('3. Run "smig status" to check migration status');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      spinner.fail(chalk.red(`Failed to create schema file: ${errorMessage}`));
      process.exit(1);
    }
  });

// Test command
program
  .command("test")
  .description("Test database connection")
  .action(async () => {
    const globalOpts = program.opts();
    const spinner = ora("Loading configuration...").start();

    try {
      // Load configuration using the new system
      const config = await getConfigFromOptions(globalOpts);

      spinner.text = "Testing database connection...";

      const { SurrealClient } = await import("./database/surreal-client");
      const client = new SurrealClient(config);

      await client.connect();

      // Test a simple query
      await client.executeQuery("SELECT * FROM _migrations LIMIT 1");

      await client.disconnect();

      spinner.succeed(chalk.green("Database connection successful"));
      console.log(chalk.blue(`📊 Connected to: ${config.url}`));
      console.log(chalk.blue(`📁 Namespace: ${config.namespace}`));
      console.log(chalk.blue(`🗄️  Database: ${config.database}`));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      spinner.fail(chalk.red(`Database connection failed: ${errorMessage}`));
      process.exit(1);
    }
  });

// Config command
program
  .command("config")
  .description("Show current configuration and available environments")
  .option("--show-secrets", "Show password and other sensitive values")
  .option("--debug", "Enable debug logging to file")
  .action(async (options) => {
    const globalOpts = program.opts();

    // Initialize debug logger if debug flag is set
    if (options.debug) {
      const debugLogger = new DebugLogger(true);
      setDebugLogger(debugLogger);
    }
    const spinner = ora("Loading configuration...").start();

    try {
      // Load configuration using the new system
      const configWithEnvs = await getConfigFromOptions(globalOpts);
      const config = { ...configWithEnvs };
      delete config.availableEnvironments;

      // Extract available environments from config load
      const environments = configWithEnvs.availableEnvironments || [];

      // Debug logging for config command
      if (options.debug) {
        debugLog("Config command executed", {
          globalOptions: globalOpts,
          commandOptions: options,
          selectedEnvironment: globalOpts.env || "default",
          availableEnvironments: environments,
          finalConfig: options.showSecrets ? config : { ...config, password: "[HIDDEN]" },
        });
      }

      spinner.succeed(chalk.green("Configuration loaded"));

      console.log(chalk.bold("\n🔧 Current Configuration:"));
      console.log(chalk.blue(`  Schema:    ${config.schema}`));
      console.log(chalk.blue(`  URL:       ${config.url}`));
      console.log(chalk.blue(`  Namespace: ${config.namespace}`));
      console.log(chalk.blue(`  Database:  ${config.database}`));
      console.log(chalk.blue(`  Username:  ${config.username}`));
      console.log(chalk.blue(`  Password:  ${options.showSecrets ? config.password : "***"}`));

      if (globalOpts.env) {
        console.log(chalk.yellow(`  Environment: ${globalOpts.env}`));
      }

      if (environments.length > 0) {
        console.log(chalk.bold("\n🌍 Available Environments:"));
        environments.forEach((env: string) => {
          const prefix = env === globalOpts.env ? chalk.green("→ ") : "  ";
          console.log(`${prefix}${env}`);
        });
        console.log(chalk.dim("\nUse --env <name> to select an environment"));
      }

      console.log(chalk.bold("\n📋 Configuration Sources (in order of precedence):"));
      console.log("  1. Command line arguments");
      console.log("  2. smig.config.js");
      console.log("  3. .env file");
      console.log("  4. Built-in defaults");
    } catch (error) {
      spinner.fail(
        chalk.red(`Configuration error: ${error instanceof Error ? error.message : error}`),
      );
      process.exit(1);
    }
  });

// Mermaid command
program
  .command("mermaid")
  .description("Generate Mermaid ER diagram from schema")
  .option("-o, --output <path>", "Output file path (defaults to schema-diagram.mermaid)")
  .option("--debug", "Enable debug logging to file")
  .action(async (options) => {
    const globalOpts = program.opts();

    // Initialize debug logger if debug flag is set
    if (options.debug) {
      const debugLogger = new DebugLogger(true);
      setDebugLogger(debugLogger);
    }

    const spinner = ora("Loading configuration...").start();

    try {
      // Load configuration using the new system
      const config = await getConfigFromOptions(globalOpts);

      spinner.text = "Loading schema file...";
      const schemaPath = path.resolve(config.schema);
      const schema = await loadSchemaFromFile(schemaPath);

      spinner.stop();

      // Prompt for diagram detail level
      const detailLevel = await clack.select({
        message: "Select diagram detail level:",
        options: [
          {
            value: "minimal",
            label: "Minimal (executive summary)",
            hint: "Entities with field names and types only",
          },
          {
            value: "detailed",
            label: "Detailed (comprehensive view)",
            hint: "All entity details including constraints, defaults, and computed fields",
          },
        ],
        initialValue: "minimal",
      });

      if (clack.isCancel(detailLevel)) {
        clack.cancel(chalk.yellow("Diagram generation cancelled"));
        process.exit(0);
      }

      // Determine output path
      const outputPath = options.output || path.resolve("schema-diagram.mermaid");

      // Check if file exists and prompt to overwrite
      const fs = await import("fs-extra");
      if (await fs.pathExists(outputPath)) {
        const overwrite = await clack.confirm({
          message: `File '${outputPath}' already exists. Do you want to overwrite it?`,
          initialValue: false,
        });

        if (clack.isCancel(overwrite) || !overwrite) {
          clack.cancel(chalk.yellow("Diagram generation cancelled"));
          process.exit(0);
        }
      }

      spinner.start("Generating Mermaid diagram...");

      // Generate the diagram
      const { generateMermaidDiagram } = await import("./migrator/mermaid-generator");
      const diagram = generateMermaidDiagram(schema, {
        level: detailLevel as "minimal" | "detailed",
        includeComments: true,
      });

      // Write to file
      await writeFile(outputPath, diagram, "utf-8");

      spinner.succeed(chalk.green("Mermaid diagram generated successfully"));
      console.log(chalk.blue(`📊 Diagram written to: ${outputPath}`));
      console.log(
        chalk.dim(
          "\nYou can visualize this diagram at https://newmo-oss.github.io/mermaid-viewer/",
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
