import { config } from "../config/config.ts";

/**
 * Log levels in order of increasing verbosity
 */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

/**
 * Current log level based on configuration
 */
const currentLogLevel = getLogLevelFromString(config.logging.level);

/**
 * Convert a string log level to enum value
 */
function getLogLevelFromString(level: string): LogLevel {
  switch (level.toLowerCase()) {
    case 'error': return LogLevel.ERROR;
    case 'warn': return LogLevel.WARN;
    case 'info': return LogLevel.INFO;
    case 'debug': return LogLevel.DEBUG;
    default: return LogLevel.INFO; // Default to INFO
  }
}

/**
 * Adds timestamp and context to log messages
 */
function formatLogMessage(level: string, context: string, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] [${context}] ${message}`;
}

/**
 * Format an error for better logging
 * This function properly handles different types of errors
 */
function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  
  // Handle Supabase and other API errors which are often objects with message properties
  if (error && typeof error === 'object') {
    // Try to get a message property if it exists
    if ('message' in error && typeof error.message === 'string') {
      return error.message;
    }
    
    // If there's an error property (common in API responses), try to extract data from it
    if ('error' in error && error.error && typeof error.error === 'object') {
      if ('message' in error.error && typeof error.error.message === 'string') {
        return error.error.message;
      }
    }
    
    // Last resort: convert to JSON string
    try {
      return JSON.stringify(error);
    } catch {
      return '[Complex Error Object]';
    }
  }
  
  // Default fallback
  return String(error);
}

/**
 * Logs an error message
 */
export function logError(context: string, message: string, error?: unknown): void {
  if (!config.logging.enabled || LogLevel.ERROR > currentLogLevel) return;
  
  let errorMsg = message;
  if (error) {
    errorMsg += ` Error: ${formatError(error)}`;
    console.error(formatLogMessage('ERROR', context, errorMsg));
    
    // If it's an Error object, also log the stack trace
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
  } else {
    console.error(formatLogMessage('ERROR', context, errorMsg));
  }
}

/**
 * Logs a warning message
 */
export function warn(context: string, message: string): void {
  if (!config.logging.enabled || LogLevel.WARN > currentLogLevel) return;
  console.warn(formatLogMessage('WARN', context, message));
}

/**
 * Logs an informational message
 */
export function info(context: string, message: string): void {
  if (!config.logging.enabled || LogLevel.INFO > currentLogLevel) return;
  console.log(formatLogMessage('INFO', context, message));
}

/**
 * Logs a debug message
 */
export function debug(context: string, message: string): void {
  if (!config.logging.enabled || LogLevel.DEBUG > currentLogLevel) return;
  console.log(formatLogMessage('DEBUG', context, message));
}

/**
 * Creates a logger instance with a fixed context
 */
export function createLogger(context: string) {
  return {
    error: (message: string, error?: unknown) => logError(context, message, error),
    warn: (message: string) => warn(context, message),
    info: (message: string) => info(context, message),
    debug: (message: string) => debug(context, message),
  };
} 