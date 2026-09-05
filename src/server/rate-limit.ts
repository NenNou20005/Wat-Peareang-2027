/**
 * Phase 4.1 — Scoped in-memory rate limiting.
 *
 * LIMITATION (documented for production): counters live in the memory of a
 * single server instance. Behind multiple instances each replica keeps its own
 * window, so effective limits multiply by the replica count. Moving to a
 * shared store (Redis / Postgres) is a later-phase concern; this module keeps
 * the call-sites unchanged when that happens.
 */

export type RateLimitScope =
  | "auth"
  | "interaction"
  | "search"
  | "analytics"
  | "admin_read"
  | "admin_write"
  | "upload"
  | "export"
  | "private_unlock";

interface ScopeConfig {
  /** Maximum requests allowed per key inside the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

const SCOPES: Record<RateLimitScope, ScopeConfig> = {
  // Login/logout/session probing — deliberately tight.
  auth: { limit: 20, windowMs: 5 * 60_000 },
  // Private archive unlock — strict anti-brute-force (5 attempts / 15 minutes)
  private_unlock: { limit: 5, windowMs: 15 * 60_000 },
  // Likes / favorites / view tracking from the public site.
  interaction: { limit: 120, windowMs: 60_000 },
  search: { limit: 60, windowMs: 60_000 },
  analytics: { limit: 240, windowMs: 60_000 },
  admin_read: { limit: 300, windowMs: 60_000 },
  admin_write: { limit: 90, windowMs: 60_000 },
  upload: { limit: 30, windowMs: 60_000 },
  export: { limit: 10, windowMs: 60_000 },
};

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 20_000;
let lastPrune = 0;

function prune(now: number) {
  if (now - lastPrune < 60_000 && buckets.size < MAX_TRACKED_KEYS) return;
  lastPrune = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // Hard cap: if a flood still keeps the map huge, drop everything rather than
  // letting the process grow without bound.
  if (buckets.size > MAX_TRACKED_KEYS) buckets.clear();
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfterSeconds: number;
}

/**
 * Consumes one token for `scope` + `key` (usually the client IP, optionally
 * combined with a user id).
 */
export function checkRateLimit(scope: RateLimitScope, key: string): RateLimitResult {
  const config = SCOPES[scope];
  const now = Date.now();
  prune(now);

  const bucketKey = `${scope}:${key}`;
  const existing = buckets.get(bucketKey);

  if (!existing || existing.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + config.windowMs });
    return {
      allowed: true,
      remaining: config.limit - 1,
      limit: config.limit,
      retryAfterSeconds: 0,
    };
  }

  if (existing.count >= config.limit) {
    return {
      allowed: false,
      remaining: 0,
      limit: config.limit,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: config.limit - existing.count,
    limit: config.limit,
    retryAfterSeconds: 0,
  };
}

/** Standard 429 JSON response with `Retry-After`. */
export function rateLimitedResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: `សំណើច្រើនពេក។ សូមរង់ចាំ ${result.retryAfterSeconds} វិនាទី មុនព្យាយាមម្តងទៀត។`,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
      },
    },
  );
}

export function resetRateLimit(scope: RateLimitScope, key: string): void {
  const bucketKey = `${scope}:${key}`;
  buckets.delete(bucketKey);
}

/**
 * Convenience guard: returns a ready-to-return 429 `Response` when the caller
 * is over the limit, otherwise `null`.
 */
export function enforceRateLimit(scope: RateLimitScope, key: string): Response | null {
  const result = checkRateLimit(scope, key);
  return result.allowed ? null : rateLimitedResponse(result);
}
