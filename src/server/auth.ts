import { db, verifyPassword } from "./db";
import type { User, Permission } from "../types/auth";

export interface AuthContext {
  user: User | null;
  isAuthenticated: boolean;
  token?: string;
  hadSessionToken?: boolean;
}

// In-memory rate limiting map for login attempts: ip -> { count, expiresAt }
const loginRateLimit = new Map<string, { count: number; resetAt: number }>();

export function checkLoginRateLimit(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const entry = loginRateLimit.get(ip);

  if (!entry || entry.resetAt < now) {
    loginRateLimit.set(ip, { count: 1, resetAt: now + 5 * 60 * 1000 }); // 5 minutes window
    return { allowed: true };
  }

  if (entry.count >= 6) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfterSeconds: retryAfter };
  }

  entry.count += 1;
  return { allowed: true };
}

export function resetLoginRateLimit(ip: string) {
  loginRateLimit.delete(ip);
}

export function parseCookies(cookieHeader: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx > -1) {
      const key = pair.substring(0, idx).trim();
      let val = pair.substring(idx + 1).trim();
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1);
      }
      try {
        cookies[key] = decodeURIComponent(val);
      } catch {
        cookies[key] = val;
      }
    }
  }
  return cookies;
}

export function getSessionTokenFromRequest(request: Request): string | null {
  // 1. Check Cookie header
  const cookieHeader = request.headers.get("cookie");
  const cookies = parseCookies(cookieHeader);
  const sessionCookie = cookies["auth_session"];
  if (sessionCookie) {
    return sessionCookie.trim();
  }

  // 2. Check Authorization Bearer header
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }

  // 3. Check custom header
  const customHeader = request.headers.get("x-session-token");
  if (customHeader) {
    return customHeader.trim();
  }

  return null;
}

export function authenticateRequest(request: Request): AuthContext {
  const token = getSessionTokenFromRequest(request);
  if (!token) {
    return { user: null, isAuthenticated: false, hadSessionToken: false };
  }

  const session = db.getSession(token);
  if (!session) {
    // Session token provided but does not exist in DB (e.g. invalidated by a newer login)
    return { user: null, isAuthenticated: false, hadSessionToken: true };
  }

  const user = db.findUserById(session.userId);
  if (!user || user.status === "disabled") {
    // If account is disabled or deleted, reject session
    return { user: null, isAuthenticated: false, hadSessionToken: true };
  }

  // Super Admin: Enforce Single Active Session on every request
  if (user.role === "super_admin") {
    if (!db.isSuperAdminSessionActive(user.id, token)) {
      db.deleteSession(token);
      return { user: null, isAuthenticated: false, hadSessionToken: true };
    }
  }

  return {
    user,
    isAuthenticated: true,
    token,
    hadSessionToken: true,
  };
}

export function hasPermission(user: User | null, permission: Permission): boolean {
  if (!user) return false;
  if (user.status === "disabled") return false;
  // Super Admin has all permissions unconditionally
  if (user.role === "super_admin") return true;
  // Editors check their assigned permission list
  return user.permissions.includes(permission);
}

export function requireAuth(
  request: Request,
  requiredPermission?: Permission,
): { user: User } | Response {
  const auth = authenticateRequest(request);
  const { user, isAuthenticated, hadSessionToken } = auth;

  if (!isAuthenticated || !user) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (hadSessionToken) {
      headers["Set-Cookie"] = createClearSessionCookie();
      return new Response(
        JSON.stringify({
          success: false,
          code: "SESSION_INVALID",
          error:
            "Your session has ended because this Super Admin account was signed in on another device. Please log in again.",
        }),
        {
          status: 401,
          headers,
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        code: "UNAUTHORIZED",
        error: "សូម Login ជាមុនសិន ដើម្បីទទួលបានសិទ្ធិចូលដំណើរការ។",
      }),
      {
        status: 401,
        headers,
      },
    );
  }

  if (requiredPermission && !hasPermission(user, requiredPermission)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "លោកអ្នកមិនមានសិទ្ធិ (Permission Denied) ដើម្បីធ្វើសកម្មភាពនេះឡើយ។",
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return { user };
}

export function requireSuperAdmin(request: Request): { user: User } | Response {
  const auth = authenticateRequest(request);
  const { user, isAuthenticated, hadSessionToken } = auth;

  if (!isAuthenticated || !user) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (hadSessionToken) {
      headers["Set-Cookie"] = createClearSessionCookie();
      return new Response(
        JSON.stringify({
          success: false,
          code: "SESSION_INVALID",
          error:
            "Your session has ended because this Super Admin account was signed in on another device. Please log in again.",
        }),
        {
          status: 401,
          headers,
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        code: "UNAUTHORIZED",
        error: "សូម Login ជាមុនសិន។",
      }),
      {
        status: 401,
        headers,
      },
    );
  }

  if (user.role !== "super_admin") {
    return new Response(
      JSON.stringify({
        success: false,
        error: "មានតែ Super Admin តែម្នាក់គត់ដែលអាចដំណើរការមុខងារនេះបាន។",
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return { user };
}

export function createSessionCookie(token: string): string {
  // Secure HTTP-Only cookie, 7 days duration.
  // Use SameSite=None; Secure; Partitioned to allow cookies in both standalone browsers and embedded preview iframes on HTTPS.
  const maxAge = 7 * 24 * 60 * 60;
  return `auth_session=${encodeURIComponent(
    token,
  )}; Path=/; HttpOnly; SameSite=None; Secure; Partitioned; Max-Age=${maxAge}`;
}

export function createClearSessionCookie(): string {
  return `auth_session=; Path=/; HttpOnly; SameSite=None; Secure; Partitioned; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
