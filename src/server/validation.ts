/* eslint-disable no-control-regex */
/**
 * Phase 4.1 — Centralized server-side input validation utilities.
 *
 * Every API handler in `src/server/api.ts` funnels user-controlled input
 * through the helpers in this module so validation rules live in exactly one
 * place. Khmer (and any other non-Latin) text is preserved verbatim — only
 * control characters, over-long values and structurally invalid data are
 * rejected.
 */

// --- Limits -----------------------------------------------------------------

export const LIMITS = {
  /** Maximum accepted JSON request body (bytes) for normal endpoints. */
  jsonBody: 256 * 1024,
  /** Maximum accepted JSON request body (bytes) for bulk image metadata. */
  uploadBody: 2 * 1024 * 1024,
  /** Maximum number of images accepted in a single upload request. */
  uploadBatch: 50,
  /** Maximum accepted per-image byte size reported by the client. */
  imageBytes: 15 * 1024 * 1024,
  /** Maximum accepted per-video byte size (100MB foundation limit). */
  videoBytes: 100 * 1024 * 1024,
  id: 128,
  shortText: 200,
  mediumText: 500,
  longText: 5000,
  url: 2048,
  searchQuery: 200,
  tags: 500,
} as const;

/** Image MIME types the archive actually renders. */
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

/** Video MIME types supported by the archive foundation. */
export const ALLOWED_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

export type AllowedVideoMimeType = (typeof ALLOWED_VIDEO_MIME_TYPES)[number];

// --- Primitives -------------------------------------------------------------

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Trims a user supplied string, removes control characters (keeping newlines
 * and tabs) and enforces a maximum length. Returns `null` when the value is
 * not a string or exceeds the limit.
 */
export function sanitizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(CONTROL_CHARS, "").trim();
  if (cleaned.length > maxLength) return null;
  return cleaned;
}

/** Same as {@link sanitizeText} but truncates instead of rejecting. */
export function clampText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(CONTROL_CHARS, "").trim();
  if (!cleaned) return undefined;
  return cleaned.slice(0, maxLength);
}

const ID_PATTERN = /^[A-Za-z0-9._:@-]+$/;

/**
 * Validates a resource identifier (festival/album/image/user id, visitor id).
 * Rejects path traversal, whitespace and injection-style payloads.
 */
export function parseId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > LIMITS.id) return null;
  if (!ID_PATTERN.test(trimmed)) return null;
  return trimmed;
}

/** Parses a bounded integer. Returns `null` for NaN/out-of-range values. */
export function parseBoundedInt(value: unknown, min: number, max: number): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

/** Parses an integer and clamps it into range instead of rejecting. */
export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

/** Validates a value against an allow-list, falling back when unknown. */
export function parseEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  return fallback;
}

/** Strict enum check — returns `null` for unexpected values. */
export function parseStrictEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  return null;
}

/** Accepts `YYYY-MM-DD` or a full ISO timestamp; returns `null` otherwise. */
export function parseDateParam(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 40) return null;
  if (!/^\d{4}-\d{2}-\d{2}([T ][\d:.]+Z?)?$/.test(trimmed)) return null;
  if (Number.isNaN(new Date(trimmed).getTime())) return null;
  return trimmed;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function parseEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length < 5 || trimmed.length > 254) return null;
  if (!EMAIL_PATTERN.test(trimmed)) return null;
  return trimmed;
}

// --- Pagination -------------------------------------------------------------

export interface Pagination {
  page: number;
  limit: number;
}

export function parsePagination(
  params: URLSearchParams,
  defaultLimit: number,
  maxLimit: number,
): Pagination {
  return {
    page: clampInt(params.get("page"), 1, 10_000, 1),
    limit: clampInt(params.get("limit"), 1, maxLimit, defaultLimit),
  };
}

// --- Image URL / MIME -------------------------------------------------------

const DANGEROUS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const SAFE_SCHEMES = new Set(["http:", "https:"]);

/**
 * Validates an image URL before it is persisted or served back to the archive.
 *
 * Accepted:
 *  - absolute `http:` / `https:` URLs (remote storage / CDN)
 *  - relative paths and bundled asset keys (e.g. `/uploads/abc.webp`, `/assets/fest-visak.jpg`)
 *
 * Rejected: `blob:`, `javascript:`, `data:`, `vbscript:`, `file:` and every other
 * scheme, plus control characters and over-long values.
 */
export function validateImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw || raw.length > LIMITS.url) return null;

  // Strip whitespace/control characters used to obfuscate schemes
  const collapsed = raw.replace(/[\s\u0000-\u001F\u007F]/g, "");
  if (!collapsed) return null;

  if (DANGEROUS_SCHEME.test(collapsed)) {
    const scheme = collapsed.slice(0, collapsed.indexOf(":") + 1).toLowerCase();
    if (!SAFE_SCHEMES.has(scheme)) return null;
    if (scheme === "http:" || scheme === "https:") {
      try {
        const parsed = new URL(collapsed);
        if (!parsed.hostname) return null;
      } catch {
        return null;
      }
    }
    return raw;
  }

  // Scheme-less value: relative path or bundled asset key.
  if (collapsed.startsWith("//")) return null; // protocol-relative — scheme unknown
  if (collapsed.includes("..")) return null; // path traversal
  return raw;
}

/**
 * Server-side MIME validation for uploads by string.
 */
export function validateImageMimeType(value: unknown): AllowedImageMimeType | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(normalized)
    ? (normalized as AllowedImageMimeType)
    : null;
}

/**
 * Binary magic bytes inspection for image uploads.
 * Detects real file signatures directly from bytes to prevent MIME spoofing.
 */
export function detectImageMagicBytes(buffer: Buffer): AllowedImageMimeType | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  // GIF: GIF87a or GIF89a (47 49 46 38 [37|39] 61)
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return "image/gif";
  }

  // WebP: RIFF (bytes 0-3) and WEBP (bytes 8-11)
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  // AVIF: bytes 4-11 contain ftypavif or ftypavis
  if (
    buffer[4] === 0x66 &&
    buffer[5] === 0x74 &&
    buffer[6] === 0x79 &&
    buffer[7] === 0x70 &&
    buffer[8] === 0x61 &&
    buffer[9] === 0x76 &&
    buffer[10] === 0x69 &&
    (buffer[11] === 0x66 || buffer[11] === 0x73)
  ) {
    return "image/avif";
  }

  return null;
}

/**
 * Server-side MIME validation for video uploads by string.
 */
export function validateVideoMimeType(value: unknown): AllowedVideoMimeType | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return (ALLOWED_VIDEO_MIME_TYPES as readonly string[]).includes(normalized)
    ? (normalized as AllowedVideoMimeType)
    : null;
}

/**
 * Binary magic bytes inspection for video uploads.
 * Detects real video file signatures directly from bytes to prevent MIME spoofing.
 * Supports: MP4 (ISO BMFF), WebM (EBML), and QuickTime (MOV).
 */
export function detectVideoMagicBytes(buffer: Buffer): AllowedVideoMimeType | null {
  if (buffer.length < 12) return null;

  // WebM: Starts with EBML Header (1A 45 DF A3)
  if (
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return "video/webm";
  }

  // MP4 / QuickTime: Check for 'ftyp' box at bytes 4-7
  if (
    buffer[4] === 0x66 && // 'f'
    buffer[5] === 0x74 && // 't'
    buffer[6] === 0x79 && // 'y'
    buffer[7] === 0x70    // 'p'
  ) {
    const brand = buffer.subarray(8, 12).toString("latin1");
    if (brand === "qt  ") {
      return "video/quicktime";
    }
    // Standard MP4 brands: isom, iso2, mp41, mp42, dash, avc1, M4V , MSNV, etc.
    return "video/mp4";
  }

  // Classic QuickTime MOV atoms at bytes 4-7: 'moov', 'mdat', 'wide', 'free'
  const atom = buffer.subarray(4, 8).toString("latin1");
  if (atom === "moov" || atom === "mdat" || atom === "wide" || atom === "free") {
    return "video/quicktime";
  }

  return null;
}

// --- Request bodies ---------------------------------------------------------

export type JsonBodyResult =
  { ok: true; data: Record<string, unknown> } | { ok: false; status: 400 | 413; error: string };

/**
 * Reads and parses a JSON request body while enforcing a hard size limit.
 * Oversized payloads are rejected with 413, malformed ones with 400.
 */
export async function readJsonBody(
  request: Request,
  maxBytes: number = LIMITS.jsonBody,
): Promise<JsonBodyResult> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { ok: false, status: 413, error: "សំណើមានទំហំធំពេក (Payload Too Large)។" };
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, status: 400, error: "ទិន្នន័យមិនត្រឹមត្រូវ។" };
  }

  if (text.length > maxBytes) {
    return { ok: false, status: 413, error: "សំណើមានទំហំធំពេក (Payload Too Large)។" };
  }

  if (!text.trim()) {
    return { ok: true, data: {} };
  }

  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, status: 400, error: "ទិន្នន័យមិនត្រឹមត្រូវ។" };
    }
    return { ok: true, data: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, status: 400, error: "ទិន្នន័យមិនត្រឹមត្រូវ។" };
  }
}
