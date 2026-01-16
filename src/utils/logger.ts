/**
 * Centralized logging utility with configurable log levels.
 *
 * This module provides a flexible logging system that automatically adjusts
 * its behavior based on the environment:
 *
 * **Production behavior (default):**
 * - Only ERROR level logs are shown
 * - Minimizes console output for end users
 * - Can be configured to show more or completely silenced
 *
 * **Development behavior (auto-detected):**
 * - DEBUG level logging is enabled automatically
 * - Detected via `process.env.NODE_ENV === 'development'` or `localhost`
 *
 * **Log Levels (in order of severity):**
 * - `SILENT` (-1): No logs at all
 * - `ERROR` (0): Only errors
 * - `WARN` (1): Errors and warnings
 * - `INFO` (2): Errors, warnings, and info messages
 * - `DEBUG` (3): All messages including verbose debug output
 *
 * @example
 * ```ts
 * import { configureLogger, LogLevel } from 'map-gl-offline';
 *
 * // Enable verbose logging for debugging
 * configureLogger({ level: LogLevel.DEBUG });
 *
 * // Silence all logs in production
 * configureLogger({ level: LogLevel.SILENT });
 *
 * // Show warnings and errors
 * configureLogger({ level: LogLevel.WARN });
 * ```
 *
 * @module logger
 */

/**
 * Log level enumeration defining severity thresholds.
 * Higher values include all lower severity levels.
 */
export enum LogLevel {
  /** Completely silent - no logs will be output */
  SILENT = -1,
  /** Only error messages */
  ERROR = 0,
  /** Errors and warnings */
  WARN = 1,
  /** Errors, warnings, and informational messages */
  INFO = 2,
  /** All messages including verbose debug output */
  DEBUG = 3,
}

/**
 * Configuration options for the logger.
 */
export interface LoggerConfig {
  /**
   * Log level threshold. Messages below this level won't be logged.
   * @default LogLevel.ERROR in production, LogLevel.DEBUG in development
   */
  level?: LogLevel;
}

/**
 * Main Logger class providing centralized logging functionality.
 * @internal Use the exported `logger` singleton or `configureLogger()` function.
 */
class Logger {
  private level: LogLevel = LogLevel.ERROR; // Default to ERROR only for production

  /**
   * Configure the logger settings.
   * @param config - Configuration options
   */
  configure(config: LoggerConfig): void {
    if (config.level !== undefined) {
      this.level = config.level;
    }
  }

  /**
   * Set the current log level.
   * @param level - The new log level threshold
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get the current log level.
   * @returns The current log level threshold
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Check if a message at the given level should be logged.
   * @param messageLevel - The level of the message to check
   * @returns true if the message should be logged
   */
  private shouldLog(messageLevel: LogLevel): boolean {
    if (this.level === LogLevel.SILENT) {
      return false;
    }
    return this.level >= messageLevel;
  }

  /**
   * Log an error message. Outputs to `console.error`.
   * Shown at ERROR level and above (always shown unless SILENT).
   * @param message - The error message
   * @param args - Additional arguments to log
   */
  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(`❌ ${message}`, ...args);
    }
  }

  /**
   * Log a warning message. Outputs to `console.warn`.
   * Shown at WARN level and above.
   * @param message - The warning message
   * @param args - Additional arguments to log
   */
  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(`⚠️  ${message}`, ...args);
    }
  }

  /**
   * Log an informational message. Outputs to `console.log`.
   * Shown at INFO level and above.
   * @param message - The info message
   * @param args - Additional arguments to log
   */
  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(`ℹ️  ${message}`, ...args);
    }
  }

  /**
   * Log a debug message. Outputs to `console.debug`.
   * Shown at DEBUG level only. Can be filtered in browser devtools.
   * @param message - The debug message
   * @param args - Additional arguments to log
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(`🔍 ${message}`, ...args);
    }
  }

  /**
   * Log a success message. Outputs to `console.log`.
   * Shown at INFO level and above.
   * @param message - The success message
   * @param args - Additional arguments to log
   */
  success(message: string, ...args: unknown[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(`✅ ${message}`, ...args);
    }
  }

  /**
   * Create a scoped logger with a prefix for a specific module/component.
   * All messages from the scoped logger will be prefixed with the given name.
   * @param prefix - The prefix to add to all messages (e.g., 'TileService')
   * @returns A new ScopedLogger instance
   *
   * @example
   * ```ts
   * const tileLogger = logger.scope('TileService');
   * tileLogger.debug('Downloading tile'); // Output: 🔍 [TileService] Downloading tile
   * ```
   */
  scope(prefix: string): ScopedLogger {
    return new ScopedLogger(prefix, this);
  }
}

/**
 * A scoped logger that prefixes all messages with a module/component name.
 * Created using `logger.scope('PrefixName')`.
 *
 * @example
 * ```ts
 * const tileLogger = logger.scope('TileService');
 * tileLogger.info('Starting download'); // Output: ℹ️ [TileService] Starting download
 * ```
 */
class ScopedLogger {
  /**
   * @param prefix - The prefix to add to all messages
   * @param logger - The parent logger instance
   * @internal
   */
  constructor(
    private prefix: string,
    private logger: Logger
  ) {}

  /** Log an error message with the scope prefix */
  error(message: string, ...args: unknown[]): void {
    this.logger.error(`[${this.prefix}] ${message}`, ...args);
  }

  /** Log a warning message with the scope prefix */
  warn(message: string, ...args: unknown[]): void {
    this.logger.warn(`[${this.prefix}] ${message}`, ...args);
  }

  /** Log an info message with the scope prefix */
  info(message: string, ...args: unknown[]): void {
    this.logger.info(`[${this.prefix}] ${message}`, ...args);
  }

  /** Log a debug message with the scope prefix */
  debug(message: string, ...args: unknown[]): void {
    this.logger.debug(`[${this.prefix}] ${message}`, ...args);
  }

  /** Log a success message with the scope prefix */
  success(message: string, ...args: unknown[]): void {
    this.logger.success(`[${this.prefix}] ${message}`, ...args);
  }
}

/**
 * Global logger singleton instance.
 * Use this directly or create scoped loggers with `logger.scope()`.
 *
 * @example
 * ```ts
 * import { logger } from 'map-gl-offline';
 *
 * logger.info('Application started');
 * logger.error('Something went wrong', error);
 * ```
 */
export const logger = new Logger();

// Export classes for typing
export { ScopedLogger };

/**
 * Configure the global logger settings.
 * Call this early in your application to set logging preferences.
 *
 * @param config - Logger configuration options
 *
 * @example
 * ```ts
 * import { configureLogger, LogLevel } from 'map-gl-offline';
 *
 * // For development - verbose logging
 * configureLogger({ level: LogLevel.DEBUG });
 *
 * // For production - errors only (default)
 * configureLogger({ level: LogLevel.ERROR });
 *
 * // For production - completely silent
 * configureLogger({ level: LogLevel.SILENT });
 * ```
 */
export function configureLogger(config: LoggerConfig): void {
  logger.configure(config);
}

/**
 * Auto-detect development mode and set appropriate log level.
 * This works with Vite, Webpack, and other bundlers that replace process.env.NODE_ENV.
 * Also detects localhost for browser-based development.
 * @internal
 */
const isDevelopment = (() => {
  try {
    // Check for common development indicators
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
      return true;
    }
    // Check if running on localhost (browser environment)
    if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') {
      return true;
    }
    return false;
  } catch {
    return false;
  }
})();

// Set debug level in development by default
if (isDevelopment) {
  logger.setLevel(LogLevel.DEBUG);
}
