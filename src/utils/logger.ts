/**
 * Centralized logging utility with configurable log levels
 * Following the project guidelines: only console.warn and console.error in production
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

class Logger {
  private level: LogLevel = LogLevel.WARN; // Default to WARN for production
  private isDevelopment: boolean = process.env.NODE_ENV === 'development';

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Log error messages (always shown)
   */
  error(message: string, ...args: unknown[]): void {
    if (this.level >= LogLevel.ERROR) {
      console.error(`❌ ${message}`, ...args);
    }
  }

  /**
   * Log warning messages (shown in production)
   */
  warn(message: string, ...args: unknown[]): void {
    if (this.level >= LogLevel.WARN) {
      console.warn(`⚠️  ${message}`, ...args);
    }
  }

  /**
   * Log info messages (development only)
   */
  info(message: string, ...args: unknown[]): void {
    if (this.isDevelopment && this.level >= LogLevel.INFO) {
      console.warn(`ℹ️  ${message}`, ...args);
    }
  }

  /**
   * Log debug messages (development only, verbose)
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.isDevelopment && this.level >= LogLevel.DEBUG) {
      console.warn(`🔍 ${message}`, ...args);
    }
  }

  /**
   * Log success messages
   */
  success(message: string, ...args: unknown[]): void {
    if (this.level >= LogLevel.WARN) {
      console.warn(`✅ ${message}`, ...args);
    }
  }

  /**
   * Create a scoped logger with a prefix
   */
  scope(prefix: string): ScopedLogger {
    return new ScopedLogger(prefix, this);
  }
}

class ScopedLogger {
  constructor(
    private prefix: string,
    private logger: Logger
  ) {}

  error(message: string, ...args: unknown[]): void {
    this.logger.error(`[${this.prefix}] ${message}`, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.logger.warn(`[${this.prefix}] ${message}`, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.logger.info(`[${this.prefix}] ${message}`, ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    this.logger.debug(`[${this.prefix}] ${message}`, ...args);
  }

  success(message: string, ...args: unknown[]): void {
    this.logger.success(`[${this.prefix}] ${message}`, ...args);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export classes for typing
export { ScopedLogger };

// Set debug level in development
if (process.env.NODE_ENV === 'development') {
  logger.setLevel(LogLevel.DEBUG);
}
