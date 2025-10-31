/**
 * @fileoverview Debug logging utility for smig migration operations.
 *
 * This module provides comprehensive logging capabilities for debugging migration
 * operations. It supports file-based logging with timestamp formatting and
 * structured data serialization, making it easy to trace complex migration
 * processes and troubleshoot issues.
 */

import { appendFile, writeFile } from "node:fs/promises";
import { format } from "date-fns";

/**
 * File-based debug logger for migration operations.
 *
 * The DebugLogger provides a centralized logging system specifically designed for
 * debugging database migration operations. It captures detailed information about
 * migration processes, schema comparisons, and database operations, writing them
 * to timestamped log files for later analysis.
 *
 * ## Features
 *
 * - **File-based logging**: Writes debug output immediately to timestamped files
 * - **Structured data**: Supports logging of complex objects with JSON serialization
 * - **Schema logging**: Specialized methods for logging schema representations
 * - **Conditional logging**: Only logs when explicitly enabled
 * - **Immediate writing**: Messages are written to disk immediately, preventing data loss on cancellation
 *
 * @example
 * ```typescript
 * const logger = new DebugLogger(true);
 * logger.log('Starting migration process');
 * logger.logSchema('Current Schema', currentSchema);
 * // Messages are written immediately - no need to call flush()
 * ```
 */
export class DebugLogger {
  /** Whether debug logging is currently enabled */
  private enabled: boolean = false;
  /** The filename for the current debug log file */
  private logFile: string | null = null;
  /** Whether the log file has been initialized */
  private fileInitialized: boolean = false;

  /**
   * Creates a new DebugLogger instance.
   *
   * When enabled, the logger creates a timestamped log file and writes
   * log messages immediately as they occur.
   *
   * @param enabled - Whether to enable debug logging (default: false)
   *
   * @example
   * ```typescript
   * // Create an enabled logger
   * const logger = new DebugLogger(true);
   *
   * // Create a disabled logger (no output)
   * const logger = new DebugLogger(false);
   * ```
   */
  constructor(enabled: boolean = false) {
    this.enabled = enabled;
    if (enabled) {
      this.logFile = `smig-debug-${format(new Date(), "yyyy-MM-dd-HHmmss")}.txt`;
    }
  }

  /**
   * Logs a message with optional structured data.
   *
   * This method writes a timestamped log entry immediately to the debug file.
   * Objects are automatically serialized to JSON for readability, while
   * primitive values are appended directly to the message.
   *
   * @param message - The log message to record
   * @param data - Optional data to include (objects will be JSON-serialized)
   *
   * @example
   * ```typescript
   * logger.log('Processing migration', { id: 'migration_001', tables: 3 });
   * logger.log('Migration completed successfully');
   * ```
   */
  log(message: string, data?: unknown): void {
    if (!this.enabled || !this.logFile) return;

    const timestamp = format(new Date(), "yyyy-MM-dd HH:mm:ss.SSS");
    let logMessage = `[${timestamp}] ${message}`;

    if (data !== undefined) {
      if (typeof data === "object") {
        logMessage += `\n${JSON.stringify(data, null, 2)}`;
      } else {
        logMessage += ` ${data}`;
      }
    }

    // Write immediately to file (fire-and-forget to avoid blocking)
    this.writeToFile(`${logMessage}\n`).catch(() => {
      // Silently ignore file write errors to prevent them from affecting the main operation
    });
  }

  /**
   * Writes a message immediately to the debug log file.
   *
   * @param content - The content to write to the file
   */
  private async writeToFile(content: string): Promise<void> {
    if (!this.logFile) return;

    try {
      if (!this.fileInitialized) {
        // Create the file with initial header on first write
        await writeFile(
          this.logFile,
          `=== SMIG Debug Log - ${format(new Date(), "yyyy-MM-dd HH:mm:ss")} ===\n`,
          "utf8",
        );
        this.fileInitialized = true;
      }

      // Append the new content
      await appendFile(this.logFile, content, "utf8");
    } catch (_error) {
      // Don't throw errors for logging failures, just silently continue
      // This prevents debug logging from breaking the main operation
    }
  }

  /**
   * Logs a schema object with structured formatting.
   *
   * This specialized method formats schema objects for easy reading in debug logs,
   * providing clear section headers and structured data representation.
   *
   * @param name - Descriptive name for the schema being logged
   * @param schema - The schema object to log
   */
  logSchema(name: string, schema: unknown): void {
    if (!this.enabled) return;

    this.log(`=== ${name} ===`);
    this.log("Schema representation:", schema);
    this.log(""); // Empty line for readability
  }

  /**
   * Returns whether debug logging is currently enabled.
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Returns the current debug log file path.
   */
  getLogFile(): string | null {
    return this.logFile;
  }
}

/** Global debug logger instance for use across the application */
let globalDebugLogger: DebugLogger | null = null;

/**
 * Sets the global debug logger instance.
 *
 * This function establishes a global logger that can be used throughout the
 * application via the convenience functions. This is typically called once
 * during application initialization.
 *
 * @param logger - The DebugLogger instance to use globally
 */
export function setDebugLogger(logger: DebugLogger): void {
  globalDebugLogger = logger;
}

/**
 * Returns the current global debug logger instance.
 *
 * @returns The global logger instance, or null if none is set
 */
export function getDebugLogger(): DebugLogger | null {
  return globalDebugLogger;
}

/**
 * Convenience function for logging to the global debug logger.
 *
 * This function provides a simple way to log debug messages without
 * directly accessing the global logger instance. If no global logger
 * is set, the call is silently ignored.
 *
 * @param message - The message to log
 * @param data - Optional data to include with the message
 *
 * @example
 * ```typescript
 * debugLog('Processing table', { name: 'users', fields: 5 });
 * ```
 */
export function debugLog(message: string, data?: unknown): void {
  // console.log(message, data);
  if (globalDebugLogger) {
    globalDebugLogger.log(message, data);
  }
}

/**
 * Convenience function for logging schema objects to the global debug logger.
 *
 * @param name - Descriptive name for the schema
 * @param schema - The schema object to log
 */
export function debugLogSchema(name: string, schema: unknown): void {
  if (globalDebugLogger) {
    globalDebugLogger.logSchema(name, schema);
  }
}
