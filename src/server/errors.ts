import { logger } from "./logger";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "PAYLOAD_TOO_LARGE"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "DATABASE_ERROR";

export interface ApiErrorResponse {
  success: false;
  error: string;
  errorDetail?: {
    code: ApiErrorCode;
    message: string;
    requestId?: string;
  };
}

/**
 * Phase 4.1 / 4.3 — Safe error surfacing and centralized logging.
 *
 * Raw `Error.message` values from the database driver or filesystem can leak
 * connection strings, table names, file paths and query fragments. Handlers
 * log the real error server-side and return a stable, generic message to the
 * client instead.
 */
export function safeErrorMessage(error: unknown, fallback: string): string {
  if (error) {
    logger.error(`[API Error] ${fallback}`, undefined, error);
  }
  return fallback;
}

/**
 * Creates a standard safe JSON error Response object.
 */
export function createApiErrorResponse(
  status: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 500 | 503,
  message: string,
  code: ApiErrorCode = "INTERNAL_ERROR",
  requestId?: string,
  headers: Record<string, string> = {},
): Response {
  const payload: ApiErrorResponse = {
    success: false,
    error: message,
    errorDetail: {
      code,
      message,
      ...(requestId ? { requestId } : {}),
    },
  };

  const responseHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(requestId ? { "X-Request-ID": requestId } : {}),
    ...headers,
  };

  return new Response(JSON.stringify(payload), {
    status,
    headers: responseHeaders,
  });
}
