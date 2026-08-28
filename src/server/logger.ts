import crypto from "node:crypto";

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export interface LogContext {
  requestId?: string;
  method?: string;
  route?: string;
  status?: number;
  durationMs?: number;
  userId?: string;
  ip?: string;
  [key: string]: unknown;
}

const SENSITIVE_KEYS = new Set([
  "password",
  "password_hash",
  "passwordhash",
  "token",
  "cookie",
  "authorization",
  "session",
  "secret",
  "database_url",
  "databaseurl",
]);

/**
 * Strips sensitive keys and credentials from objects before logging
 */
export function sanitizeLogData(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map(sanitizeLogData);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else if (
      typeof val === "string" &&
      (val.startsWith("postgres://") || val.startsWith("postgresql://"))
    ) {
      sanitized[key] = "[REDACTED_DATABASE_URL]";
    } else if (typeof val === "object" && val !== null) {
      sanitized[key] = sanitizeLogData(val);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
}

/**
 * Validates or generates a safe Request ID
 */
export function getOrGenerateRequestId(request: Request): string {
  const headerId = request.headers.get("x-request-id")?.trim();
  if (headerId && /^[a-zA-Z0-9_-]{8,64}$/.test(headerId)) {
    return headerId;
  }
  return crypto.randomUUID();
}

/**
 * Structured server logger
 */
class ServerLogger {
  private formatLog(level: LogLevel, message: string, context?: LogContext, error?: unknown): void {
    const timestamp = new Date().toISOString();
    const cleanContext = context ? (sanitizeLogData(context) as LogContext) : {};

    let errorInfo: Record<string, unknown> | undefined;
    if (error instanceof Error) {
      errorInfo = {
        name: error.name,
        message: error.message,
      };
    } else if (error) {
      errorInfo = { message: String(error) };
    }

    const payload = {
      timestamp,
      level,
      message,
      ...cleanContext,
      ...(errorInfo ? { error: errorInfo } : {}),
    };

    const formatted = `[${timestamp}] [${level}] ${message} ${JSON.stringify(payload)}`;

    if (level === "ERROR") {
      console.error(formatted);
    } else if (level === "WARN") {
      console.warn(formatted);
    } else if (level === "INFO") {
      console.info(formatted);
    } else {
      console.log(formatted);
    }
  }

  public debug(message: string, context?: LogContext): void {
    if (process.env["NODE_ENV"] !== "production") {
      this.formatLog("DEBUG", message, context);
    }
  }

  public info(message: string, context?: LogContext): void {
    this.formatLog("INFO", message, context);
  }

  public warn(message: string, context?: LogContext, error?: unknown): void {
    this.formatLog("WARN", message, context, error);
  }

  public error(message: string, context?: LogContext, error?: unknown): void {
    this.formatLog("ERROR", message, context, error);
  }
}

export const logger = new ServerLogger();
