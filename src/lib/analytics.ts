/**
 * Wat Peareang Archive - Visitor Tracking & Analytics Client
 * Anonymous, privacy-friendly, non-blocking asynchronous tracking.
 */

const STORAGE_KEY_VISITOR_ID = "wp_archive_visitor_id";
const STORAGE_KEY_SESSION_INIT = "wp_archive_session_last_init";

/**
 * Generate or retrieve persistent anonymous visitor ID
 */
export function getVisitorId(): string {
  if (typeof window === "undefined") {
    return "server-ssr";
  }

  try {
    let visitorId = localStorage.getItem(STORAGE_KEY_VISITOR_ID);
    if (!visitorId) {
      visitorId =
        "v_" + Math.random().toString(36).substring(2, 12) + "_" + Date.now().toString(36);
      localStorage.setItem(STORAGE_KEY_VISITOR_ID, visitorId);
    }
    return visitorId;
  } catch {
    return "v_anon_" + Math.random().toString(36).substring(2, 10);
  }
}

/**
 * Detect simple device category for analytics
 */
export function detectDeviceCategory(): "mobile" | "tablet" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  const ua = navigator.userAgent.toLowerCase();
  if (
    /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/.test(
      ua,
    )
  ) {
    return "tablet";
  }
  if (/(mobi|ipod|phone|blackberry|opera mini|fennec|minimo|symbian|psp|nintendo)/.test(ua)) {
    return "mobile";
  }
  return "desktop";
}

/**
 * Initialize visitor session once per hour per tab
 */
export function initVisitorSession(): void {
  if (typeof window === "undefined") return;

  try {
    const visitorId = getVisitorId();
    const lastInit = sessionStorage.getItem(STORAGE_KEY_SESSION_INIT);
    const now = Date.now();

    // Re-init if more than 30 minutes in session
    if (lastInit && now - parseInt(lastInit, 10) < 30 * 60 * 1000) {
      return;
    }

    sessionStorage.setItem(STORAGE_KEY_SESSION_INIT, now.toString());
    const device = detectDeviceCategory();

    // Non-blocking fire-and-forget
    fetch("/api/analytics/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: visitorId,
        device,
        userAgent: navigator.userAgent,
      }),
      keepalive: true,
    }).catch(() => {
      // Non-blocking failure is ignored safely
    });
  } catch {
    // Ignore storage/network errors silently
  }
}

// Client-side debounce cache to avoid sending duplicate events from re-renders
const MAX_CLIENT_CACHE_SIZE = 200;
const clientViewCache = new Map<string, number>();

function setBoundedClientCache(key: string, timestamp: number): void {
  if (clientViewCache.size >= MAX_CLIENT_CACHE_SIZE) {
    const oldestKey = clientViewCache.keys().next().value;
    if (oldestKey) {
      clientViewCache.delete(oldestKey);
    }
  }
  clientViewCache.set(key, timestamp);
}

/**
 * Track page view
 */
export function trackPageView(path: string): void {
  if (typeof window === "undefined" || !path) return;

  const visitorId = getVisitorId();
  const cacheKey = `page:${path}`;
  const now = Date.now();
  const lastTime = clientViewCache.get(cacheKey);

  // Throttle duplicate page view within 15 seconds
  if (lastTime && now - lastTime < 15_000) {
    return;
  }
  setBoundedClientCache(cacheKey, now);

  fetch("/api/analytics/page-view", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path,
      visitorId,
    }),
    keepalive: true,
  }).catch(() => {});
}

/**
 * Track album view
 */
export function trackAlbumView(albumId: string): void {
  if (typeof window === "undefined" || !albumId) return;

  const visitorId = getVisitorId();
  const cacheKey = `album:${albumId}`;
  const now = Date.now();
  const lastTime = clientViewCache.get(cacheKey);

  // Throttle duplicate album view within 30 seconds
  if (lastTime && now - lastTime < 30_000) {
    return;
  }
  setBoundedClientCache(cacheKey, now);

  fetch("/api/analytics/view", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      resourceType: "album",
      resourceId: albumId,
      visitorId,
    }),
    keepalive: true,
  }).catch(() => {});
}

/**
 * Track image view (e.g. opened in Lightbox or viewed)
 */
export function trackImageView(imageId: string): void {
  if (typeof window === "undefined" || !imageId) return;

  const visitorId = getVisitorId();
  const cacheKey = `image:${imageId}`;
  const now = Date.now();
  const lastTime = clientViewCache.get(cacheKey);

  // Throttle duplicate image view within 30 seconds
  if (lastTime && now - lastTime < 30_000) {
    return;
  }
  setBoundedClientCache(cacheKey, now);

  fetch("/api/analytics/view", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      resourceType: "image",
      resourceId: imageId,
      visitorId,
    }),
    keepalive: true,
  }).catch(() => {});
}

// Client-side search tracking debounce
let lastSearchQuery = "";
let lastSearchTime = 0;

/**
 * Track search query execution asynchronously
 */
export function trackSearch(query: string, resultsCount: number): void {
  if (typeof window === "undefined" || !query || !query.trim()) return;

  const trimmed = query.trim();
  const now = Date.now();

  // Deduplicate rapid searches for exact same query within 4 seconds
  if (trimmed === lastSearchQuery && now - lastSearchTime < 4_000) {
    return;
  }
  lastSearchQuery = trimmed;
  lastSearchTime = now;

  const visitorId = getVisitorId();

  fetch("/api/analytics/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: trimmed,
      resultsCount,
      visitorId,
    }),
    keepalive: true,
  }).catch(() => {});
}

/**
 * Track user clicking/selecting a result from a search query
 */
export function trackSearchClick(
  query: string,
  selectedResultId: string,
  selectedResultType: "album" | "image" | "festival" = "album",
): void {
  if (typeof window === "undefined" || !selectedResultId) return;

  const visitorId = getVisitorId();

  fetch("/api/analytics/search-click", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: query?.trim() || "",
      visitorId,
      selectedResultId,
      selectedResultType,
    }),
    keepalive: true,
  }).catch(() => {});
}
