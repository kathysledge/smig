import { existsSync } from 'node:fs';
import { join } from 'node:path';
import * as dotenv from 'dotenv';
import { debugLog } from './debug-logger.js';

/**
 * Error thrown when a user attempts to use an environment that doesn't exist in their configuration file.
 *
 * This error provides helpful feedback by listing all available environments, making it easy
 * for users to correct typos or discover what environments are actually defined.
 */
export class EnvironmentNotFoundError extends Error {
  constructor(environment: string, availableEnvironments: string[]) {
    const availableList =
      availableEnvironments.length > 0 ? availableEnvironments.join(', ') : 'none defined';
    super(`Environment '${environment}' not found. Available environments: ${availableList}`);
    this.name = 'EnvironmentNotFoundError';
  }
}

/**
 * Flag to track whether the .env file has been loaded.
 * This prevents duplicate loading which could cause unexpected behavior.
 */
let envLoaded = false;

/**
 * Ensures the .env file is loaded exactly once during the configuration process.
 *
 * This function checks if a .env file exists in the current working directory and
 * loads it using dotenv. Multiple calls to this function are safe - it will only
 * load the file on the first call.
 */
function ensureEnvLoaded(): void {
  if (envLoaded) {
    return;
  }

  const envPath = join(process.cwd(), '.env');
  if (existsSync(envPath)) {
    debugLog(`Loading .env file: ${envPath}`);
    dotenv.config({ path: envPath, quiet: true });
    envLoaded = true;
  }
}

/**
 * Complete configuration object with all required settings for connecting to SurrealDB.
 * This represents a fully resolved configuration with no optional fields.
 */
export interface SmigConfig {
  /** Path to the JavaScript schema definition file */
  schema: string;
  /** WebSocket URL for the SurrealDB server (e.g., 'ws://localhost:8000') */
  url: string;
  /** Username for database authentication */
  username: string;
  /** Password for database authentication */
  password: string;
  /** SurrealDB namespace to use */
  namespace: string;
  /** Database name within the namespace */
  database: string;
}

/**
 * Environment-specific configuration that extends the base configuration.
 * Allows customization of settings for different deployment environments.
 */
export interface SmigEnvironmentConfig extends SmigConfig {
  // Can add environment-specific options here if needed
}

/**
 * Structure of the smig.config.js file.
 * All fields are optional as they can be provided through other configuration sources.
 */
export interface SmigConfigFile {
  /** Path to the JavaScript schema definition file */
  schema?: string;
  /** WebSocket URL for the SurrealDB server */
  url?: string;
  /** Username for database authentication */
  username?: string;
  /** Password for database authentication */
  password?: string;
  /** SurrealDB namespace to use */
  namespace?: string;
  /** Database name within the namespace */
  database?: string;
  /** Named environment configurations for different deployment stages */
  environments?: Record<string, SmigEnvironmentConfig>;
}

/**
 * Configuration options that can be provided via CLI arguments.
 * These take highest precedence in the configuration resolution process.
 */
export interface ConfigOptions {
  /** Path to the JavaScript schema definition file */
  schema?: string;
  /** WebSocket URL for the SurrealDB server */
  url?: string;
  /** Username for database authentication */
  username?: string;
  /** Password for database authentication */
  password?: string;
  /** SurrealDB namespace to use */
  namespace?: string;
  /** Database name within the namespace */
  database?: string;
  /** Environment name from smig.config.js to use for this operation */
  env?: string;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: SmigConfig = {
  schema: './schema.js',
  url: 'ws://localhost:8000',
  username: 'root',
  password: 'root',
  namespace: 'test',
  database: 'test',
};

/**
 * Extracts smig configuration values from environment variables.
 *
 * This function looks for environment variables with the SMIG_ prefix and maps them
 * to configuration properties. The .env file should already be loaded into process.env
 * before calling this function.
 *
 * Supported environment variables:
 * - SMIG_SCHEMA: Path to schema file
 * - SMIG_URL: Database server URL
 * - SMIG_USERNAME: Authentication username
 * - SMIG_PASSWORD: Authentication password
 * - SMIG_NAMESPACE: Database namespace
 * - SMIG_DATABASE: Database name
 *
 * @returns Partial configuration object with values from environment variables
 */
function loadEnvConfig(): Partial<SmigConfig> {
  const envConfig: Partial<SmigConfig> = {};

  if (process.env.SMIG_SCHEMA) envConfig.schema = process.env.SMIG_SCHEMA;
  if (process.env.SMIG_URL) envConfig.url = process.env.SMIG_URL;
  if (process.env.SMIG_USERNAME) envConfig.username = process.env.SMIG_USERNAME;
  if (process.env.SMIG_PASSWORD) envConfig.password = process.env.SMIG_PASSWORD;
  if (process.env.SMIG_NAMESPACE) envConfig.namespace = process.env.SMIG_NAMESPACE;
  if (process.env.SMIG_DATABASE) envConfig.database = process.env.SMIG_DATABASE;

  debugLog('Loaded environment config:', envConfig);
  return envConfig;
}

/**
 * Loads configuration from the smig.config.js file and returns both the selected
 * configuration and a list of all available environments.
 *
 * This function handles:
 * - Loading the config file using dynamic import (supports both ES modules and CommonJS)
 * - Ensuring .env is loaded before importing (so config file can reference process.env)
 * - Selecting environment-specific configuration if specified
 * - Merging base config with environment-specific overrides
 * - Validating that the requested environment exists
 *
 * @param environment - Optional environment name to select from the config file
 * @returns Object containing the resolved config and list of available environment names
 * @throws {EnvironmentNotFoundError} If the specified environment doesn't exist in the config
 */
async function loadConfigFileWithEnvironments(
  environment?: string,
): Promise<{ config: Partial<SmigConfig>; availableEnvironments: string[] }> {
  const configPath = join(process.cwd(), 'smig.config.js');

  if (!existsSync(configPath)) {
    debugLog('No smig.config.js found');
    return { config: {}, availableEnvironments: [] };
  }

  try {
    debugLog(`Loading config from: ${configPath}`);

    // Ensure .env is loaded before importing config file
    // so that process.env references in the config file work correctly
    ensureEnvLoaded();

    // Dynamic import to support both CommonJS and ES modules
    let configModule: unknown;
    try {
      // Try ES module import first (using pathToFileURL for proper URL formatting)
      const { pathToFileURL } = await import('node:url');
      // Add cache-busting timestamp to ensure fresh imports in tests
      const configUrl = `${pathToFileURL(configPath).href}?t=${Date.now()}`;
      configModule = await import(configUrl);
    } catch (_esError) {
      // Fallback to require for CommonJS
      delete require.cache[configPath];
      configModule = require(configPath);
    }

    // biome-ignore lint/suspicious/noExplicitAny: Dynamic config module loading requires flexible typing
    const config: SmigConfigFile = (configModule as any).default || configModule;

    debugLog('Raw config file content:', config);

    // Capture available environments before potentially modifying config
    const availableEnvironments = config.environments ? Object.keys(config.environments) : [];

    // If environment is specified, validate it exists
    if (environment) {
      if (!config.environments || !config.environments[environment]) {
        throw new EnvironmentNotFoundError(environment, availableEnvironments);
      }

      debugLog(`Using environment: ${environment}`);
      const envConfig = config.environments[environment];
      // Merge base config with environment-specific config
      const mergedConfig = { ...config, ...envConfig };
      delete mergedConfig.environments; // Remove environments object from final config
      return { config: mergedConfig, availableEnvironments };
    }

    // Remove environments object if no specific environment was selected
    if (config.environments) {
      delete config.environments;
    }

    debugLog('Processed config file:', config);
    return { config, availableEnvironments };
  } catch (error) {
    // If this is an environment validation error, re-throw it to stop execution
    if (error instanceof EnvironmentNotFoundError) {
      throw error;
    }

    // For other errors (file loading issues), log warning and continue with defaults
    console.warn(`Warning: Could not load smig.config.js: ${error}`);
    debugLog(`Error loading config file: ${error}`);
    return { config: {}, availableEnvironments: [] };
  }
}

/**
 * Load complete configuration with proper precedence:
 * 1. CLI options (highest)
 * 2. smig.config.js (can reference .env variables via process.env)
 * 3. .env variables
 * 4. defaults (lowest)
 *
 * Note: .env is loaded before smig.config.js is imported so that
 * the config file can access .env variables via process.env
 */
export async function loadConfig(
  options: ConfigOptions = {},
): Promise<SmigConfig & { availableEnvironments?: string[] }> {
  debugLog('Loading configuration with options:', options);

  // Ensure .env is loaded first
  ensureEnvLoaded();

  // Start with defaults
  let config: SmigConfig = { ...DEFAULT_CONFIG };

  // 3. Apply .env variables
  const envConfig = loadEnvConfig();
  config = { ...config, ...envConfig };

  // 2. Apply smig.config.js (will have access to .env variables via process.env)
  const { config: fileConfig, availableEnvironments } = await loadConfigFileWithEnvironments(
    options.env,
  );
  config = { ...config, ...fileConfig };

  // 1. Apply CLI options (highest precedence)
  const cliConfig: Partial<SmigConfig> = {};
  if (options.schema !== undefined) cliConfig.schema = options.schema;
  if (options.url !== undefined) cliConfig.url = options.url;
  if (options.username !== undefined) cliConfig.username = options.username;
  if (options.password !== undefined) cliConfig.password = options.password;
  if (options.namespace !== undefined) cliConfig.namespace = options.namespace;
  if (options.database !== undefined) cliConfig.database = options.database;

  config = { ...config, ...cliConfig };

  debugLog('Final merged configuration:', config);
  return { ...config, availableEnvironments };
}

/**
 * Validates that a configuration object contains all required fields and that values are valid.
 *
 * This function performs the following checks:
 * - Ensures all required configuration fields are present (non-empty)
 * - Validates that the URL is properly formatted
 * - Checks that the schema file exists (if it's a file path)
 *
 * @param config - The configuration object to validate
 * @throws {Error} If any required field is missing, URL is invalid, or schema file doesn't exist
 */
export function validateConfig(config: SmigConfig): void {
  const required = ['schema', 'url', 'username', 'password', 'namespace', 'database'];
  const missing = required.filter((key) => !config[key as keyof SmigConfig]);

  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }

  // Validate URL format
  try {
    new URL(config.url);
  } catch (_error) {
    throw new Error(`Invalid URL format: ${config.url}`);
  }

  // Check if schema file exists (but only if it looks like a file path, not a module)
  if (
    config.schema.startsWith('./') ||
    config.schema.startsWith('../') ||
    config.schema.startsWith('/')
  ) {
    // For absolute paths (starting with /), use as-is; for relative paths, join with cwd
    const schemaPath = config.schema.startsWith('/')
      ? config.schema
      : join(process.cwd(), config.schema);
    if (!existsSync(schemaPath)) {
      throw new Error(`Schema file not found: ${schemaPath}`);
    }
  }
}
