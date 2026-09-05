import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { db, verifyPassword, hashPassword } from "./db";
import { checkDbHealth, getDrizzleDb } from "../db/index";
import * as schema from "../db/schema";
import { eq, asc, desc, sql, and } from "drizzle-orm";
import { getOrGenerateRequestId, logger } from "./logger";
import { getStorageProvider } from "./storage/index";
import { detectImageMagicBytes, detectVideoMagicBytes, LIMITS, sanitizeText } from "./validation";
import {
  getPostgresFestivals,
  getPostgresYears,
  getPostgresAlbums,
  getPostgresAlbumById,
  getPostgresPhotosForAlbum,
  getPostgresVideosForAlbum,
  getPostgresArchiveStats,
  searchPostgresArchive,
  searchPostgresVideos,
  getAdminDashboardMetrics,
  getAdminAlbumsPaginated,
  getAdminImagesPaginated,
  getDiverseArchiveImages,
  getAllArchiveImagesForSlideshow,
  getArchiveAlbumsWithAllImages,
  getAdminTrashItems,
  validateHierarchyIntegrity,
  getPostgresEventsForFestivalYear,
  getPostgresEventById,
  getPostgresAdminEvents,
  createPostgresEvent,
  updatePostgresEvent,
  deletePostgresEvent,
  reorderPostgresEvents,
} from "./queries";
import {
  authenticateRequest,
  requireAuth,
  requireSuperAdmin,
  createSessionCookie,
  createClearSessionCookie,
  checkLoginRateLimit,
  resetLoginRateLimit,
  parseCookies,
} from "./auth";
import { checkRateLimit, resetRateLimit, rateLimitedResponse } from "./rate-limit";
import type { Permission, UserRole, User } from "../types/auth";

// --- PRIVATE ARCHIVE SESSION REGISTRY (In-memory token store with TTL) ---
interface PrivateArchiveSession {
  userId: string;
  expiresAt: number;
}
declare global {
  var _watPeareangPrivateArchiveSessions: Map<string, PrivateArchiveSession> | undefined;
}
const privateArchiveSessions: Map<string, PrivateArchiveSession> =
  globalThis._watPeareangPrivateArchiveSessions ??
  (globalThis._watPeareangPrivateArchiveSessions = new Map<string, PrivateArchiveSession>());

function getPrivateArchiveTokenFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  const cookies = parseCookies(cookieHeader);
  const sessionCookie = cookies["private_archive_session"];
  if (sessionCookie) return sessionCookie.trim();

  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }

  const customHeader = request.headers.get("x-private-archive-token");
  if (customHeader) return customHeader.trim();

  return null;
}

function isPrivateArchiveSessionValid(token: string | null): boolean {
  if (!token) return false;
  const session = privateArchiveSessions.get(token);
  if (!session) return false;
  if (session.expiresAt <= Date.now()) {
    privateArchiveSessions.delete(token);
    return false;
  }
  return true;
}

function isSecureConnection(request?: Request): boolean {
  if (request) {
    if (
      request.url.startsWith("https://") ||
      request.headers.get("x-forwarded-proto") === "https" ||
      request.headers.get("x-forwarded-ssl") === "on"
    ) {
      return true;
    }
    try {
      const url = new URL(request.url);
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
        return false;
      }
    } catch {
      // fallback
    }
  }
  return process.env["NODE_ENV"] === "production";
}

function createPrivateSessionCookie(token: string, request?: Request): string {
  const maxAge = 2 * 60 * 60; // 2 hours
  const secureFlag = isSecureConnection(request) ? "; Secure" : "";
  return `private_archive_session=${encodeURIComponent(
    token,
  )}; Path=/; HttpOnly; SameSite=Lax${secureFlag}; Max-Age=${maxAge}`;
}

function createClearPrivateSessionCookie(request?: Request): string {
  const secureFlag = isSecureConnection(request) ? "; Secure" : "";
  return `private_archive_session=; Path=/; HttpOnly; SameSite=Lax${secureFlag}; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

async function getPrivateArchiveCodeHash(): Promise<string> {
  const drizzle = getDrizzleDb();
  if (drizzle) {
    try {
      const rows = await drizzle
        .select()
        .from(schema.siteSettings)
        .where(eq(schema.siteSettings.key, "private_archive_code_hash"))
        .limit(1);
      if (rows[0]?.value) {
        return rows[0].value;
      }
    } catch (err) {
      console.warn("[Private Archive Settings Error]:", err);
    }
  }

  // Initial provisioning fallback from env or default '2027'
  const rawInitialCode = process.env["PRIVATE_ARCHIVE_CODE"] || "2027";
  const initialHash = hashPassword(rawInitialCode);

  if (drizzle) {
    try {
      await drizzle
        .insert(schema.siteSettings)
        .values({
          key: "private_archive_code_hash",
          value: initialHash,
          description: "Hashed access code for Private Archive",
        })
        .onConflictDoNothing();
    } catch {
      // ignore conflict
    }
  }

  return initialHash;
}


export async function handleApiRequest(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;

  // Handle uploaded static images
  if (pathname.startsWith("/uploads/") && method === "GET") {
    const filename = path.basename(pathname);
    const uploadDir = path.resolve(process.cwd(), "public", "uploads");
    const filePath = path.join(uploadDir, filename);

    if (!filePath.startsWith(uploadDir)) {
      return new Response("Forbidden", { status: 403 });
    }

    if (fs.existsSync(filePath)) {
      const fileStat = await fs.promises.stat(filePath);
      const ext = path.extname(filename).toLowerCase();
      const mimeMap: Record<string, string> = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".avif": "image/avif",
      };
      const contentType = mimeMap[ext] || "application/octet-stream";
      const buffer = await fs.promises.readFile(filePath);

      return new Response(buffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(fileStat.size),
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }
    return new Response("Not Found", { status: 404 });
  }

  // Handle Cloudflare R2 served images proxy fallback
  if (pathname.startsWith("/api/storage/r2/") && method === "GET") {
    const rawKey = pathname.replace("/api/storage/r2/", "");
    const key = decodeURIComponent(rawKey);
    const storage = getStorageProvider();
    if (storage.getObject) {
      const obj = await storage.getObject(key);
      if (obj) {
        return new Response(Buffer.from(obj.body), {
          status: 200,
          headers: {
            "Content-Type": obj.contentType,
            "Content-Length": String(obj.contentLength),
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }
    }
    return new Response("Not Found", { status: 404 });
  }

  if (!pathname.startsWith("/api/")) {
    return null;
  }

  const requestId = getOrGenerateRequestId(request);
  const startTime = Date.now();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  const userAgent = request.headers.get("user-agent") || undefined;

  // JSON helper with security headers and Request ID
  const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json",
        "X-Request-ID": requestId,
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        ...headers,
      },
    });

  // --- HEALTH & READINESS ENDPOINTS ---

  // GET /api/health
  if (pathname === "/api/health" && method === "GET") {
    const dbHealth = await checkDbHealth();
    const isPostgresActive = dbHealth.connected;
    return json({
      status: "ok",
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      database: {
        type: isPostgresActive ? "postgresql" : "local_sync",
        connected: isPostgresActive,
        latencyMs: dbHealth.latencyMs,
      },
      version: "1.0.0",
    });
  }

  // GET /api/ready
  if (pathname === "/api/ready" && method === "GET") {
    const dbHealth = await checkDbHealth();
    const isProd = process.env["NODE_ENV"] === "production";

    // In production, PostgreSQL must be configured and connected
    if (isProd && !dbHealth.connected) {
      return json(
        {
          ready: false,
          error: "Production database unreachable or unconfigured (PostgreSQL required)",
          database: dbHealth,
        },
        503,
      );
    }

    if (dbHealth.configured && !dbHealth.connected) {
      return json(
        {
          ready: false,
          error: "Database configured but unreachable",
          database: dbHealth,
        },
        503,
      );
    }
    return json({
      ready: true,
      database: dbHealth,
    });
  }

  // --- 1. AUTH ENDPOINTS ---

  // POST /api/auth/login
  if (pathname === "/api/auth/login" && method === "POST") {
    const rateCheck = checkLoginRateLimit(ip);
    if (!rateCheck.allowed) {
      return json(
        {
          success: false,
          error: `បានព្យាយាម Login ច្រើនដងពេក។ សូមរង់ចាំ ${rateCheck.retryAfterSeconds} វិនាទី មុនព្យាយាមម្តងទៀត។`,
        },
        429,
      );
    }

    try {
      const body = await request.json();
      const { email, password } = body;

      if (!email || !password || typeof email !== "string" || typeof password !== "string") {
        return json(
          { success: false, error: "សូមបញ្ចូលអ៊ីមែល និងពាក្យសម្ងាត់ឱ្យបានត្រឹមត្រូវ។" },
          400,
        );
      }

      let userWithHash = await db.findUserByEmailAsync(email);
      if (!userWithHash) {
        userWithHash = db.findUserByEmail(email);
      }

      // Timing-safe verification & generic error response for security
      if (!userWithHash || !verifyPassword(password, userWithHash.passwordHash)) {
        return json(
          {
            success: false,
            error: "អ៊ីមែល ឬ ពាក្យសម្ងាត់មិនត្រឹមត្រូវ។ សូមព្យាយាមម្តងទៀត។",
          },
          401,
        );
      }

      if (userWithHash.status === "disabled") {
        return json(
          {
            success: false,
            error: "គណនីនេះត្រូវបានផ្អាកដំណើរការ (Disabled)។ សូមទាក់ទង Super Admin។",
          },
          403,
        );
      }

      // Reset login rate limit on successful login
      resetLoginRateLimit(ip);

      // Create session
      const session = await db.createSessionAsync(userWithHash.id, userAgent, ip);
      db.updateLastLogin(userWithHash.id);

      db.logActivity({
        userId: userWithHash.id,
        userName: userWithHash.name,
        userRole: userWithHash.role,
        action: "LOGIN",
        resource: "AUTH",
        details: `បានចូលប្រើប្រាស់ប្រព័ន្ធ (${userWithHash.role})`,
        ip,
      });

      const { passwordHash: _, ...safeUser } = userWithHash;

      return json({ success: true, user: safeUser }, 200, {
        "Set-Cookie": createSessionCookie(session.token),
      });
    } catch {
      return json({ success: false, error: "មានបញ្ហាបច្ចេកទេសក្នុងការ Login។" }, 500);
    }
  }

  // POST /api/auth/logout
  if (pathname === "/api/auth/logout" && method === "POST") {
    const auth = await authenticateRequest(request);
    if (auth.token) {
      await db.deleteSessionAsync(auth.token);
    }
    if (auth.user) {
      db.logActivity({
        userId: auth.user.id,
        userName: auth.user.name,
        userRole: auth.user.role,
        action: "LOGOUT",
        resource: "AUTH",
        details: "បានចាកចេញពីប្រព័ន្ធ",
        ip,
      });
    }

    return json({ success: true }, 200, { "Set-Cookie": createClearSessionCookie() });
  }

  // GET /api/auth/me
  if (pathname === "/api/auth/me" && method === "GET") {
    const auth = await authenticateRequest(request);
    if (!auth.isAuthenticated || !auth.user) {
      if (auth.hadSessionToken) {
        return json(
          {
            success: false,
            code: "SESSION_INVALID",
            user: null,
            error:
              "Your session has ended because this Super Admin account was signed in on another device. Please log in again.",
          },
          401,
          {
            "Set-Cookie": createClearSessionCookie(),
          },
        );
      }
      return json({ success: true, user: null });
    }
    return json({ success: true, user: auth.user });
  }

  // --- 2. ADMIN DASHBOARD STATS (LIVE POSTGRESQL + LOCAL SYNC) ---
  if (pathname === "/api/admin/dashboard" && method === "GET") {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    try {
      const liveMetrics = await getAdminDashboardMetrics();
      const localStats = db.getDashboardStats();
      const usersList = db.getUsers();

      return json({
        success: true,
        data: {
          totalFestivals: liveMetrics.totalFestivals || localStats.totalFestivals,
          totalYears: liveMetrics.totalYears || localStats.totalYears,
          totalAlbums: liveMetrics.totalAlbums || localStats.totalAlbums,
          totalImages: liveMetrics.totalImages || localStats.totalImages,
          totalUsers: usersList.length,
          activeUsers: usersList.filter((u) => u.status === "active").length,
          totalViews: liveMetrics.totalViews || 1420,
          totalLikes: liveMetrics.totalLikes || 420,
          totalFavorites: liveMetrics.totalFavorites || 85,
          totalTrash: liveMetrics.totalTrash,
          isPostgresConnected: liveMetrics.isPostgresConnected || localStats.isPostgresConnected,
          recentActivities:
            liveMetrics.recentActivities.length > 0
              ? liveMetrics.recentActivities
              : localStats.recentActivities,
          recentImages:
            liveMetrics.recentImages.length > 0
              ? liveMetrics.recentImages
              : localStats.recentImages,
        },
      });
    } catch {
      const localStats = db.getDashboardStats();
      return json({ success: true, data: localStats });
    }
  }

  // --- 3. USERS & EDITORS MANAGEMENT (SUPER ADMIN / ADMIN ONLY) ---
  if (pathname.startsWith("/api/admin/users") || pathname.startsWith("/api/admin/editors")) {
    const isUsersRoute = pathname.startsWith("/api/admin/users");
    const basePath = isUsersRoute ? "/api/admin/users" : "/api/admin/editors";

    const auth = await requireAuth(request, "manage_users");
    if (auth instanceof Response) return auth;
    const currentUser = auth.user;

    // GET /api/admin/users or /api/admin/editors
    if ((pathname === basePath || pathname === `${basePath}/`) && method === "GET") {
      const users = db.getUsers();
      return json({ success: true, data: users });
    }

    // POST /api/admin/users or /api/admin/editors
    if ((pathname === basePath || pathname === `${basePath}/`) && method === "POST") {
      try {
        const body = await request.json();
        const { name, email, password, role, permissions } = body;

        if (!name || !email || !password) {
          return json(
            {
              success: false,
              error: "សូមបំពេញព័ត៌មានឱ្យបានគ្រប់គ្រាន់ (ឈ្មោះ, អ៊ីមែល, ពាក្យសម្ងាត់)។",
            },
            400,
          );
        }

        if (password.length < 6) {
          return json({ success: false, error: "ពាក្យសម្ងាត់ត្រូវមានយ៉ាងហោចណាស់ ៦ តួអក្សរ។" }, 400);
        }

        const validPermissions: Permission[] = Array.isArray(permissions) ? permissions : [];
        const validRole: UserRole = ["super_admin", "admin", "editor", "viewer"].includes(role)
          ? role
          : "editor";

        const result = db.createUser(
          {
            name,
            email,
            password,
            role: validRole,
            permissions: validPermissions,
          },
          currentUser.id,
        );

        if (result.error) {
          return json({ success: false, error: result.error }, 400);
        }

        return json({ success: true, data: result.user }, 201);
      } catch {
        return json({ success: false, error: "ទិន្នន័យមិនត្រឹមត្រូវ។" }, 400);
      }
    }

    // PUT /api/admin/users/:id or /api/admin/editors/:id
    if (pathname.startsWith(`${basePath}/`) && method === "PUT") {
      const targetId = pathname.replace(`${basePath}/`, "").trim();
      try {
        const body = await request.json();
        const result = db.updateUser(targetId, body, currentUser.id);
        if (result.error) {
          return json({ success: false, error: result.error }, 400);
        }
        return json({ success: true, data: result.user });
      } catch {
        return json({ success: false, error: "ទិន្នន័យមិនត្រឹមត្រូវ។" }, 400);
      }
    }

    // DELETE /api/admin/users/:id or /api/admin/editors/:id
    if (pathname.startsWith(`${basePath}/`) && method === "DELETE") {
      const targetId = pathname.replace(`${basePath}/`, "").trim();
      const result = db.deleteUser(targetId, currentUser.id);
      if (!result.success) {
        return json({ success: false, error: result.error }, 400);
      }
      return json({ success: true });
    }
  }

  // --- 4. FESTIVALS MANAGEMENT (POSTGRESQL + DRIZZLE AUTHORITATIVE) ---
  if (pathname.startsWith("/api/admin/festivals")) {
    if (pathname === "/api/admin/festivals" && method === "GET") {
      try {
        const drizzle = getDrizzleDb();
        if (drizzle) {
          const rows = await drizzle
            .select()
            .from(schema.festivals)
            .where(sql`${schema.festivals.status} != 'trashed'`)
            .orderBy(asc(schema.festivals.createdAt));
          const list = rows.map((r) => ({
            id: r.id,
            name: r.name,
            emoji: r.emoji,
            accent: r.accent,
            month: r.month,
            coverUrl: r.coverUrl || undefined,
            description: r.description || undefined,
            status: r.status,
            isCustom: r.isCustom,
            createdAt: r.createdAt ? r.createdAt.toISOString() : undefined,
            updatedAt: r.updatedAt ? r.updatedAt.toISOString() : undefined,
          }));
          return json({ success: true, data: list });
        }
      } catch (err) {
        logger.error("Failed to read admin festivals from PostgreSQL", { error: err });
      }
      return json({ success: true, data: [] });
    }

    const auth = await requireAuth(request, "manage_festivals");
    if (auth instanceof Response) return auth;
    const currentUser = auth.user;

    // POST /api/admin/festivals (Create Festival in PostgreSQL)
    if (pathname === "/api/admin/festivals" && method === "POST") {
      const drizzle = getDrizzleDb();
      if (!drizzle) return json({ success: false, error: "Database connection unavailable" }, 500);

      try {
        const body = await request.json();
        const { id, name, emoji, accent, month, description, coverUrl, cover, isCustom, status } =
          body;
        if (
          !name ||
          typeof name !== "string" ||
          !name.trim() ||
          !emoji ||
          typeof emoji !== "string" ||
          !emoji.trim()
        ) {
          return json({ success: false, error: "សូមបញ្ចូលឈ្មោះ និងរូបសញ្ញាបុណ្យ។" }, 400);
        }

        const festId = typeof id === "string" && id.trim() ? id.trim() : `fest-${Date.now()}`;

        // Check if ID already exists
        const existing = await drizzle
          .select({ id: schema.festivals.id })
          .from(schema.festivals)
          .where(eq(schema.festivals.id, festId))
          .limit(1);

        if (existing.length > 0) {
          return json(
            { success: false, error: "ID ពិធីបុណ្យនេះមានរួចហើយ សូមជ្រើសរើស ID ផ្សេង។" },
            400,
          );
        }

        const now = new Date();
        const newRecord = {
          id: festId,
          name: name.trim(),
          emoji: emoji.trim(),
          accent:
            typeof accent === "string" && accent.trim() ? accent.trim() : "oklch(0.74 0.132 76)",
          month: typeof month === "string" && month.trim() ? month.trim() : "ពេញមួយឆ្នាំ",
          description: description ? String(description).trim() : null,
          coverUrl: coverUrl || cover || null,
          isCustom: isCustom !== undefined ? Boolean(isCustom) : true,
          status: typeof status === "string" && status.trim() ? status.trim() : "published",
          createdAt: now,
          updatedAt: now,
        };

        await drizzle.insert(schema.festivals).values(newRecord);

        db.logActivity({
          userId: currentUser.id,
          userName: currentUser.name,
          userRole: currentUser.role,
          action: "CREATE_FESTIVAL",
          resource: "FESTIVAL",
          resourceId: festId,
          details: `បានបង្កើតពិធីបុណ្យ «${newRecord.name}» (ID: ${festId})`,
          ip,
        });

        const rows = await drizzle
          .select()
          .from(schema.festivals)
          .where(sql`${schema.festivals.status} != 'trashed'`)
          .orderBy(asc(schema.festivals.createdAt));
        const list = rows.map((r) => ({
          id: r.id,
          name: r.name,
          emoji: r.emoji,
          accent: r.accent,
          month: r.month,
          coverUrl: r.coverUrl || undefined,
          description: r.description || undefined,
          status: r.status,
          isCustom: r.isCustom,
          createdAt: r.createdAt ? r.createdAt.toISOString() : undefined,
          updatedAt: r.updatedAt ? r.updatedAt.toISOString() : undefined,
        }));

        return json({ success: true, data: list }, 201);
      } catch (err: unknown) {
        const errorString = err instanceof Error ? err.message : String(err);
        const errorCode =
          typeof err === "object" && err !== null && "code" in err
            ? String((err as { code: unknown }).code)
            : "";
        if (
          errorString.includes("unique constraint") ||
          errorString.includes("duplicate key") ||
          errorString.includes("festivals_pkey") ||
          errorCode === "23505"
        ) {
          return json(
            { success: false, error: "ID ពិធីបុណ្យនេះមានរួចហើយ សូមជ្រើសរើស ID ផ្សេង។" },
            400,
          );
        }
        return json({ success: false, error: "ទិន្នន័យមិនត្រឹមត្រូវ។" }, 400);
      }
    }

    // PUT /api/admin/festivals/:id (Update Festival in PostgreSQL)
    if (pathname.startsWith("/api/admin/festivals/") && method === "PUT") {
      const targetId = pathname.replace("/api/admin/festivals/", "").trim();
      const drizzle = getDrizzleDb();
      if (!drizzle) return json({ success: false, error: "Database connection unavailable" }, 500);

      try {
        const existing = await drizzle
          .select()
          .from(schema.festivals)
          .where(eq(schema.festivals.id, targetId))
          .limit(1);

        const targetRecord = existing[0];
        if (!targetRecord) {
          return json({ success: false, error: "រកមិនឃើញពិធីបុណ្យនេះឡើយ។" }, 404);
        }

        const body = await request.json();
        const updateData: Partial<typeof schema.festivals.$inferInsert> = {
          updatedAt: new Date(),
        };
        if (body.name !== undefined) updateData.name = String(body.name).trim();
        if (body.emoji !== undefined) updateData.emoji = String(body.emoji).trim();
        if (body.accent !== undefined) updateData.accent = String(body.accent).trim();
        if (body.month !== undefined) updateData.month = String(body.month).trim();
        if (body.description !== undefined)
          updateData.description = body.description ? String(body.description).trim() : null;
        if (body.coverUrl !== undefined || body.cover !== undefined) {
          updateData.coverUrl = body.coverUrl || body.cover || null;
        }
        if (body.status !== undefined) updateData.status = String(body.status);
        if (body.isCustom !== undefined) updateData.isCustom = Boolean(body.isCustom);

        await drizzle
          .update(schema.festivals)
          .set(updateData)
          .where(eq(schema.festivals.id, targetId));

        db.logActivity({
          userId: currentUser.id,
          userName: currentUser.name,
          userRole: currentUser.role,
          action: "UPDATE_FESTIVAL",
          resource: "FESTIVAL",
          resourceId: targetId,
          details: `បានកែសម្រួលព័ត៌មានពិធីបុណ្យ "${updateData.name || targetRecord.name}"`,
          ip,
        });

        const rows = await drizzle
          .select()
          .from(schema.festivals)
          .where(sql`${schema.festivals.status} != 'trashed'`)
          .orderBy(asc(schema.festivals.createdAt));
        const list = rows.map((r) => ({
          id: r.id,
          name: r.name,
          emoji: r.emoji,
          accent: r.accent,
          month: r.month,
          coverUrl: r.coverUrl || undefined,
          description: r.description || undefined,
          status: r.status,
          isCustom: r.isCustom,
          createdAt: r.createdAt ? r.createdAt.toISOString() : undefined,
          updatedAt: r.updatedAt ? r.updatedAt.toISOString() : undefined,
        }));

        return json({ success: true, data: list });
      } catch (err) {
        logger.error("Failed to update festival in PostgreSQL", { error: err, targetId });
        return json({ success: false, error: "ទិន្នន័យមិនត្រឹមត្រូវ។" }, 400);
      }
    }

    // POST /api/admin/festivals/:id/trash (Soft Delete)
    if (
      pathname.startsWith("/api/admin/festivals/") &&
      pathname.endsWith("/trash") &&
      method === "POST"
    ) {
      const targetId = pathname.replace("/api/admin/festivals/", "").replace("/trash", "").trim();
      const drizzle = getDrizzleDb();
      if (!drizzle) return json({ success: false, error: "Database connection unavailable" }, 500);

      try {
        const existing = await drizzle
          .select()
          .from(schema.festivals)
          .where(eq(schema.festivals.id, targetId))
          .limit(1);

        const targetRecord = existing[0];
        if (!targetRecord) {
          return json({ success: false, error: "រកមិនឃើញពិធីបុណ្យនេះឡើយ។" }, 404);
        }

        await drizzle
          .update(schema.festivals)
          .set({ status: "trashed", updatedAt: new Date() })
          .where(eq(schema.festivals.id, targetId));

        db.logActivity({
          userId: currentUser.id,
          userName: currentUser.name,
          userRole: currentUser.role,
          action: "TRASH_FESTIVAL",
          resource: "FESTIVAL",
          resourceId: targetId,
          details: `បានផ្លាស់ទីពិធីបុណ្យ "${targetRecord.name}" ទៅកាន់ធុងសំរាម`,
          ip,
        });

        return json({ success: true, message: "បានផ្លាស់ទីទៅកាន់ធុងសំរាមរួចរាល់។" });
      } catch (err) {
        logger.error("Failed to trash festival in PostgreSQL", { error: err, targetId });
        return json({ success: false, error: "Failed to trash festival" }, 500);
      }
    }

    // POST /api/admin/festivals/:id/restore (Restore)
    if (
      pathname.startsWith("/api/admin/festivals/") &&
      pathname.endsWith("/restore") &&
      method === "POST"
    ) {
      const targetId = pathname.replace("/api/admin/festivals/", "").replace("/restore", "").trim();
      const drizzle = getDrizzleDb();
      if (!drizzle) return json({ success: false, error: "Database connection unavailable" }, 500);

      try {
        const existing = await drizzle
          .select()
          .from(schema.festivals)
          .where(eq(schema.festivals.id, targetId))
          .limit(1);

        const targetRecord = existing[0];
        if (!targetRecord) {
          return json({ success: false, error: "រកមិនឃើញពិធីបុណ្យនេះឡើយ។" }, 404);
        }

        await drizzle
          .update(schema.festivals)
          .set({ status: "published", updatedAt: new Date() })
          .where(eq(schema.festivals.id, targetId));

        db.logActivity({
          userId: currentUser.id,
          userName: currentUser.name,
          userRole: currentUser.role,
          action: "RESTORE_FESTIVAL",
          resource: "FESTIVAL",
          resourceId: targetId,
          details: `បានស្តារពិធីបុណ្យ "${targetRecord.name}" ឡើងវិញ`,
          ip,
        });

        return json({ success: true, message: "បានស្តារឡើងវិញដោយជោគជ័យ។" });
      } catch (err) {
        logger.error("Failed to restore festival in PostgreSQL", { error: err, targetId });
        return json({ success: false, error: "Failed to restore festival" }, 500);
      }
    }

    // DELETE /api/admin/festivals/:id/permanent (Permanent Delete)
    if (
      pathname.startsWith("/api/admin/festivals/") &&
      pathname.endsWith("/permanent") &&
      method === "DELETE"
    ) {
      const targetId = pathname
        .replace("/api/admin/festivals/", "")
        .replace("/permanent", "")
        .trim();
      const drizzle = getDrizzleDb();
      if (!drizzle) return json({ success: false, error: "Database connection unavailable" }, 500);

      try {
        const existing = await drizzle
          .select()
          .from(schema.festivals)
          .where(eq(schema.festivals.id, targetId))
          .limit(1);

        const targetRecord = existing[0];
        if (!targetRecord) {
          return json({ success: false, error: "រកមិនឃើញពិធីបុណ្យនេះឡើយ។" }, 404);
        }

        await drizzle.delete(schema.festivals).where(eq(schema.festivals.id, targetId));

        db.logActivity({
          userId: currentUser.id,
          userName: currentUser.name,
          userRole: currentUser.role,
          action: "PERMANENT_DELETE_FESTIVAL",
          resource: "FESTIVAL",
          resourceId: targetId,
          details: `បានលុបពិធីបុណ្យ "${targetRecord.name}" ជាអចិន្ត្រៃយ៍`,
          ip,
        });

        return json({ success: true, message: "បានលុបពិធីបុណ្យជាអចិន្ត្រៃយ៍។" });
      } catch (err) {
        logger.error("Failed to permanently delete festival from PostgreSQL", {
          error: err,
          targetId,
        });
        return json({ success: false, error: "Failed to delete festival" }, 500);
      }
    }

    // DELETE /api/admin/festivals/:id (Soft Delete Default)
    if (pathname.startsWith("/api/admin/festivals/") && method === "DELETE") {
      const targetId = pathname.replace("/api/admin/festivals/", "").trim();
      const drizzle = getDrizzleDb();
      if (!drizzle) return json({ success: false, error: "Database connection unavailable" }, 500);

      try {
        const existing = await drizzle
          .select()
          .from(schema.festivals)
          .where(eq(schema.festivals.id, targetId))
          .limit(1);

        const targetRecord = existing[0];
        if (!targetRecord) {
          return json({ success: false, error: "រកមិនឃើញពិធីបុណ្យនេះឡើយ។" }, 404);
        }

        await drizzle
          .update(schema.festivals)
          .set({ status: "trashed", updatedAt: new Date() })
          .where(eq(schema.festivals.id, targetId));

        db.logActivity({
          userId: currentUser.id,
          userName: currentUser.name,
          userRole: currentUser.role,
          action: "TRASH_FESTIVAL",
          resource: "FESTIVAL",
          resourceId: targetId,
          details: `បានផ្លាស់ទីពិធីបុណ្យ "${targetRecord.name}" ទៅកាន់ធុងសំរាម`,
          ip,
        });

        return json({ success: true, message: "បានផ្លាស់ទីទៅកាន់ធុងសំរាមរួចរាល់។" });
      } catch (err) {
        logger.error("Failed to trash festival in PostgreSQL", { error: err, targetId });
        return json({ success: false, error: "Failed to trash festival" }, 500);
      }
    }
  }

  // --- 5. YEARS MANAGEMENT ---
  if (pathname.startsWith("/api/admin/years")) {
    if (pathname === "/api/admin/years" && method === "GET") {
      const drizzle = getDrizzleDb();
      try {
        if (drizzle) {
          const rows = await drizzle
            .select({ year: schema.years.year })
            .from(schema.years)
            .orderBy(desc(schema.years.year));
          return json({ success: true, data: rows.map((r) => r.year) });
        }
      } catch (err) {
        logger.error("Failed to read admin years from PostgreSQL", { error: err });
      }
      return json({ success: true, data: db.getYears() });
    }

    const auth = await requireAuth(request, "manage_years");
    if (auth instanceof Response) return auth;
    const currentUser = auth.user;

    // POST /api/admin/years
    if (pathname === "/api/admin/years" && method === "POST") {
      try {
        const body = await request.json();
        const y = Number(body.year);
        if (!y || isNaN(y) || y < 1900 || y > 2100) {
          return json(
            { success: false, error: "សូមបញ្ចូលឆ្នាំឱ្យបានត្រឹមត្រូវ (ឧទាហរណ៍៖ 2026)។" },
            400,
          );
        }
        const result = db.addYear(y, currentUser);
        if (!result.success) return json({ success: false, error: result.error }, 400);
        return json({ success: true, data: db.getYears() }, 201);
      } catch {
        return json({ success: false, error: "ទិន្នន័យមិនត្រឹមត្រូវ។" }, 400);
      }
    }

    // POST /api/admin/years/:year/trash
    if (
      pathname.startsWith("/api/admin/years/") &&
      pathname.endsWith("/trash") &&
      method === "POST"
    ) {
      const y = Number(pathname.replace("/api/admin/years/", "").replace("/trash", "").trim());
      const result = db.trashYear(y, currentUser);
      if (!result.success) return json({ success: false, error: result.error }, 400);
      return json({ success: true, message: "បានដកឆ្នាំចេញពីបញ្ជីសកម្ម។" });
    }

    // DELETE /api/admin/years/:year
    if (pathname.startsWith("/api/admin/years/") && method === "DELETE") {
      const y = Number(pathname.replace("/api/admin/years/", "").trim());
      const result = db.trashYear(y, currentUser);
      if (!result.success) return json({ success: false, error: result.error }, 400);
      return json({ success: true, data: db.getYears() });
    }
  }

  // --- 5.5. EVENTS MANAGEMENT (POSTGRESQL AUTHORITATIVE) ---
  if (pathname.startsWith("/api/admin/events")) {
    const auth = await requireAuth(request, "manage_albums");
    if (auth instanceof Response) return auth;
    const currentUser = auth.user;

    // POST /api/admin/events/reorder
    if (pathname === "/api/admin/events/reorder" && method === "POST") {
      try {
        const body = await request.json();
        const { eventIds } = body;
        if (!Array.isArray(eventIds) || eventIds.length === 0) {
          return json({ success: false, error: "Invalid event IDs array" }, 400);
        }
        await reorderPostgresEvents(eventIds);
        return json({ success: true, message: "បានរៀបលំដាប់ពិធីការដោយជោគជ័យ។" });
      } catch (err) {
        logger.error("Failed to reorder events", { error: err });
        return json({ success: false, error: "Failed to reorder events" }, 500);
      }
    }

    // GET /api/admin/events
    if (pathname === "/api/admin/events" && method === "GET") {
      const page = Number(url.searchParams.get("page") || "1");
      const limit = Number(url.searchParams.get("limit") || "50");
      const search = url.searchParams.get("search") || undefined;
      const festivalId = url.searchParams.get("festivalId") || undefined;
      const yearParam = url.searchParams.get("year");
      const year = yearParam ? Number(yearParam) : undefined;

      try {
        const result = await getPostgresAdminEvents({
          search,
          festivalId,
          year: isNaN(year as number) ? undefined : year,
          page,
          limit,
        });
        return json({ success: true, ...result });
      } catch (err) {
        logger.error("Failed to fetch admin events", { error: err });
        return json({ success: false, error: "Failed to fetch events" }, 500);
      }
    }

    // POST /api/admin/events
    if (pathname === "/api/admin/events" && method === "POST") {
      try {
        const body = await request.json();
        const {
          festivalId,
          year,
          nameKh,
          nameEn,
          description,
          eventDate,
          location,
          icon,
          coverImage,
          status,
          sortOrder,
        } = body;

        if (!festivalId || !year || !nameKh || !nameKh.trim()) {
          return json(
            {
              success: false,
              error: "សូមបំពេញព័ត៌មានចាំបាច់ (ពិធីបុណ្យ, ឆ្នាំ, ឈ្មោះពិធីការជាភាសាខ្មែរ)។",
            },
            400,
          );
        }

        const created = await createPostgresEvent({
          festivalId: festivalId.trim(),
          year: Number(year),
          nameKh: nameKh.trim(),
          nameEn: nameEn?.trim() || undefined,
          description: description?.trim() || undefined,
          eventDate: eventDate?.trim() || undefined,
          location: location?.trim() || "វត្តពារាំង",
          icon: icon?.trim() || "🎉",
          coverImage: coverImage?.trim() || undefined,
          status: status || "published",
          sortOrder: sortOrder ? Number(sortOrder) : 0,
        });

        db.logActivity({
          userId: currentUser.id,
          userName: currentUser.name,
          userRole: currentUser.role,
          action: "CREATE_EVENT",
          resource: "EVENT",
          resourceId: created.id,
          details: `បានបង្កើតពិធីការថ្មី «${created.nameKh}» សម្រាប់ ${created.festivalId} ឆ្នាំ ${created.year}`,
          ip,
        });

        return json({ success: true, event: created }, 201);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to create event";
        return json({ success: false, error: msg }, 400);
      }
    }

    // PUT /api/admin/events/:id
    if (pathname.startsWith("/api/admin/events/") && method === "PUT") {
      const eventId = pathname.replace("/api/admin/events/", "").trim();
      try {
        const body = await request.json();
        const updated = await updatePostgresEvent(eventId, body);

        db.logActivity({
          userId: currentUser.id,
          userName: currentUser.name,
          userRole: currentUser.role,
          action: "UPDATE_EVENT",
          resource: "EVENT",
          resourceId: eventId,
          details: `បានកែសម្រួលពិធីការ «${updated.nameKh}»`,
          ip,
        });

        return json({ success: true, event: updated });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to update event";
        return json({ success: false, error: msg }, 400);
      }
    }

    // DELETE /api/admin/events/:id
    if (pathname.startsWith("/api/admin/events/") && method === "DELETE") {
      const eventId = pathname.replace("/api/admin/events/", "").trim();
      try {
        await deletePostgresEvent(eventId);

        db.logActivity({
          userId: currentUser.id,
          userName: currentUser.name,
          userRole: currentUser.role,
          action: "DELETE_EVENT",
          resource: "EVENT",
          resourceId: eventId,
          details: `បានលុបពិធីការ (ID: ${eventId}) (Albums ត្រូវបានរក្សាទុកជាធម្មតា)`,
          ip,
        });

        return json({
          success: true,
          message: "បានលុបពិធីការដោយជោគជ័យ (Albums និងរូបថតត្រូវបានរក្សាទុកជាធម្មតា)។",
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to delete event";
        return json({ success: false, error: msg }, 500);
      }
    }
  }

  // --- 6. ALBUMS MANAGEMENT (WITH PAGINATION & FILTERS) ---
  if (pathname.startsWith("/api/admin/albums")) {
    if (pathname === "/api/admin/albums" && method === "GET") {
      const page = Number(url.searchParams.get("page") || "1");
      const limit = Number(url.searchParams.get("limit") || "20");
      const search = url.searchParams.get("search") || undefined;
      const festivalId = url.searchParams.get("festivalId") || undefined;
      const yearParam = url.searchParams.get("year");
      const year = yearParam ? Number(yearParam) : undefined;
      const status = url.searchParams.get("status") || undefined;

      try {
        const paginated = await getAdminAlbumsPaginated({
          page,
          limit,
          search,
          festivalId,
          year: isNaN(year as number) ? undefined : year,
          status,
        });
        return json({ success: true, ...paginated });
      } catch (err) {
        logger.error("Failed to fetch admin albums from PostgreSQL", { error: err });
        return json({ success: false, error: "Failed to fetch albums" }, 500);
      }
    }

    const auth = await requireAuth(request, "manage_albums");
    if (auth instanceof Response) return auth;
    const currentUser = auth.user;

    // POST /api/admin/albums
    if (pathname === "/api/admin/albums" && method === "POST") {
      try {
        const body = await request.json();
        const { festivalId, year, eventId, location, title, description, coverImage } = body;
        const numYear = Number(year);
        if (!festivalId || !numYear || isNaN(numYear) || !title || !title.trim()) {
          return json(
            {
              success: false,
              error: "សូមបំពេញព័ត៌មាន Album ឱ្យបានពេញលេញ (ពិធីបុណ្យ, ឆ្នាំ, ចំណងជើង)។",
            },
            400,
          );
        }

        const cleanEventId = eventId && typeof eventId === "string" && eventId.trim() ? eventId.trim() : null;

        // Validate hierarchy integrity
        const validation = await validateHierarchyIntegrity({
          festivalId,
          year: numYear,
          eventId: cleanEventId,
        });
        if (!validation.valid) {
          return json({ success: false, error: validation.error || "Hierarchy validation failed" }, 400);
        }

        const drizzle = getDrizzleDb();
        if (drizzle) {
          // Verify festival exists
          const [fest] = await drizzle
            .select()
            .from(schema.festivals)
            .where(eq(schema.festivals.id, festivalId))
            .limit(1);

          if (!fest) {
            return json(
              { success: false, error: `រកមិនឃើញពិធីបុណ្យកូដ «${festivalId}» ក្នុងទិន្នន័យឡើយ។` },
              400,
            );
          }

          // Ensure year exists in schema.years
          await drizzle.insert(schema.years).values({ year: numYear }).onConflictDoNothing();

          // Standard canonical album ID
          let candidateId = `${festivalId}-${numYear}`;
          const [existingAlbum] = await drizzle
            .select()
            .from(schema.albums)
            .where(eq(schema.albums.id, candidateId))
            .limit(1);

          if (existingAlbum) {
            candidateId = `${festivalId}-${numYear}-${Date.now().toString(36)}`;
          }

          const albumRecord = {
            id: candidateId,
            festivalId,
            year: numYear,
            eventId: cleanEventId,
            title: title.trim(),
            location: (location && location.trim()) || "វត្តពារាំង",
            description: (description && description.trim()) || null,
            coverImage: (coverImage && coverImage.trim()) || fest.coverUrl || null,
            photoCount: 0,
            status: "published",
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          await drizzle.insert(schema.albums).values(albumRecord);

          db.logActivity({
            userId: currentUser.id,
            userName: currentUser.name,
            userRole: currentUser.role,
            action: "ADD_ALBUM",
            resource: "ALBUM",
            resourceId: candidateId,
            details: `បានបង្កើត Album «${albumRecord.title}» ឆ្នាំ ${albumRecord.year}`,
            ip,
          });

          return json(
            {
              success: true,
              data: {
                ...albumRecord,
                createdAt: albumRecord.createdAt.toISOString(),
                updatedAt: albumRecord.updatedAt.toISOString(),
              },
            },
            201,
          );
        } else {
          // In-memory fallback
          const newAlbum = {
            id: `${festivalId}-${numYear}`,
            festivalId,
            year: numYear,
            location: location || "វត្តពារាំង",
            title: title.trim(),
            description: description || undefined,
            coverImage: coverImage || undefined,
            photoCount: 0,
            status: "published",
            createdAt: new Date().toISOString(),
          };
          const result = db.addAlbum(newAlbum, currentUser);
          if (!result.success) return json({ success: false, error: result.error }, 400);
          return json({ success: true, data: newAlbum }, 201);
        }
      } catch (err: unknown) {
        logger.error("Failed to create album in PostgreSQL", { error: err });
        const msg = err instanceof Error ? err.message : "ទិន្នន័យមិនត្រឹមត្រូវ។";
        return json({ success: false, error: msg }, 400);
      }
    }

    // POST /api/admin/albums/:id/trash (Soft Delete)
    if (
      pathname.startsWith("/api/admin/albums/") &&
      pathname.endsWith("/trash") &&
      method === "POST"
    ) {
      const targetId = pathname.replace("/api/admin/albums/", "").replace("/trash", "").trim();
      const result = await db.trashAlbum(targetId, currentUser);
      if (!result.success) return json({ success: false, error: result.error }, 400);
      return json({ success: true, message: "បានផ្លាស់ទី Album ទៅកាន់ធុងសំរាមរួចរាល់។" });
    }

    // POST /api/admin/albums/:id/restore (Restore from Trash)
    if (
      pathname.startsWith("/api/admin/albums/") &&
      pathname.endsWith("/restore") &&
      method === "POST"
    ) {
      const targetId = pathname.replace("/api/admin/albums/", "").replace("/restore", "").trim();
      const result = await db.restoreAlbum(targetId, currentUser);
      if (!result.success) return json({ success: false, error: result.error }, 400);
      return json({ success: true, message: "បានស្តារ Album ឡើងវិញដោយជោគជ័យ។" });
    }

    // DELETE /api/admin/albums/:id/permanent (Super Admin Permanent Delete)
    if (
      pathname.startsWith("/api/admin/albums/") &&
      pathname.endsWith("/permanent") &&
      method === "DELETE"
    ) {
      const targetId = pathname.replace("/api/admin/albums/", "").replace("/permanent", "").trim();
      const result = await db.permanentDeleteAlbum(targetId, currentUser);
      if (!result.success) return json({ success: false, error: result.error }, 400);
      return json({ success: true, message: "បានលុប Album ជាអចិន្ត្រៃយ៍។" });
    }

    // PUT /api/admin/albums/:id
    if (pathname.startsWith("/api/admin/albums/") && method === "PUT") {
      const targetId = pathname.replace("/api/admin/albums/", "").trim();
      try {
        const body = await request.json();
        const result = await db.updateAlbum(targetId, body, currentUser);
        if (!result.success) return json({ success: false, error: result.error }, 400);
        return json({ success: true });
      } catch {
        return json({ success: false, error: "ទិន្នន័យមិនត្រឹមត្រូវ។" }, 400);
      }
    }

    // DELETE /api/admin/albums/:id (Defaults to Soft Delete Trash)
    if (pathname.startsWith("/api/admin/albums/") && method === "DELETE") {
      const targetId = pathname.replace("/api/admin/albums/", "").trim();
      const result = await db.trashAlbum(targetId, currentUser);
      if (!result.success) return json({ success: false, error: result.error }, 400);
      return json({ success: true, message: "បានផ្លាស់ទី Album ទៅកាន់ធុងសំរាមរួចរាល់។" });
    }
  }

  // --- 7. IMAGES MANAGEMENT & UPLOAD (PAGINATED & SECURE) ---
  if (pathname.startsWith("/api/admin/images")) {
    if (pathname === "/api/admin/images" && method === "GET") {
      const page = Number(url.searchParams.get("page") || "1");
      const limit = Number(url.searchParams.get("limit") || "24");
      const search = url.searchParams.get("search") || undefined;
      const albumId = url.searchParams.get("albumId") || undefined;
      const festivalId = url.searchParams.get("festivalId") || undefined;
      const yearParam = url.searchParams.get("year");
      const year = yearParam ? Number(yearParam) : undefined;
      const status = url.searchParams.get("status") || undefined;

      try {
        const paginated = await getAdminImagesPaginated({
          page,
          limit,
          search,
          albumId,
          festivalId,
          year: isNaN(year as number) ? undefined : year,
          status,
        });
        return json({ success: true, ...paginated });
      } catch (err) {
        logger.error("Failed to fetch admin images from PostgreSQL", { error: err });
        return json({ success: false, error: "Failed to fetch images" }, 500);
      }
    }

    // POST /api/admin/images/upload (Binary multipart image upload)
    if (pathname === "/api/admin/images/upload" && method === "POST") {
      const auth = await requireAuth(request, "upload_images");
      if (auth instanceof Response) return auth;
      const currentUser = auth.user;

      try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const albumId = (formData.get("albumId") as string) || "";
        const title = (formData.get("title") as string) || "";
        const photographer = (formData.get("photographer") as string) || "";
        const tags = (formData.get("tags") as string) || "";

        if (!file || typeof file.arrayBuffer !== "function") {
          return json({ success: false, error: "សូមជ្រើសរើសឯកសាររូបភាពដែលត្រូវ Upload។" }, 400);
        }

        if (!albumId) {
          return json({ success: false, error: "សូមជ្រើសរើស Album គោលដៅ។" }, 400);
        }

        const MAX_SIZE = 15 * 1024 * 1024; // 15MB
        if (file.size > MAX_SIZE) {
          return json({ success: false, error: "ទំហំរូបភាពធំជាងកំណត់ (អតិបរមា 15MB)។" }, 413);
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const detectedMime = detectImageMagicBytes(buffer);
        if (!detectedMime) {
          return json(
            {
              success: false,
              error:
                "ប្រភេទឯកសារមិនត្រឹមត្រូវឡើយ។ អនុញ្ញាតតែរូបភាព JPG, PNG, WEBP, GIF, AVIF ប៉ុណ្ណោះ។",
            },
            400,
          );
        }

        // Validate target album exists in PostgreSQL
        const drizzle = getDrizzleDb();
        if (drizzle) {
          const [foundAlbum] = await drizzle
            .select({ id: schema.albums.id })
            .from(schema.albums)
            .where(eq(schema.albums.id, albumId))
            .limit(1);
          if (!foundAlbum) {
            return json({ success: false, error: "រកមិនឃើញ Album គោលដៅក្នុងទិន្នន័យឡើយ។" }, 404);
          }
        }

        const storage = getStorageProvider();
        const stored = await storage.saveImage({
          buffer,
          originalFilename: file.name,
          mimeType: detectedMime,
        });

        const newImageId = `img-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
        const newImage = {
          id: newImageId,
          albumId,
          title: title.trim() || file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
          description: undefined,
          url: stored.url,
          thumbnailUrl: stored.url,
          size: stored.size,
          mimeType: stored.mimeType,
          photographer: photographer.trim() || "វត្តពារាំង",
          tags: tags.trim() || undefined,
          uploadedBy: currentUser.id,
          status: "published",
          createdAt: new Date().toISOString(),
        };

        try {
          if (drizzle) {
            await drizzle.insert(schema.images).values({
              id: newImage.id,
              albumId: newImage.albumId,
              title: newImage.title,
              description: newImage.description || null,
              url: newImage.url,
              thumbnailUrl: newImage.thumbnailUrl,
              size: newImage.size,
              mimeType: newImage.mimeType,
              photographer: newImage.photographer,
              tags: newImage.tags || null,
              status: newImage.status,
              uploadedBy: currentUser.id,
            });

            // Increment album photoCount in PostgreSQL
            await drizzle
              .update(schema.albums)
              .set({
                photoCount: sql`${schema.albums.photoCount} + 1`,
                updatedAt: new Date(),
              })
              .where(eq(schema.albums.id, newImage.albumId))
              .catch(() => {});
          }
          db.addImage(newImage, currentUser);

          logger.info("Image uploaded and persisted successfully", {
            imageId: newImage.id,
            albumId: newImage.albumId,
            url: newImage.url,
            size: newImage.size,
            uploadedBy: currentUser.name,
          });

          return json(
            {
              success: true,
              data: newImage,
              url: stored.url,
              message: "បានបង្ហោះរូបភាពដោយជោគជ័យ!",
            },
            201,
          );
        } catch (dbErr) {
          // Cleanup newly stored file if DB insertion failed
          await storage.deleteImage(stored.url).catch(() => {});
          logger.error("Failed to insert image record to database", {
            error: dbErr,
            albumId,
            url: stored.url,
          });
          return json(
            { success: false, error: "មានបញ្ហាក្នុងការរក្សាទុកព័ត៌មានរូបភាពក្នុងទិន្នន័យ។" },
            500,
          );
        }
      } catch (err) {
        logger.error("Unexpected error during image upload", { error: err });
        return json({ success: false, error: "មានបញ្ហាក្នុងដំណើរការ Upload រូបភាព។" }, 500);
      }
    }

    // POST /api/admin/images (Upload Image Metadata - JSON support with strict URL validation)
    if (pathname === "/api/admin/images" && method === "POST") {
      const auth = await requireAuth(request, "upload_images");
      if (auth instanceof Response) return auth;
      const currentUser = auth.user;

      try {
        const body = await request.json();
        const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];

        // Handle single or bulk upload
        const uploads = Array.isArray(body.images) ? body.images : [body];
        const createdImages = [];

        for (const item of uploads) {
          const {
            albumId,
            title,
            url: imageUrl,
            thumbnailUrl,
            size,
            mimeType,
            photographer,
            tags,
          } = item;
          if (!imageUrl || !albumId) {
            continue;
          }

          // Disallow blob URLs in persistent JSON payload
          if (imageUrl.startsWith("blob:")) {
            continue;
          }

          if (mimeType && !allowedMimes.includes(mimeType)) {
            continue;
          }

          if (size && size > 15 * 1024 * 1024) {
            continue;
          }

          const newImage = {
            id: `img-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
            albumId,
            title: title || "រូបភាពបណ្ណសារវត្តពារាំង",
            url: imageUrl,
            thumbnailUrl: thumbnailUrl || imageUrl,
            size: size || 1024 * 400,
            mimeType: mimeType || "image/jpeg",
            photographer: photographer || "វត្តពារាំង",
            tags: tags || undefined,
            uploadedBy: currentUser.id,
            status: "published",
            createdAt: new Date().toISOString(),
          };

          db.addImage(newImage, currentUser);
          createdImages.push(newImage);
        }

        if (createdImages.length === 0) {
          return json(
            {
              success: false,
              error: "មិនមានរូបភាពត្រឹមត្រូវត្រូវបានជ្រើសរើសឡើយ (មិនអនុញ្ញាត blob URLs)។",
            },
            400,
          );
        }

        return json({ success: true, data: createdImages, count: createdImages.length }, 201);
      } catch {
        return json({ success: false, error: "ទិន្នន័យមិនត្រឹមត្រូវ។" }, 400);
      }
    }

    // POST /api/admin/images/batch (Batch Operations: trash, restore, move, permanentDelete)
    if (pathname === "/api/admin/images/batch" && method === "POST") {
      const auth = await requireAuth(request, "edit_images");
      if (auth instanceof Response) return auth;
      const currentUser = auth.user;

      try {
        const body = await request.json();
        const { action, ids, targetAlbumId } = body;

        if (!action || !Array.isArray(ids) || ids.length === 0) {
          return json(
            { success: false, error: "សូមជ្រើសរើស Action និងរូបភាពយ៉ាងហោចណាស់មួយ។" },
            400,
          );
        }

        if (action === "trash") {
          const res = db.batchTrashImages(ids, currentUser);
          return json({
            success: true,
            affected: res.affected,
            message: `បានផ្លាស់ទីរូបភាពចំនួន ${res.affected} ទៅកាន់ធុងសំរាមរួចរាល់។`,
          });
        }

        if (action === "restore") {
          const res = db.batchRestoreImages(ids, currentUser);
          return json({
            success: true,
            affected: res.affected,
            message: `បានស្តាររូបភាពចំនួន ${res.affected} ឡើងវិញដោយជោគជ័យ។`,
          });
        }

        if (action === "move") {
          if (!targetAlbumId) {
            return json({ success: false, error: "សូមជ្រើសរើស Album គោលដៅ។" }, 400);
          }
          const res = db.batchMoveImages(ids, targetAlbumId, currentUser);
          return json({
            success: true,
            affected: res.affected,
            message: `បានផ្លាស់ប្តូរ Album នៃរូបភាពចំនួន ${res.affected} រួចរាល់។`,
          });
        }

        if (action === "update_tags") {
          const tags = typeof body.tags === "string" ? body.tags.trim() : "";
          const res = db.batchUpdateImageTags(ids, tags, currentUser);
          return json({
            success: true,
            affected: res.affected,
            message: `បានកែសម្រួល Tags នៃរូបភាពចំនួន ${res.affected} ដោយជោគជ័យ។`,
          });
        }

        if (action === "permanent_delete") {
          if (currentUser.role !== "super_admin") {
            return json(
              { success: false, error: "មានតែ Super Admin ប៉ុណ្ណោះដែលអាចលុបជាអចិន្ត្រៃយ៍បាន។" },
              403,
            );
          }
          let affected = 0;
          for (const id of ids) {
            const res = await db.permanentDeleteImage(id, currentUser);
            if (res.success) affected++;
          }
          return json({
            success: true,
            affected,
            message: `បានលុបរូបភាពចំនួន ${affected} ជាអចិន្ត្រៃយ៍។`,
          });
        }

        return json({ success: false, error: "Action មិនត្រឹមត្រូវ។" }, 400);
      } catch {
        return json({ success: false, error: "ទិន្នន័យមិនត្រឹមត្រូវ។" }, 400);
      }
    }

    // POST /api/admin/images/:id/trash (Soft Delete)
    if (
      pathname.startsWith("/api/admin/images/") &&
      pathname.endsWith("/trash") &&
      method === "POST"
    ) {
      const auth = await requireAuth(request, "delete_images");
      if (auth instanceof Response) return auth;
      const currentUser = auth.user;

      const targetId = pathname.replace("/api/admin/images/", "").replace("/trash", "").trim();
      const result = db.trashImage(targetId, currentUser);
      if (!result.success) return json({ success: false, error: result.error }, 400);
      return json({ success: true, message: "បានផ្លាស់ទីរូបភាពទៅកាន់ធុងសំរាមរួចរាល់។" });
    }

    // POST /api/admin/images/:id/restore (Restore from Trash)
    if (
      pathname.startsWith("/api/admin/images/") &&
      pathname.endsWith("/restore") &&
      method === "POST"
    ) {
      const auth = await requireAuth(request, "manage_trash");
      if (auth instanceof Response) return auth;
      const currentUser = auth.user;

      const targetId = pathname.replace("/api/admin/images/", "").replace("/restore", "").trim();
      const result = db.restoreImage(targetId, currentUser);
      if (!result.success) return json({ success: false, error: result.error }, 400);
      return json({ success: true, message: "បានស្តាររូបភាពឡើងវិញដោយជោគជ័យ។" });
    }

    // DELETE /api/admin/images/:id/permanent (Super Admin Permanent Delete)
    if (
      pathname.startsWith("/api/admin/images/") &&
      pathname.endsWith("/permanent") &&
      method === "DELETE"
    ) {
      const auth = await requireSuperAdmin(request);
      if (auth instanceof Response) return auth;
      const currentUser = auth.user;

      const targetId = pathname.replace("/api/admin/images/", "").replace("/permanent", "").trim();
      const result = await db.permanentDeleteImage(targetId, currentUser);
      if (!result.success) return json({ success: false, error: result.error }, 400);
      return json({ success: true, message: "បានលុបរូបភាពជាអចិន្ត្រៃយ៍។" });
    }

    // PUT /api/admin/images/:id (Update Metadata or Move to another album)
    if (pathname.startsWith("/api/admin/images/") && method === "PUT") {
      const auth = await requireAuth(request, "edit_images");
      if (auth instanceof Response) return auth;
      const currentUser = auth.user;

      const targetId = pathname.replace("/api/admin/images/", "").trim();
      try {
        const body = await request.json();
        const result = db.updateImage(targetId, body, currentUser);
        if (!result.success) return json({ success: false, error: result.error }, 400);
        return json({ success: true });
      } catch {
        return json({ success: false, error: "ទិន្នន័យមិនត្រឹមត្រូវ។" }, 400);
      }
    }

    // DELETE /api/admin/images/:id (Defaults to Soft Delete Trash)
    if (pathname.startsWith("/api/admin/images/") && method === "DELETE") {
      const auth = await requireAuth(request, "delete_images");
      if (auth instanceof Response) return auth;
      const currentUser = auth.user;

      const targetId = pathname.replace("/api/admin/images/", "").trim();
      const result = db.trashImage(targetId, currentUser);
      if (!result.success) return json({ success: false, error: result.error }, 400);
      return json({ success: true, message: "បានផ្លាស់ទីរូបភាពទៅកាន់ធុងសំរាមរួចរាល់។" });
    }
  }

  // --- 7.5. VIDEOS MANAGEMENT & UPLOAD ---
  if (pathname.startsWith("/api/admin/videos")) {
    // GET /api/admin/videos (List public videos by album or paginated)
    if (pathname === "/api/admin/videos" && method === "GET") {
      const auth = await requireAuth(request);
      if (auth instanceof Response) return auth;

      const albumId = url.searchParams.get("albumId") || undefined;
      const status = url.searchParams.get("status") || "published";

      const drizzle = getDrizzleDb();
      if (!drizzle) return json({ success: false, error: "Database unavailable" }, 503);

      try {
        const conditions = [];
        if (albumId) {
          conditions.push(eq(schema.videos.albumId, albumId));
        }
        if (status !== "all") {
          conditions.push(eq(schema.videos.status, status));
        }

        const videoList = await drizzle
          .select()
          .from(schema.videos)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(schema.videos.createdAt));

        return json({ success: true, data: videoList });
      } catch (err) {
        logger.error("Failed to list admin videos", { error: err });
        return json({ success: false, error: "Failed to load videos" }, 500);
      }
    }

    // POST /api/admin/videos/upload (Binary multipart video upload)
    if (pathname === "/api/admin/videos/upload" && method === "POST") {
      const auth = await requireAuth(request, "upload_images");
      if (auth instanceof Response) return auth;
      const currentUser = auth.user;

      // Rate limiting (reuse upload scope)
      const rl = checkRateLimit("upload", ip);
      if (!rl.allowed) {
        return rateLimitedResponse(rl);
      }

      // Early content-length check (100MB + 1MB multipart overhead)
      const declaredLength = Number(request.headers.get("content-length") || "0");
      if (declaredLength > LIMITS.videoBytes + 1024 * 1024) {
        return json({ success: false, error: "ទំហំវីដេអូធំជាងកំណត់ (អតិបរមា 100MB)។" }, 413);
      }

      try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const albumId = (formData.get("albumId") as string) || "";
        const title = (formData.get("title") as string) || "";
        const description = (formData.get("description") as string) || "";
        const durationParam = formData.get("duration");
        const duration = durationParam ? Number(durationParam) : null;
        const widthParam = formData.get("width");
        const width = widthParam ? Number(widthParam) : null;
        const heightParam = formData.get("height");
        const height = heightParam ? Number(heightParam) : null;

        if (!file || typeof file.arrayBuffer !== "function") {
          return json({ success: false, error: "សូមជ្រើសរើសឯកសារវីដេអូដែលត្រូវ Upload។" }, 400);
        }

        if (!albumId) {
          return json({ success: false, error: "សូមជ្រើសរើស Album គោលដៅ។" }, 400);
        }

        if (file.size > LIMITS.videoBytes) {
          return json({ success: false, error: "ទំហំវីដេអូធំជាងកំណត់ (អតិបរមា 100MB)។" }, 413);
        }

        // Validate target album exists in PostgreSQL
        const drizzle = getDrizzleDb();
        if (drizzle) {
          const [foundAlbum] = await drizzle
            .select({ id: schema.albums.id })
            .from(schema.albums)
            .where(eq(schema.albums.id, albumId))
            .limit(1);
          if (!foundAlbum) {
            return json({ success: false, error: "រកមិនឃើញ Album គោលដៅក្នុងទិន្នន័យឡើយ។" }, 404);
          }
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const detectedMime = detectVideoMagicBytes(buffer);
        if (!detectedMime) {
          return json(
            {
              success: false,
              error: "ប្រភេទឯកសារមិនត្រឹមត្រូវឡើយ។ អនុញ្ញាតតែវីដេអូ MP4, WebM, QuickTime (MOV) ប៉ុណ្ណោះ។",
            },
            400,
          );
        }

        const storage = getStorageProvider();
        let storedResult: { url: string; filename?: string; r2Key?: string; size: number; mimeType: string };

        if (typeof storage.saveVideo === "function") {
          storedResult = await storage.saveVideo({
            buffer,
            originalFilename: file.name,
            mimeType: detectedMime,
          });
        } else {
          return json({ success: false, error: "Storage driver does not support video saving" }, 500);
        }

        const newVideoId = `vid-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
        const safeTitle = sanitizeText(title, 200) || file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        const safeDesc = sanitizeText(description, 2000);

        try {
          if (drizzle) {
            await drizzle.insert(schema.videos).values({
              id: newVideoId,
              albumId,
              title: safeTitle,
              description: safeDesc || null,
              filename: file.name,
              mimeType: detectedMime,
              r2Key: storedResult.r2Key || storedResult.filename || null,
              url: storedResult.url,
              thumbnailUrl: null,
              size: storedResult.size,
              duration: duration && !isNaN(duration) ? duration : null,
              width: width && !isNaN(width) ? width : null,
              height: height && !isNaN(height) ? height : null,
              status: "published",
              uploadedBy: currentUser.id,
            });
          }

          db.logActivity({
            userId: currentUser.id,
            userName: currentUser.name,
            userRole: currentUser.role,
            action: "UPLOAD_VIDEO",
            resource: "VIDEO",
            resourceId: newVideoId,
            details: `បានបង្ហោះវីដេអូ «${safeTitle}» (${Math.round(storedResult.size / (1024 * 1024))}MB) ចូល Album ${albumId}`,
            ip,
          });

          return json(
            {
              success: true,
              data: {
                id: newVideoId,
                albumId,
                filename: file.name,
                mimeType: detectedMime,
                size: storedResult.size,
                title: safeTitle,
                description: safeDesc,
                url: storedResult.url,
              },
              message: "បានបង្ហោះវីដេអូដោយជោគជ័យ!",
            },
            201,
          );
        } catch (dbErr) {
          const keyToDelete = storedResult.r2Key || storedResult.filename;
          if (keyToDelete && typeof storage.deleteVideo === "function") {
            await storage.deleteVideo(keyToDelete).catch(() => {});
          }
          logger.error("Failed to insert video record", { error: dbErr });
          return json({ success: false, error: "មានបញ្ហាក្នុងការរក្សាទុកទិន្នន័យវីដេអូ។" }, 500);
        }
      } catch (err) {
        logger.error("Unexpected error during video upload", { error: err });
        return json({ success: false, error: "មានបញ្ហាក្នុងដំណើរការ Upload វីដេអូ។" }, 500);
      }
    }

    // POST /api/admin/videos/:id/trash (Soft Delete Video)
    if (
      pathname.startsWith("/api/admin/videos/") &&
      pathname.endsWith("/trash") &&
      method === "POST"
    ) {
      const auth = await requireAuth(request, "delete_images");
      if (auth instanceof Response) return auth;
      const currentUser = auth.user;

      const targetId = pathname.replace("/api/admin/videos/", "").replace("/trash", "").trim();
      const drizzle = getDrizzleDb();
      if (!drizzle) return json({ success: false, error: "Database unavailable" }, 503);

      try {
        const [existing] = await drizzle
          .select()
          .from(schema.videos)
          .where(eq(schema.videos.id, targetId))
          .limit(1);

        if (!existing) {
          return json({ success: false, error: "រកមិនឃើញវីដេអូនេះទេ។" }, 404);
        }

        await drizzle
          .update(schema.videos)
          .set({ status: "trashed", deletedAt: new Date(), updatedAt: new Date() })
          .where(eq(schema.videos.id, targetId));

        db.logActivity({
          userId: currentUser.id,
          userName: currentUser.name,
          userRole: currentUser.role,
          action: "TRASH_VIDEO",
          resource: "VIDEO",
          resourceId: targetId,
          details: `បានផ្លាស់ទីវីដេអូ «${existing.title}» ទៅកាន់ធុងសំរាម`,
          ip,
        });

        return json({ success: true, message: "បានផ្លាស់ទីវីដេអូទៅកាន់ធុងសំរាមរួចរាល់។" });
      } catch (err) {
        logger.error("Failed to trash video", { error: err });
        return json({ success: false, error: "Failed to trash video" }, 500);
      }
    }

    // POST /api/admin/videos/:id/restore (Restore Video from Trash)
    if (
      pathname.startsWith("/api/admin/videos/") &&
      pathname.endsWith("/restore") &&
      method === "POST"
    ) {
      const auth = await requireAuth(request, "manage_trash");
      if (auth instanceof Response) return auth;
      const currentUser = auth.user;

      const targetId = pathname.replace("/api/admin/videos/", "").replace("/restore", "").trim();
      const drizzle = getDrizzleDb();
      if (!drizzle) return json({ success: false, error: "Database unavailable" }, 503);

      try {
        const [existing] = await drizzle
          .select()
          .from(schema.videos)
          .where(eq(schema.videos.id, targetId))
          .limit(1);

        if (!existing) {
          return json({ success: false, error: "រកមិនឃើញវីដេអូនេះទេ។" }, 404);
        }

        await drizzle
          .update(schema.videos)
          .set({ status: "published", deletedAt: null, updatedAt: new Date() })
          .where(eq(schema.videos.id, targetId));

        db.logActivity({
          userId: currentUser.id,
          userName: currentUser.name,
          userRole: currentUser.role,
          action: "RESTORE_VIDEO",
          resource: "VIDEO",
          resourceId: targetId,
          details: `បានស្តារវីដេអូ «${existing.title}» ឡើងវិញ`,
          ip,
        });

        return json({ success: true, message: "បានស្តារវីដេអូឡើងវិញដោយជោគជ័យ។" });
      } catch (err) {
        logger.error("Failed to restore video", { error: err });
        return json({ success: false, error: "Failed to restore video" }, 500);
      }
    }

    // DELETE /api/admin/videos/:id (Permanent Delete or Soft Delete)
    if (
      pathname.startsWith("/api/admin/videos/") &&
      !pathname.endsWith("/trash") &&
      !pathname.endsWith("/restore") &&
      method === "DELETE"
    ) {
      const auth = await requireAuth(request, "delete_images");
      if (auth instanceof Response) return auth;
      const currentUser = auth.user;

      const targetId = pathname.replace("/api/admin/videos/", "").trim();
      const drizzle = getDrizzleDb();
      if (!drizzle) return json({ success: false, error: "Database unavailable" }, 503);

      try {
        const [existing] = await drizzle
          .select()
          .from(schema.videos)
          .where(eq(schema.videos.id, targetId))
          .limit(1);

        if (!existing) {
          return json({ success: false, error: "រកមិនឃើញវីដេអូនេះទេ។" }, 404);
        }

        // Clean up storage file if r2Key exists
        const storage = getStorageProvider();
        if (existing.r2Key && typeof storage.deleteVideo === "function") {
          await storage.deleteVideo(existing.r2Key).catch(() => {});
        }

        await drizzle.delete(schema.videos).where(eq(schema.videos.id, targetId));

        db.logActivity({
          userId: currentUser.id,
          userName: currentUser.name,
          userRole: currentUser.role,
          action: "DELETE_VIDEO",
          resource: "VIDEO",
          resourceId: targetId,
          details: `បានលុបវីដេអូ «${existing.title}» ជាអចិន្ត្រៃយ៍`,
          ip,
        });

        return json({ success: true, message: "បានលុបវីដេអូជោគជ័យ!" });
      } catch (err) {
        logger.error("Failed to delete video", { error: err });
        return json({ success: false, error: "Failed to delete video" }, 500);
      }
    }
  }

  // --- 8. TRASH & RESTORE MANAGEMENT ---
  if (pathname === "/api/admin/trash" && method === "GET") {
    const auth = await requireAuth(request, "manage_trash");
    if (auth instanceof Response) return auth;

    try {
      const trashData = await getAdminTrashItems();
      return json({ success: true, data: trashData });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load trash items";
      return json({ success: false, error: msg }, 500);
    }
  }

  // --- 9. ACTIVITY LOGS (AUDIT TRAIL) ---
  if (
    (pathname === "/api/admin/activity-logs" || pathname === "/api/admin/logs") &&
    method === "GET"
  ) {
    const auth = await requireAuth(request, "view_logs");
    if (auth instanceof Response) return auth;

    const limit = Number(url.searchParams.get("limit") || "100");
    const logs = db.getActivityLogs(limit);
    return json({ success: true, data: logs });
  }

  // --- 10. ADMIN SETTINGS (CHANGE PASSWORD) ---
  if (pathname === "/api/admin/settings/password" && (method === "PUT" || method === "POST")) {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;
    const currentUser = auth.user;

    try {
      const body = await request.json();
      const currentPassword =
        typeof body.currentPassword === "string" ? body.currentPassword : (body.oldPassword ?? "");
      const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
      const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";

      if (!currentPassword || !newPassword || !confirmPassword) {
        return json(
          {
            success: false,
            error: "សូមបំពេញគ្រប់ប្រអប់ (Current Password, New Password, Confirm New Password)។",
          },
          400,
        );
      }

      if (newPassword !== confirmPassword) {
        return json(
          {
            success: false,
            error:
              "ពាក្យសម្ងាត់ថ្មី និងផ្ទៀងផ្ទាត់ពាក្យសម្ងាត់មិនដូចគ្នាឡើយ (New Password != Confirm Password)។",
          },
          400,
        );
      }

      if (newPassword.length < 6) {
        return json(
          {
            success: false,
            error: "ពាក្យសម្ងាត់ថ្មីត្រូវមានយ៉ាងតិច ៦ តួអក្សរ។",
          },
          400,
        );
      }

      const userRecord = db.findUserByEmail(currentUser.email);
      if (!userRecord || !verifyPassword(currentPassword, userRecord.passwordHash)) {
        return json(
          {
            success: false,
            error: "ពាក្យសម្ងាត់បច្ចុប្បន្ន (Current Password) មិនត្រឹមត្រូវទេ។",
          },
          400,
        );
      }

      // Hash and update password in persistent store
      db.changePassword(currentUser.id, newPassword);

      // Invalidate all active sessions of this user
      await db.invalidateUserSessionsAsync(currentUser.id);

      db.logActivity({
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: "CHANGE_PASSWORD",
        resource: "USER",
        resourceId: currentUser.id,
        details: "បានផ្លាស់ប្តូរពាក្យសម្ងាត់គណនី និង Invalidate sessions ចាស់ៗ",
        ip,
      });

      return json(
        {
          success: true,
          message:
            "បានផ្លាស់ប្តូរពាក្យសម្ងាត់ដោយជោគជ័យ! សូមចូលប្រើប្រាស់ម្ដងទៀតជាមួយពាក្យសម្ងាត់ថ្មី។",
        },
        200,
        {
          "Set-Cookie": createClearSessionCookie(),
        },
      );
    } catch {
      return json({ success: false, error: "ទិន្នន័យមិនត្រឹមត្រូវ។" }, 400);
    }
  }

  // --- ADMIN SETTINGS: KEYBOARD SHORTCUT ---
  if (pathname === "/api/admin/settings/shortcut" && method === "GET") {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;
    return json({ success: true, data: db.getAdminShortcut() });
  }

  if (pathname === "/api/admin/settings/shortcut" && (method === "PUT" || method === "POST")) {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;
    const currentUser = auth.user;

    try {
      const body = await request.json();
      const key = typeof body.key === "string" ? body.key.trim() : "";
      if (!key) {
        return json({ success: false, error: "សូមបញ្ចូល Key ត្រឹមត្រូវសម្រាប់ Shortcut។" }, 400);
      }

      const shortcut = {
        key: key.toUpperCase(),
        ctrlKey: Boolean(body.ctrlKey),
        altKey: Boolean(body.altKey),
        shiftKey: Boolean(body.shiftKey),
        metaKey: Boolean(body.metaKey),
        targetRoute: "/admin",
      };

      db.setAdminShortcut(shortcut);

      db.logActivity({
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: "UPDATE_SHORTCUT",
        resource: "SETTINGS",
        resourceId: "admin-shortcut",
        details: `បានកែសម្រួល Admin Shortcut: ${shortcut.key} (Ctrl: ${shortcut.ctrlKey}, Shift: ${shortcut.shiftKey}, Alt: ${shortcut.altKey}, Meta: ${shortcut.metaKey})`,
        ip,
      });

      return json({
        success: true,
        message: "Shortcut ត្រូវបានរក្សាទុកដោយជោគជ័យ!",
        data: shortcut,
      });
    } catch {
      return json({ success: false, error: "ទិន្នន័យមិនត្រឹមត្រូវ។" }, 400);
    }
  }

  if (
    pathname === "/api/admin/settings/shortcut/reset" &&
    (method === "POST" || method === "PUT")
  ) {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;
    const currentUser = auth.user;

    const defaultShortcut = {
      key: "A",
      ctrlKey: true,
      shiftKey: true,
      altKey: false,
      metaKey: false,
      targetRoute: "/admin",
    };

    db.setAdminShortcut(defaultShortcut);

    db.logActivity({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action: "RESET_SHORTCUT",
      resource: "SETTINGS",
      resourceId: "admin-shortcut",
      details: "បានកំណត់ Admin Shortcut ទៅជា Default (Ctrl + Shift + A)",
      ip,
    });

    return json({
      success: true,
      message: "បានកំណត់ Shortcut ទៅជាទម្រង់ដើមវិញរួចរាល់។",
      data: defaultShortcut,
    });
  }

  if (pathname === "/api/archive/admin-shortcut" && method === "GET") {
    return json({ success: true, data: db.getAdminShortcut() });
  }

  // --- HOMEPAGE HERO SETTINGS ---
  // Public GET for Homepage
  if (pathname === "/api/site-settings/hero" && method === "GET") {
    const heroImage = await db.getSiteSettingAsync("homepage_hero_image");
    return json({ success: true, data: { heroImage } });
  }

  // Admin GET for Settings Page
  if (pathname === "/api/admin/settings/hero" && method === "GET") {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;
    const heroImage = await db.getSiteSettingAsync("homepage_hero_image");
    return json({ success: true, data: { heroImage } });
  }

  // Admin POST (Upload image from PC & set as Homepage Hero)
  if (pathname === "/api/admin/settings/hero" && method === "POST") {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;
    const currentUser = auth.user;

    try {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file || typeof file.arrayBuffer !== "function") {
        return json({ success: false, error: "សូមជ្រើសរើសឯកសាររូបភាពដែលត្រូវ Upload។" }, 400);
      }

      const MAX_SIZE = 15 * 1024 * 1024; // 15MB
      if (file.size > MAX_SIZE) {
        return json({ success: false, error: "ទំហំរូបភាពធំជាងកំណត់ (អតិបរមា 15MB)។" }, 413);
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const detectedMime = detectImageMagicBytes(buffer);
      if (!detectedMime) {
        return json(
          {
            success: false,
            error: "ប្រភេទឯកសារមិនត្រឹមត្រូវឡើយ។ អនុញ្ញាតតែរូបភាព JPG, PNG, WEBP ប៉ុណ្ណោះ។",
          },
          400,
        );
      }

      const storage = getStorageProvider();
      const stored = await storage.saveImage({
        buffer,
        originalFilename: file.name,
        mimeType: detectedMime,
      });

      await db.setSiteSettingAsync(
        "homepage_hero_image",
        stored.url,
        "Homepage Hero Banner Image",
      );

      db.logActivity({
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: "UPDATE_HERO_IMAGE",
        resource: "SETTINGS",
        resourceId: "homepage-hero",
        details: `បានផ្លាស់ប្តូររូបភាព Homepage Hero: ${stored.url}`,
        ip,
      });

      return json({
        success: true,
        message: "បានផ្លាស់ប្តូររូបភាព Hero ដោយជោគជ័យ!",
        data: { heroImage: stored.url },
      });
    } catch (err) {
      console.error("[Hero Upload Error]:", err);
      const msg = err instanceof Error ? err.message : "មានបញ្ហាក្នុងការ Upload រូបភាព Hero។";
      return json({ success: false, error: msg }, 500);
    }
  }

  // Admin DELETE (Reset Homepage Hero to Default)
  if (pathname === "/api/admin/settings/hero" && method === "DELETE") {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;
    const currentUser = auth.user;

    await db.deleteSiteSettingAsync("homepage_hero_image");

    db.logActivity({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action: "RESET_HERO_IMAGE",
      resource: "SETTINGS",
      resourceId: "homepage-hero",
      details: "បានកំណត់រូបភាព Homepage Hero ទៅកាន់ Default វិញ",
      ip,
    });

    return json({
      success: true,
      message: "បានកំណត់រូបភាព Hero ទៅ Default វិញជោគជ័យ!",
      data: { heroImage: null },
    });
  }

  // --- DEVELOPER PROFILE IMAGE SETTINGS ---
  // Public GET for Developer Page
  if (pathname === "/api/site-settings/developer-profile" && method === "GET") {
    const profileImage = await db.getSiteSettingAsync("developer_profile_image");
    return json({ success: true, data: { profileImage } });
  }

  // Admin GET for Settings Page
  if (pathname === "/api/admin/settings/developer-profile" && method === "GET") {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;
    const profileImage = await db.getSiteSettingAsync("developer_profile_image");
    return json({ success: true, data: { profileImage } });
  }

  // Admin POST (Upload image from PC & set as Developer Profile)
  if (pathname === "/api/admin/settings/developer-profile" && method === "POST") {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;
    const currentUser = auth.user;

    try {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file || typeof file.arrayBuffer !== "function") {
        return json({ success: false, error: "សូមជ្រើសរើសឯកសាររូបភាពដែលត្រូវ Upload។" }, 400);
      }

      const MAX_SIZE = 15 * 1024 * 1024; // 15MB
      if (file.size > MAX_SIZE) {
        return json({ success: false, error: "ទំហំរូបភាពធំជាងកំណត់ (អតិបរមា 15MB)។" }, 413);
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const detectedMime = detectImageMagicBytes(buffer);
      if (!detectedMime) {
        return json(
          {
            success: false,
            error: "ប្រភេទឯកសារមិនត្រឹមត្រូវឡើយ។ អនុញ្ញាតតែរូបភាព JPG, PNG, WEBP ប៉ុណ្ណោះ។",
          },
          400,
        );
      }

      const storage = getStorageProvider();
      const stored = await storage.saveImage({
        buffer,
        originalFilename: file.name,
        mimeType: detectedMime,
      });

      await db.setSiteSettingAsync(
        "developer_profile_image",
        stored.url,
        "Developer Profile Photo",
      );

      db.logActivity({
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: "UPDATE_DEVELOPER_PROFILE_IMAGE",
        resource: "SETTINGS",
        resourceId: "developer-profile-photo",
        details: `បានផ្លាស់ប្តូររូបថត Developer Profile: ${stored.url}`,
        ip,
      });

      return json({
        success: true,
        message: "បានផ្លាស់ប្តូររូបថត Profile ដោយជោគជ័យ!",
        data: { profileImage: stored.url },
      });
    } catch (err) {
      console.error("[Developer Profile Upload Error]:", err);
      const msg = err instanceof Error ? err.message : "មានបញ្ហាក្នុងការ Upload រូបភាព Profile។";
      return json({ success: false, error: msg }, 500);
    }
  }

  // Admin DELETE (Reset Developer Profile to Default)
  if (pathname === "/api/admin/settings/developer-profile" && method === "DELETE") {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;
    const currentUser = auth.user;

    await db.deleteSiteSettingAsync("developer_profile_image");

    db.logActivity({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action: "RESET_DEVELOPER_PROFILE_IMAGE",
      resource: "SETTINGS",
      resourceId: "developer-profile-photo",
      details: "បានកំណត់រូបថត Developer Profile ទៅកាន់ Default វិញ",
      ip,
    });

    return json({
      success: true,
      message: "បានកំណត់រូបថត Profile ទៅ Default វិញជោគជ័យ!",
      data: { profileImage: null },
    });
  }

  // --- 11. SYSTEM & DATABASE STATUS ENDPOINTS (SUPER ADMIN) ---
  if (pathname === "/api/admin/system/database-status" && method === "GET") {
    const authResult = await requireSuperAdmin(request);
    if (authResult instanceof Response) return authResult;

    const stats = db.getDashboardStats();
    return json({
      success: true,
      postgresConfigured: stats.isPostgresConnected,
      stats,
    });
  }

  // POST /api/admin/system/migrate
  if (pathname === "/api/admin/system/migrate" && method === "POST") {
    const authResult = await requireSuperAdmin(request);
    if (authResult instanceof Response) return authResult;

    try {
      const summary = await db.runMigration();
      return json({
        success: summary.success,
        summary,
      });
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : "Migration failed";
      return json({ success: false, error: errorMsg }, 500);
    }
  }

  // POST /api/admin/system/reconcile
  if (pathname === "/api/admin/system/reconcile" && method === "POST") {
    const authResult = await requireSuperAdmin(request);
    if (authResult instanceof Response) return authResult;

    try {
      const result = await db.reconcileCounts();
      return json({
        success: result.success,
        reconciledAlbums: result.reconciledAlbums,
        reconciledImages: result.reconciledImages,
        message: `បានផ្ទៀងផ្ទាត់ និងកែសម្រួលទិន្នន័យរួចរាល់ (${result.reconciledAlbums} Albums)។`,
      });
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : "Reconciliation failed";
      return json({ success: false, error: errorMsg }, 500);
    }
  }

  // --- 11.5 PRIVATE ARCHIVE ENDPOINTS ---

  const requirePrivateArchiveAuth = async (): Promise<{ user: User } | Response> => {
    const auth = await requireAuth(request, "manage_albums");
    if (auth instanceof Response) return auth;

    const privToken = getPrivateArchiveTokenFromRequest(request);
    if (!isPrivateArchiveSessionValid(privToken)) {
      return json(
        {
          success: false,
          code: "PRIVATE_ARCHIVE_LOCKED",
          error: "បណ្ណសារសម្ងាត់ត្រូវបានចាក់សោ។ សូមបញ្ចូលលេខកូដសម្ងាត់ដើម្បីដោះសោ។",
        },
        401,
        {
          "Set-Cookie": createClearPrivateSessionCookie(request),
        },
      );
    }

    return { user: auth.user };
  };

  // POST /api/admin/private-archive/unlock
  if (pathname === "/api/admin/private-archive/unlock" && method === "POST") {
    // 1. Rate-limit check (anti brute-force: 5 attempts per 15 minutes)
    const rl = checkRateLimit("private_unlock", ip);
    if (!rl.allowed) {
      return json(
        {
          success: false,
          error: `ការប៉ុនប៉ងច្រើនដងពេក។ សូមរង់ចាំ ${rl.retryAfterSeconds} វិនាទីទៀត មុនព្យាយាមម្តងទៀត។`,
        },
        429,
        { "Retry-After": String(rl.retryAfterSeconds) },
      );
    }

    // 2. Admin Authentication
    const auth = await requireAuth(request, "manage_albums");
    if (auth instanceof Response) return auth;
    const currentUser = auth.user;

    try {
      const body = await request.json();
      const code = typeof body.code === "string" ? body.code.trim() : "";
      if (!code) {
        return json({ success: false, error: "សូមបញ្ចូលលេខកូដសម្ងាត់។" }, 400);
      }

      const storedHash = await getPrivateArchiveCodeHash();
      const isMatch = verifyPassword(code, storedHash);

      if (!isMatch) {
        db.logActivity({
          userId: currentUser.id,
          userName: currentUser.name,
          userRole: currentUser.role,
          action: "PRIVATE_ARCHIVE_UNLOCK_FAILED",
          resource: "PRIVATE_ARCHIVE",
          details: "ការប៉ុនប៉ងដោះសោបណ្ណសារសម្ងាត់បរាជ័យ (Wrong code)",
          ip,
        });
        return json({ success: false, error: "លេខកូដសម្ងាត់មិនត្រឹមត្រូវឡើយ។" }, 401);
      }

      // Reset rate limit on success
      resetRateLimit("private_unlock", ip);

      // Create new private session token (2 hours TTL)
      const token = crypto.randomBytes(32).toString("hex");
      privateArchiveSessions.set(token, {
        userId: currentUser.id,
        expiresAt: Date.now() + 2 * 60 * 60 * 1000,
      });

      db.logActivity({
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: "PRIVATE_ARCHIVE_UNLOCK_SUCCESS",
        resource: "PRIVATE_ARCHIVE",
        details: "បានដោះសោបណ្ណសារសម្ងាត់ជោគជ័យ",
        ip,
      });

      return json(
        { success: true, message: "ដោះសោបណ្ណសារសម្ងាត់ជោគជ័យ!", token },
        200,
        {
          "Set-Cookie": createPrivateSessionCookie(token, request),
        },
      );
    } catch {
      return json({ success: false, error: "ទិន្នន័យមិនត្រឹមត្រូវ។" }, 400);
    }
  }

  // GET /api/admin/private-archive/session
  if (pathname === "/api/admin/private-archive/session" && method === "GET") {
    const auth = await requireAuth(request, "manage_albums");
    if (auth instanceof Response) return auth;

    const token = getPrivateArchiveTokenFromRequest(request);
    const unlocked = isPrivateArchiveSessionValid(token);
    return json({ success: true, unlocked });
  }

  // POST /api/admin/private-archive/lock
  if (pathname === "/api/admin/private-archive/lock" && method === "POST") {
    const auth = await requireAuth(request, "manage_albums");
    if (auth instanceof Response) return auth;
    const currentUser = auth.user;

    const token = getPrivateArchiveTokenFromRequest(request);
    if (token) {
      privateArchiveSessions.delete(token);
    }

    db.logActivity({
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action: "PRIVATE_ARCHIVE_LOCK",
      resource: "PRIVATE_ARCHIVE",
      details: "បានចាក់សោបណ្ណសារសម្ងាត់វិញ",
      ip,
    });

    return json(
      { success: true, locked: true, message: "បានចាក់សោបណ្ណសារសម្ងាត់រួចរាល់។" },
      200,
      {
        "Set-Cookie": createClearPrivateSessionCookie(request),
      },
    );
  }

  // GET /api/admin/private-archive/albums
  if (pathname === "/api/admin/private-archive/albums" && method === "GET") {
    const privAuth = await requirePrivateArchiveAuth();
    if (privAuth instanceof Response) return privAuth;

    const drizzle = getDrizzleDb();
    if (!drizzle) {
      return json({ success: true, data: [] });
    }

    try {
      const rows = await drizzle
        .select({
          album: schema.privateAlbums,
          realCount: sql<number>`(
            SELECT count(*)::int FROM ${schema.privateImages}
            WHERE ${schema.privateImages.privateAlbumId} = ${schema.privateAlbums.id}
          )`,
          realVideoCount: sql<number>`(
            SELECT count(*)::int FROM ${schema.privateVideos}
            WHERE ${schema.privateVideos.privateAlbumId} = ${schema.privateAlbums.id}
          )`,
          firstImageId: sql<string | null>`(
            SELECT ${schema.privateImages.id} FROM ${schema.privateImages}
            WHERE ${schema.privateImages.privateAlbumId} = ${schema.privateAlbums.id}
            ORDER BY ${schema.privateImages.createdAt} ASC
            LIMIT 1
          )`,
        })
        .from(schema.privateAlbums)
        .orderBy(desc(schema.privateAlbums.createdAt));

      const albums = rows.map((r) => ({
        id: r.album.id,
        title: r.album.title,
        description: r.album.description,
        coverKey: r.album.coverKey,
        coverUrl: r.firstImageId
          ? `/api/admin/private-archive/images/${r.firstImageId}/file`
          : null,
        photoCount: Number(r.realCount ?? r.album.photoCount ?? 0),
        videoCount: Number(r.realVideoCount ?? 0),
        firstImageId: r.firstImageId,
        createdAt: r.album.createdAt.toISOString(),
        updatedAt: r.album.updatedAt.toISOString(),
      }));

      return json({ success: true, data: albums });
    } catch (err) {
      logger.error("Failed to fetch private albums", { error: err });
      return json({ success: false, error: "Failed to fetch private albums" }, 500);
    }
  }

  // POST /api/admin/private-archive/albums
  if (pathname === "/api/admin/private-archive/albums" && method === "POST") {
    const privAuth = await requirePrivateArchiveAuth();
    if (privAuth instanceof Response) return privAuth;
    const currentUser = privAuth.user;

    const drizzle = getDrizzleDb();
    if (!drizzle) return json({ success: false, error: "Database not available" }, 500);

    try {
      const body = await request.json();
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const description = typeof body.description === "string" ? body.description.trim() : "";

      if (!title) {
        return json({ success: false, error: "សូមបញ្ចូលចំណងជើង Album សម្ងាត់។" }, 400);
      }

      const newAlbumId = `palbum-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
      const [inserted] = await drizzle
        .insert(schema.privateAlbums)
        .values({
          id: newAlbumId,
          title,
          description: description || null,
          photoCount: 0,
          createdBy: currentUser.id,
        })
        .returning();

      db.logActivity({
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: "CREATE_PRIVATE_ALBUM",
        resource: "PRIVATE_ALBUM",
        resourceId: newAlbumId,
        details: `បានបង្កើត Album សម្ងាត់ «${title}»`,
        ip,
      });

      return json({ success: true, data: inserted }, 201);
    } catch (err) {
      logger.error("Failed to create private album", { error: err });
      return json({ success: false, error: "មានបញ្ហាក្នុងការបង្កើត Album សម្ងាត់។" }, 500);
    }
  }

  // GET /api/admin/private-archive/albums/:id
  if (
    pathname.startsWith("/api/admin/private-archive/albums/") &&
    method === "GET" &&
    !pathname.includes("/images")
  ) {
    const privAuth = await requirePrivateArchiveAuth();
    if (privAuth instanceof Response) return privAuth;

    const albumId = pathname.replace("/api/admin/private-archive/albums/", "").trim();
    const drizzle = getDrizzleDb();
    if (!drizzle) return json({ success: false, error: "Database not available" }, 500);

    try {
      const [album] = await drizzle
        .select()
        .from(schema.privateAlbums)
        .where(eq(schema.privateAlbums.id, albumId))
        .limit(1);

      if (!album) {
        return json({ success: false, error: "រកមិនឃើញ Album សម្ងាត់នេះទេ។" }, 404);
      }

      const [images, videos] = await Promise.all([
        drizzle
          .select({
            id: schema.privateImages.id,
            privateAlbumId: schema.privateImages.privateAlbumId,
            filename: schema.privateImages.filename,
            mimeType: schema.privateImages.mimeType,
            size: schema.privateImages.size,
            width: schema.privateImages.width,
            height: schema.privateImages.height,
            title: schema.privateImages.title,
            description: schema.privateImages.description,
            createdAt: schema.privateImages.createdAt,
          })
          .from(schema.privateImages)
          .where(eq(schema.privateImages.privateAlbumId, albumId))
          .orderBy(desc(schema.privateImages.createdAt)),
        drizzle
          .select({
            id: schema.privateVideos.id,
            privateAlbumId: schema.privateVideos.privateAlbumId,
            filename: schema.privateVideos.filename,
            mimeType: schema.privateVideos.mimeType,
            size: schema.privateVideos.size,
            duration: schema.privateVideos.duration,
            width: schema.privateVideos.width,
            height: schema.privateVideos.height,
            title: schema.privateVideos.title,
            description: schema.privateVideos.description,
            createdAt: schema.privateVideos.createdAt,
          })
          .from(schema.privateVideos)
          .where(eq(schema.privateVideos.privateAlbumId, albumId))
          .orderBy(desc(schema.privateVideos.createdAt)),
      ]);

      return json({
        success: true,
        data: {
          album: {
            ...album,
            photoCount: images.length,
            videoCount: videos.length,
            createdAt: album.createdAt.toISOString(),
            updatedAt: album.updatedAt.toISOString(),
          },
          images: images.map((img) => ({
            ...img,
            createdAt: img.createdAt.toISOString(),
            fileUrl: `/api/admin/private-archive/images/${img.id}/file`,
          })),
          videos: videos.map((vid) => ({
            ...vid,
            createdAt: vid.createdAt.toISOString(),
            fileUrl: `/api/admin/private-archive/videos/${vid.id}/file`,
          })),
        },
      });
    } catch (err) {
      logger.error("Failed to fetch private album details", { error: err });
      return json({ success: false, error: "Failed to fetch private album details" }, 500);
    }
  }

  // PUT /api/admin/private-archive/albums/:id
  if (pathname.startsWith("/api/admin/private-archive/albums/") && method === "PUT") {
    const privAuth = await requirePrivateArchiveAuth();
    if (privAuth instanceof Response) return privAuth;
    const currentUser = privAuth.user;

    const albumId = pathname.replace("/api/admin/private-archive/albums/", "").trim();
    const drizzle = getDrizzleDb();
    if (!drizzle) return json({ success: false, error: "Database not available" }, 500);

    try {
      const body = await request.json();
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const description = typeof body.description === "string" ? body.description.trim() : "";

      if (!title) {
        return json({ success: false, error: "សូមបញ្ចូលចំណងជើង Album។" }, 400);
      }

      const [updated] = await drizzle
        .update(schema.privateAlbums)
        .set({
          title,
          description: description || null,
          updatedAt: new Date(),
        })
        .where(eq(schema.privateAlbums.id, albumId))
        .returning();

      db.logActivity({
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: "UPDATE_PRIVATE_ALBUM",
        resource: "PRIVATE_ALBUM",
        resourceId: albumId,
        details: `បានកែសម្រួល Album សម្ងាត់ «${title}»`,
        ip,
      });

      return json({ success: true, data: updated });
    } catch (err) {
      logger.error("Failed to update private album", { error: err });
      return json({ success: false, error: "Failed to update private album" }, 500);
    }
  }

  // DELETE /api/admin/private-archive/albums/:id
  if (pathname.startsWith("/api/admin/private-archive/albums/") && method === "DELETE") {
    const privAuth = await requirePrivateArchiveAuth();
    if (privAuth instanceof Response) return privAuth;
    const currentUser = privAuth.user;

    const albumId = pathname.replace("/api/admin/private-archive/albums/", "").trim();
    const drizzle = getDrizzleDb();
    if (!drizzle) return json({ success: false, error: "Database not available" }, 500);

    try {
      const [album] = await drizzle
        .select()
        .from(schema.privateAlbums)
        .where(eq(schema.privateAlbums.id, albumId))
        .limit(1);

      if (!album) {
        return json({ success: false, error: "រកមិនឃើញ Album នេះទេ។" }, 404);
      }

      // Fetch all images to clean up R2 objects
      // Fetch all images and videos to clean up R2 objects
      const imagesInAlbum = await drizzle
        .select({ r2Key: schema.privateImages.r2Key })
        .from(schema.privateImages)
        .where(eq(schema.privateImages.privateAlbumId, albumId));

      const videosInAlbum = await drizzle
        .select({ r2Key: schema.privateVideos.r2Key })
        .from(schema.privateVideos)
        .where(eq(schema.privateVideos.privateAlbumId, albumId));

      const storage = getStorageProvider();
      for (const img of imagesInAlbum) {
        await storage.deleteImage(img.r2Key).catch(() => {});
      }
      for (const vid of videosInAlbum) {
        if (storage.deleteVideo) {
          await storage.deleteVideo(vid.r2Key).catch(() => {});
        } else {
          await storage.deleteImage(vid.r2Key).catch(() => {});
        }
      }

      // Delete album row from DB (cascades to private_images)
      await drizzle.delete(schema.privateAlbums).where(eq(schema.privateAlbums.id, albumId));

      db.logActivity({
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: "DELETE_PRIVATE_ALBUM",
        resource: "PRIVATE_ALBUM",
        resourceId: albumId,
        details: `បានលុប Album សម្ងាត់ «${album.title}» ព្រមទាំងរូបភាព ${imagesInAlbum.length} សន្លឹក`,
        ip,
      });

      return json({ success: true, message: "បានលុប Album សម្ងាត់ជោគជ័យ!" });
    } catch (err) {
      logger.error("Failed to delete private album", { error: err });
      return json({ success: false, error: "Failed to delete private album" }, 500);
    }
  }

  // POST /api/admin/private-archive/images/upload
  if (pathname === "/api/admin/private-archive/images/upload" && method === "POST") {
    const privAuth = await requirePrivateArchiveAuth();
    if (privAuth instanceof Response) return privAuth;
    const currentUser = privAuth.user;

    try {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const privateAlbumId = (formData.get("privateAlbumId") as string) || "";
      const title = (formData.get("title") as string) || "";

      if (!file || typeof file.arrayBuffer !== "function") {
        return json({ success: false, error: "សូមជ្រើសរើសឯកសាររូបភាពដែលត្រូវ Upload។" }, 400);
      }

      if (!privateAlbumId) {
        return json({ success: false, error: "សូមជ្រើសរើស Album សម្ងាត់គោលដៅ។" }, 400);
      }

      const MAX_SIZE = 15 * 1024 * 1024; // 15MB
      if (file.size > MAX_SIZE) {
        return json({ success: false, error: "ទំហំរូបភាពធំជាងកំណត់ (អតិបរមា 15MB)។" }, 413);
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const detectedMime = detectImageMagicBytes(buffer);
      if (!detectedMime) {
        return json(
          {
            success: false,
            error: "ប្រភេទឯកសារមិនត្រឹមត្រូវឡើយ។ អនុញ្ញាតតែរូបភាព JPG, PNG, WEBP, GIF, AVIF ប៉ុណ្ណោះ។",
          },
          400,
        );
      }

      // Validate target private album exists
      const drizzle = getDrizzleDb();
      if (drizzle) {
        const [foundAlbum] = await drizzle
          .select({ id: schema.privateAlbums.id })
          .from(schema.privateAlbums)
          .where(eq(schema.privateAlbums.id, privateAlbumId))
          .limit(1);
        if (!foundAlbum) {
          return json({ success: false, error: "រកមិនឃើញ Album សម្ងាត់គោលដៅឡើយ។" }, 404);
        }
      }

      // Save to private storage with private-archive/ key prefix
      const storage = getStorageProvider();
      let uniqueKey: string;

      if (typeof storage.savePrivateImage === "function") {
        const saved = await storage.savePrivateImage({
          buffer,
          originalFilename: file.name,
          mimeType: detectedMime,
        });
        uniqueKey = saved.r2Key;
      } else {
        const mimeExtMap: Record<string, string> = {
          "image/jpeg": ".jpg",
          "image/png": ".png",
          "image/webp": ".webp",
          "image/gif": ".gif",
          "image/avif": ".avif",
        };
        const ext = mimeExtMap[detectedMime] || ".jpg";
        uniqueKey = `private-archive/${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
        await storage.saveImage({
          buffer,
          originalFilename: uniqueKey,
          mimeType: detectedMime,
        });
      }

      const newImageId = `pimg-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
      const itemTitle = title.trim() || file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");

      try {
        if (drizzle) {
          await drizzle.insert(schema.privateImages).values({
            id: newImageId,
            privateAlbumId,
            r2Key: uniqueKey,
            filename: file.name,
            mimeType: detectedMime,
            size: buffer.length,
            title: itemTitle,
            createdBy: currentUser.id,
          });

          await drizzle
            .update(schema.privateAlbums)
            .set({
              photoCount: sql`${schema.privateAlbums.photoCount} + 1`,
              coverKey: uniqueKey,
              updatedAt: new Date(),
            })
            .where(eq(schema.privateAlbums.id, privateAlbumId))
            .catch(() => {});
        }

        db.logActivity({
          userId: currentUser.id,
          userName: currentUser.name,
          userRole: currentUser.role,
          action: "UPLOAD_PRIVATE_IMAGE",
          resource: "PRIVATE_IMAGE",
          resourceId: newImageId,
          details: `បាន Upload រូបភាពសម្ងាត់ «${itemTitle}» ទៅកាន់ Album ${privateAlbumId}`,
          ip,
        });

        return json(
          {
            success: true,
            data: {
              id: newImageId,
              privateAlbumId,
              filename: file.name,
              mimeType: detectedMime,
              size: buffer.length,
              title: itemTitle,
              fileUrl: `/api/admin/private-archive/images/${newImageId}/file`,
            },
            message: "បានបង្ហោះរូបភាពសម្ងាត់ដោយជោគជ័យ!",
          },
          201,
        );
      } catch (dbErr) {
        // Rollback R2 object if DB insertion fails
        await storage.deleteImage(uniqueKey).catch(() => {});
        logger.error("Failed to insert private image record", { error: dbErr });
        return json({ success: false, error: "មានបញ្ហាក្នុងការរក្សាទុកទិន្នន័យរូបភាពសម្ងាត់។" }, 500);
      }
    } catch (err) {
      logger.error("Unexpected error during private image upload", { error: err });
      return json({ success: false, error: "មានបញ្ហាក្នុងដំណើរការ Upload រូបភាពសម្ងាត់។" }, 500);
    }
  }

  // GET /api/admin/private-archive/images/:id/file (Authorized Image Streamer)
  if (
    pathname.startsWith("/api/admin/private-archive/images/") &&
    pathname.endsWith("/file") &&
    method === "GET"
  ) {
    const privAuth = await requirePrivateArchiveAuth();
    if (privAuth instanceof Response) return privAuth;

    const imageId = pathname
      .replace("/api/admin/private-archive/images/", "")
      .replace("/file", "")
      .trim();

    const drizzle = getDrizzleDb();
    if (!drizzle) return new Response("Database unavailable", { status: 503 });

    try {
      const [imgRecord] = await drizzle
        .select({
          id: schema.privateImages.id,
          r2Key: schema.privateImages.r2Key,
          mimeType: schema.privateImages.mimeType,
          size: schema.privateImages.size,
        })
        .from(schema.privateImages)
        .where(eq(schema.privateImages.id, imageId))
        .limit(1);

      if (!imgRecord || !imgRecord.r2Key) {
        return new Response("Image Not Found", { status: 404 });
      }

      const storage = getStorageProvider();
      if (!storage.getObject) {
        return new Response("Storage reader not supported", { status: 500 });
      }

      const objectResult = await storage.getObject(imgRecord.r2Key);
      if (!objectResult) {
        return new Response("Image asset not found in storage", { status: 404 });
      }

      return new Response(Buffer.from(objectResult.body), {
        status: 200,
        headers: {
          "Content-Type": objectResult.contentType || imgRecord.mimeType || "image/jpeg",
          "Content-Length": String(objectResult.contentLength || imgRecord.size),
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (err) {
      logger.error("Error streaming private image", { error: err, imageId });
      return new Response("Internal Server Error", { status: 500 });
    }
  }

  // DELETE /api/admin/private-archive/images/:id
  if (
    pathname.startsWith("/api/admin/private-archive/images/") &&
    !pathname.endsWith("/file") &&
    method === "DELETE"
  ) {
    const privAuth = await requirePrivateArchiveAuth();
    if (privAuth instanceof Response) return privAuth;
    const currentUser = privAuth.user;

    const imageId = pathname.replace("/api/admin/private-archive/images/", "").trim();
    const drizzle = getDrizzleDb();
    if (!drizzle) return json({ success: false, error: "Database not available" }, 500);

    try {
      const [imgRecord] = await drizzle
        .select()
        .from(schema.privateImages)
        .where(eq(schema.privateImages.id, imageId))
        .limit(1);

      if (!imgRecord) {
        return json({ success: false, error: "រកមិនឃើញរូបភាពសម្ងាត់នេះទេ។" }, 404);
      }

      const storage = getStorageProvider();
      await storage.deleteImage(imgRecord.r2Key).catch(() => {});

      await drizzle.delete(schema.privateImages).where(eq(schema.privateImages.id, imageId));

      await drizzle
        .update(schema.privateAlbums)
        .set({
          photoCount: sql`GREATEST(0, ${schema.privateAlbums.photoCount} - 1)`,
          updatedAt: new Date(),
        })
        .where(eq(schema.privateAlbums.id, imgRecord.privateAlbumId))
        .catch(() => {});

      db.logActivity({
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: "DELETE_PRIVATE_IMAGE",
        resource: "PRIVATE_IMAGE",
        resourceId: imageId,
        details: `បានលុបរូបភាពសម្ងាត់ ${imgRecord.filename}`,
        ip,
      });

      return json({ success: true, message: "បានលុបរូបភាពសម្ងាត់ជោគជ័យ!" });
    } catch (err) {
      logger.error("Failed to delete private image", { error: err });
      return json({ success: false, error: "Failed to delete private image" }, 500);
    }
  }

  // POST /api/admin/private-archive/videos/upload
  if (pathname === "/api/admin/private-archive/videos/upload" && method === "POST") {
    const privAuth = await requirePrivateArchiveAuth();
    if (privAuth instanceof Response) return privAuth;
    const currentUser = privAuth.user;

    // Rate limiting (reuse upload scope)
    const rl = checkRateLimit("upload", ip);
    if (!rl.allowed) {
      return rateLimitedResponse(rl);
    }

    // Early content-length check (100MB limit + 1MB multipart overhead)
    const declaredLength = Number(request.headers.get("content-length") || "0");
    if (declaredLength > LIMITS.videoBytes + 1024 * 1024) {
      return json({ success: false, error: "ទំហំវីដេអូធំជាងកំណត់ (អតិបរមា 100MB)។" }, 413);
    }

    try {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const privateAlbumId = (formData.get("privateAlbumId") as string) || "";
      const title = (formData.get("title") as string) || "";
      const description = (formData.get("description") as string) || "";

      if (!file || typeof file.arrayBuffer !== "function") {
        return json({ success: false, error: "សូមជ្រើសរើសឯកសារវីដេអូដែលត្រូវ Upload។" }, 400);
      }

      if (!privateAlbumId) {
        return json({ success: false, error: "សូមជ្រើសរើស Album សម្ងាត់គោលដៅ។" }, 400);
      }

      if (file.size > LIMITS.videoBytes) {
        return json({ success: false, error: "ទំហំវីដេអូធំជាងកំណត់ (អតិបរមា 100MB)។" }, 413);
      }

      // Validate target private album exists in PostgreSQL
      const drizzle = getDrizzleDb();
      if (drizzle) {
        const [foundAlbum] = await drizzle
          .select({ id: schema.privateAlbums.id })
          .from(schema.privateAlbums)
          .where(eq(schema.privateAlbums.id, privateAlbumId))
          .limit(1);
        if (!foundAlbum) {
          return json({ success: false, error: "រកមិនឃើញ Album សម្ងាត់គោលដៅឡើយ។" }, 404);
        }
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const detectedMime = detectVideoMagicBytes(buffer);
      if (!detectedMime) {
        return json(
          {
            success: false,
            error: "ប្រភេទឯកសារមិនត្រឹមត្រូវឡើយ។ អនុញ្ញាតតែវីដេអូ MP4, WebM, MOV ប៉ុណ្ណោះ។",
          },
          400,
        );
      }

      const storage = getStorageProvider();
      let uniqueKey: string;
      let storedSize: number = buffer.length;

      if (typeof storage.savePrivateVideo === "function") {
        const saved = await storage.savePrivateVideo({
          buffer,
          originalFilename: file.name,
          mimeType: detectedMime,
        });
        uniqueKey = saved.r2Key;
        storedSize = saved.size;
      } else {
        const extMap: Record<string, string> = {
          "video/mp4": ".mp4",
          "video/webm": ".webm",
          "video/quicktime": ".mov",
        };
        const ext = extMap[detectedMime] || ".mp4";
        uniqueKey = `private-archive/videos/${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
        if (storage.saveVideo) {
          const saved = await storage.saveVideo({
            buffer,
            originalFilename: uniqueKey,
            mimeType: detectedMime,
          });
          uniqueKey = saved.filename;
          storedSize = saved.size;
        }
      }

      const newVideoId = `pvid-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
      const safeTitle = sanitizeText(title, 200) || file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      const safeDesc = sanitizeText(description, 2000);

      try {
        if (drizzle) {
          await drizzle.insert(schema.privateVideos).values({
            id: newVideoId,
            privateAlbumId,
            r2Key: uniqueKey,
            filename: file.name,
            mimeType: detectedMime,
            size: storedSize,
            duration: null,
            width: null,
            height: null,
            title: safeTitle,
            description: safeDesc || null,
            createdBy: currentUser.id,
          });
        }

        db.logActivity({
          userId: currentUser.id,
          userName: currentUser.name,
          userRole: currentUser.role,
          action: "UPLOAD_PRIVATE_VIDEO",
          resource: "PRIVATE_VIDEO",
          resourceId: newVideoId,
          details: `បានបង្ហោះវីដេអូសម្ងាត់ «${safeTitle}» (${Math.round(storedSize / (1024 * 1024))}MB) ចូល Album សម្ងាត់ ${privateAlbumId}`,
          ip,
        });

        return json(
          {
            success: true,
            data: {
              id: newVideoId,
              privateAlbumId,
              filename: file.name,
              mimeType: detectedMime,
              size: storedSize,
              title: safeTitle,
              description: safeDesc,
              fileUrl: `/api/admin/private-archive/videos/${newVideoId}/file`,
            },
            message: "បានបង្ហោះវីដេអូសម្ងាត់ដោយជោគជ័យ!",
          },
          201,
        );
      } catch (dbErr) {
        if (storage.deleteVideo) {
          await storage.deleteVideo(uniqueKey).catch(() => {});
        } else {
          await storage.deleteImage(uniqueKey).catch(() => {});
        }
        logger.error("Failed to insert private video record", { error: dbErr });
        return json({ success: false, error: "មានបញ្ហាក្នុងការរក្សាទុកទិន្នន័យវីដេអូសម្ងាត់។" }, 500);
      }
    } catch (err) {
      logger.error("Unexpected error during private video upload", { error: err });
      return json({ success: false, error: "មានបញ្ហាក្នុងដំណើរការ Upload វីដេអូសម្ងាត់។" }, 500);
    }
  }

  // GET /api/admin/private-archive/videos/:id/file (Authorized Video Streamer)
  if (
    pathname.startsWith("/api/admin/private-archive/videos/") &&
    pathname.endsWith("/file") &&
    method === "GET"
  ) {
    const privAuth = await requirePrivateArchiveAuth();
    if (privAuth instanceof Response) return privAuth;

    const videoId = pathname
      .replace("/api/admin/private-archive/videos/", "")
      .replace("/file", "")
      .trim();

    const drizzle = getDrizzleDb();
    if (!drizzle) return new Response("Database unavailable", { status: 503 });

    try {
      const [videoRecord] = await drizzle
        .select({
          id: schema.privateVideos.id,
          r2Key: schema.privateVideos.r2Key,
          mimeType: schema.privateVideos.mimeType,
          size: schema.privateVideos.size,
        })
        .from(schema.privateVideos)
        .where(eq(schema.privateVideos.id, videoId))
        .limit(1);

      if (!videoRecord || !videoRecord.r2Key) {
        return new Response("Video Not Found", { status: 404 });
      }

      const storage = getStorageProvider();
      if (!storage.getObject) {
        return new Response("Storage reader not supported", { status: 500 });
      }

      const objectResult = await storage.getObject(videoRecord.r2Key);
      if (!objectResult) {
        return new Response("Video File Not Found in Storage", { status: 404 });
      }

      const totalSize = objectResult.contentLength || videoRecord.size || objectResult.body.length;
      const fullBuffer = Buffer.from(objectResult.body);
      const mimeType = objectResult.contentType || videoRecord.mimeType || "video/mp4";

      const rangeHeader = request.headers.get("range");
      if (rangeHeader && rangeHeader.startsWith("bytes=")) {
        const parts = rangeHeader.replace("bytes=", "").split("-");
        const start = parseInt(parts[0] || "0", 10);
        const end = parts[1] && parts[1].trim() !== "" ? parseInt(parts[1], 10) : totalSize - 1;

        if (!isNaN(start) && !isNaN(end) && start <= end && start < totalSize) {
          const actualEnd = Math.min(end, totalSize - 1);
          const chunk = fullBuffer.subarray(start, actualEnd + 1);

          return new Response(chunk, {
            status: 206,
            headers: {
              "Content-Type": mimeType,
              "Content-Length": String(chunk.length),
              "Content-Range": `bytes ${start}-${actualEnd}/${totalSize}`,
              "Accept-Ranges": "bytes",
              "Cache-Control": "private, no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
              "X-Content-Type-Options": "nosniff",
            },
          });
        }
      }

      return new Response(fullBuffer, {
        status: 200,
        headers: {
          "Content-Type": mimeType,
          "Content-Length": String(totalSize),
          "Accept-Ranges": "bytes",
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (err) {
      logger.error("Error streaming private video", { error: err, videoId });
      return new Response("Internal Server Error", { status: 500 });
    }
  }

  // DELETE /api/admin/private-archive/videos/:id
  if (
    pathname.startsWith("/api/admin/private-archive/videos/") &&
    !pathname.endsWith("/file") &&
    method === "DELETE"
  ) {
    const privAuth = await requirePrivateArchiveAuth();
    if (privAuth instanceof Response) return privAuth;
    const currentUser = privAuth.user;

    const videoId = pathname.replace("/api/admin/private-archive/videos/", "").trim();
    const drizzle = getDrizzleDb();
    if (!drizzle) return json({ success: false, error: "Database not available" }, 500);

    try {
      const [videoRecord] = await drizzle
        .select()
        .from(schema.privateVideos)
        .where(eq(schema.privateVideos.id, videoId))
        .limit(1);

      if (!videoRecord) {
        return json({ success: false, error: "រកមិនឃើញវីដេអូសម្ងាត់នេះទេ។" }, 404);
      }

      const storage = getStorageProvider();
      if (storage.deleteVideo) {
        await storage.deleteVideo(videoRecord.r2Key).catch(() => {});
      } else {
        await storage.deleteImage(videoRecord.r2Key).catch(() => {});
      }

      await drizzle.delete(schema.privateVideos).where(eq(schema.privateVideos.id, videoId));

      db.logActivity({
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: "DELETE_PRIVATE_VIDEO",
        resource: "PRIVATE_VIDEO",
        resourceId: videoId,
        details: `បានលុបវីដេអូសម្ងាត់ ${videoRecord.filename}`,
        ip,
      });

      return json({ success: true, message: "បានលុបវីដេអូសម្ងាត់ជោគជ័យ!" });
    } catch (err) {
      logger.error("Failed to delete private video", { error: err });
      return json({ success: false, error: "Failed to delete private video" }, 500);
    }
  }

  // POST /api/admin/private-archive/change-code (Super Admin only)
  if (pathname === "/api/admin/private-archive/change-code" && method === "POST") {
    const auth = await requireSuperAdmin(request);
    if (auth instanceof Response) return auth;
    const currentUser = auth.user;

    try {
      const body = await request.json();
      const newCode = typeof body.newCode === "string" ? body.newCode.trim() : "";

      if (newCode.length < 4) {
        return json({ success: false, error: "លេខកូដសម្ងាត់ត្រូវមានយ៉ាងហោចណាស់ ៤ តួអក្សរ។" }, 400);
      }

      const newHash = hashPassword(newCode);
      const drizzle = getDrizzleDb();

      if (drizzle) {
        await drizzle
          .insert(schema.siteSettings)
          .values({
            key: "private_archive_code_hash",
            value: newHash,
            description: "Hashed access code for Private Archive",
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: schema.siteSettings.key,
            set: {
              value: newHash,
              updatedAt: new Date(),
            },
          });
      }

      // Invalidate all active private sessions to enforce new code
      privateArchiveSessions.clear();

      db.logActivity({
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: "CHANGE_PRIVATE_ARCHIVE_CODE",
        resource: "PRIVATE_ARCHIVE",
        details: "បានផ្លាស់ប្តូរលេខកូដសម្ងាត់បណ្ណសារសម្ងាត់",
        ip,
      });

      return json({
        success: true,
        message: "បានផ្លាស់ប្តូរលេខកូដសម្ងាត់ជោគជ័យ! សូមដោះសោឡើងវិញដោយលេខកូដថ្មី។",
      });
    } catch (err) {
      logger.error("Failed to change private archive code", { error: err });
      return json({ success: false, error: "Failed to change access code" }, 500);
    }
  }

  // --- 12. PUBLIC ARCHIVE READ ENDPOINTS (POSTGRESQL-BACKED) ---

  // GET /api/archive/festivals
  if (pathname === "/api/archive/festivals" && method === "GET") {
    try {
      const fests = await getPostgresFestivals();
      return json({ success: true, data: fests });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to fetch festivals";
      return json({ success: false, error: msg }, 500);
    }
  }

  // GET /api/archive/years
  if (pathname === "/api/archive/years" && method === "GET") {
    try {
      const yearsList = await getPostgresYears();
      return json({ success: true, data: yearsList });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to fetch years";
      return json({ success: false, error: msg }, 500);
    }
  }

  // GET /api/archive/events?festivalId=...&year=...
  if (pathname === "/api/archive/events" && method === "GET") {
    try {
      const festivalId = url.searchParams.get("festivalId") || undefined;
      const yearParam = url.searchParams.get("year");
      const year = yearParam ? parseInt(yearParam, 10) : undefined;

      if (!festivalId || !year || isNaN(year)) {
        return json({ success: false, error: "festivalId and valid year parameters are required" }, 400);
      }

      const eventsList = await getPostgresEventsForFestivalYear(festivalId, year);
      return json({ success: true, data: eventsList });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to fetch events";
      return json({ success: false, error: msg }, 500);
    }
  }

  // GET /api/archive/albums
  if (pathname === "/api/archive/albums" && method === "GET") {
    try {
      const yearParam = url.searchParams.get("year");
      const festivalIdParam = url.searchParams.get("festivalId") || undefined;
      const searchParam = url.searchParams.get("search") || undefined;
      const year = yearParam ? parseInt(yearParam, 10) : undefined;

      const albumList = await getPostgresAlbums({
        year: isNaN(year as number) ? undefined : year,
        festivalId: festivalIdParam,
        search: searchParam,
      });
      return json({ success: true, data: albumList });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to fetch albums";
      return json({ success: false, error: msg }, 500);
    }
  }

  // GET /api/archive/albums/:id/photos
  if (
    pathname.startsWith("/api/archive/albums/") &&
    pathname.endsWith("/photos") &&
    method === "GET"
  ) {
    try {
      const albumId = pathname.replace("/api/archive/albums/", "").replace("/photos", "").trim();
      const photos = await getPostgresPhotosForAlbum(albumId);
      return json({ success: true, data: photos });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to fetch photos";
      return json({ success: false, error: msg }, 500);
    }
  }

  // GET /api/archive/albums/:id/videos
  if (
    pathname.startsWith("/api/archive/albums/") &&
    pathname.endsWith("/videos") &&
    method === "GET"
  ) {
    try {
      const albumId = pathname.replace("/api/archive/albums/", "").replace("/videos", "").trim();
      const videos = await getPostgresVideosForAlbum(albumId);
      return json({ success: true, data: videos });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to fetch videos";
      return json({ success: false, error: msg }, 500);
    }
  }

  // GET /api/archive/albums/:id
  if (
    pathname.startsWith("/api/archive/albums/") &&
    !pathname.endsWith("/photos") &&
    !pathname.endsWith("/videos") &&
    method === "GET"
  ) {
    try {
      const albumId = pathname.replace("/api/archive/albums/", "").trim();
      const album = await getPostgresAlbumById(albumId);
      if (!album) {
        return json({ success: false, error: "Album not found" }, 404);
      }
      return json({ success: true, data: album });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to fetch album";
      return json({ success: false, error: msg }, 500);
    }
  }

  // GET /api/archive/stats
  if (pathname === "/api/archive/stats" && method === "GET") {
    try {
      const yearParam = url.searchParams.get("year");
      const year = yearParam ? parseInt(yearParam, 10) : undefined;
      const stats = await getPostgresArchiveStats(isNaN(year as number) ? undefined : year);
      return json({ success: true, data: stats });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to fetch archive stats";
      return json({ success: false, error: msg }, 500);
    }
  }

  // GET /api/archive/slideshow-albums (Home Slideshow Albums with all images grouped by Album)
  if (pathname === "/api/archive/slideshow-albums" && method === "GET") {
    try {
      const albums = await getArchiveAlbumsWithAllImages();
      const totalImages = albums.reduce((sum, a) => sum + (a.images?.length || 0), 0);
      return json({
        success: true,
        data: albums,
        totalAlbums: albums.length,
        totalImages,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to fetch slideshow albums";
      return json({ success: false, error: msg }, 500);
    }
  }

  // GET /api/archive/images (Public Image Gallery Paginated & Filtered by Year/Festival/Search)
  if (pathname === "/api/archive/images" && method === "GET") {
    try {
      const yearParam = url.searchParams.get("year");
      const festivalIdParam = url.searchParams.get("festivalId") || undefined;
      const albumIdParam = url.searchParams.get("albumId") || undefined;
      const searchParam = url.searchParams.get("search") || undefined;
      const pageParam = url.searchParams.get("page");
      const limitParam = url.searchParams.get("limit");

      const year = yearParam && yearParam !== "all" ? parseInt(yearParam, 10) : undefined;
      const page = pageParam ? Math.max(1, parseInt(pageParam, 10) || 1) : 1;
      const limit = limitParam ? Math.min(100, Math.max(1, parseInt(limitParam, 10) || 24)) : 24;

      if (url.searchParams.get("all") === "true") {
        const allImages = await getAllArchiveImagesForSlideshow();
        return json({
          success: true,
          data: allImages,
          total: allImages.length,
          page: 1,
          limit: allImages.length,
          totalPages: 1,
        });
      }

      if (url.searchParams.get("diverse") === "true") {
        const diverseImages = await getDiverseArchiveImages(limit);
        return json({
          success: true,
          data: diverseImages,
          total: diverseImages.length,
          page: 1,
          limit,
          totalPages: 1,
        });
      }

      const result = await getAdminImagesPaginated({
        page,
        limit,
        year: isNaN(year as number) ? undefined : year,
        festivalId: festivalIdParam === "all" ? undefined : festivalIdParam,
        albumId: albumIdParam === "all" ? undefined : albumIdParam,
        search: searchParam,
        status: "published",
      });

      return json({
        success: true,
        data: result.images,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to fetch archive images";
      return json({ success: false, error: msg }, 500);
    }
  }

  // GET /api/archive/search
  if (pathname === "/api/archive/search" && method === "GET") {
    try {
      const q = url.searchParams.get("q") || "";
      const type = url.searchParams.get("type");
      if (type === "videos") {
        const videoResults = await searchPostgresVideos(q);
        return json({ success: true, data: videoResults });
      }
      const results = await searchPostgresArchive(q);
      return json({ success: true, data: results });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Search failed";
      return json({ success: false, error: msg }, 500);
    }
  }

  // GET /api/archive/videos (Public Video Search / Listing)
  if (pathname === "/api/archive/videos" && method === "GET") {
    try {
      const q = url.searchParams.get("q") || url.searchParams.get("search") || "";
      const albumId = url.searchParams.get("albumId") || undefined;
      if (albumId) {
        const videos = await getPostgresVideosForAlbum(albumId);
        return json({ success: true, data: videos });
      }
      const videos = await searchPostgresVideos(q);
      return json({ success: true, data: videos });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to fetch videos";
      return json({ success: false, error: msg }, 500);
    }
  }

  // =========================================================================
  // PHASE 3.1 — VISITOR TRACKING & VIEWS ANALYTICS API ENDPOINTS
  // =========================================================================

  // POST /api/analytics/session (Public, Non-blocking anonymous visitor session)
  if (pathname === "/api/analytics/session" && method === "POST") {
    try {
      const body = await request.json().catch(() => ({}));
      const sessionId = body?.sessionId || url.searchParams.get("sessionId");
      if (!sessionId || typeof sessionId !== "string") {
        return json({ success: false, error: "Missing sessionId" }, 400);
      }

      const ipHash = crypto
        .createHash("sha256")
        .update(ip + (process.env["IP_SALT"] || "wp_salt_2026"))
        .digest("hex")
        .slice(0, 16);

      const device = body?.device || "desktop";
      const auth = await authenticateRequest(request);

      await db.trackVisitorSession({
        sessionId,
        userAgent: userAgent || body?.userAgent,
        userId: auth.user?.id,
        device,
        ipHash,
      });

      return json({ success: true, sessionId });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Session tracking failed";
      return json({ success: false, error: msg }, 500);
    }
  }

  // POST /api/analytics/view (Public, Record album/image view with deduplication)
  if (pathname === "/api/analytics/view" && method === "POST") {
    try {
      const body = await request.json().catch(() => ({}));
      const { resourceType, resourceId, visitorId } = body || {};

      if (!resourceType || !resourceId || !visitorId) {
        return json(
          {
            success: false,
            error: "Missing required fields: resourceType, resourceId, visitorId",
          },
          400,
        );
      }

      if (!["page", "album", "image"].includes(resourceType)) {
        return json({ success: false, error: "Invalid resourceType" }, 400);
      }

      const auth = await authenticateRequest(request);
      const result = await db.recordView({
        resourceType,
        resourceId: String(resourceId).trim(),
        visitorId: String(visitorId).trim(),
        userId: auth.user?.id,
      });

      return json({
        success: true,
        recorded: result.recorded,
        deduplicated: result.deduplicated,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "View recording failed";
      return json({ success: false, error: msg }, 500);
    }
  }

  // POST /api/analytics/page-view (Public, Record page path view)
  if (pathname === "/api/analytics/page-view" && method === "POST") {
    try {
      const body = await request.json().catch(() => ({}));
      const pathStr = body?.path || "/";
      const visitorId = body?.visitorId;

      if (!visitorId) {
        return json({ success: false, error: "Missing visitorId" }, 400);
      }

      const auth = await authenticateRequest(request);
      const result = await db.recordView({
        resourceType: "page",
        resourceId: String(pathStr).trim(),
        visitorId: String(visitorId).trim(),
        userId: auth.user?.id,
      });

      return json({
        success: true,
        recorded: result.recorded,
        deduplicated: result.deduplicated,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Page view recording failed";
      return json({ success: false, error: msg }, 500);
    }
  }

  // GET /api/admin/analytics/overview (Admin RBAC required)
  if (pathname === "/api/admin/analytics/overview" && method === "GET") {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    try {
      const periodParam = (url.searchParams.get("period") || "today") as
        "today" | "7d" | "30d" | "all";
      const period = ["today", "7d", "30d", "all"].includes(periodParam) ? periodParam : "today";

      const overview = await db.getAnalyticsOverview(period);
      return json({ success: true, data: overview });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to fetch analytics overview";
      return json({ success: false, error: msg }, 500);
    }
  }

  // GET /api/admin/analytics/views (Admin RBAC required)
  if (pathname === "/api/admin/analytics/views" && method === "GET") {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    try {
      const periodParam = (url.searchParams.get("period") || "7d") as "today" | "7d" | "30d";
      const period = ["today", "7d", "30d"].includes(periodParam) ? periodParam : "7d";

      const series = await db.getAnalyticsViewsSeries(period);
      return json({ success: true, data: series });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to fetch analytics series";
      return json({ success: false, error: msg }, 500);
    }
  }

  // GET /api/admin/analytics/top-albums (Admin RBAC required)
  if (pathname === "/api/admin/analytics/top-albums" && method === "GET") {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    try {
      const periodParam = (url.searchParams.get("period") || "all") as
        "today" | "7d" | "30d" | "all";
      const period = ["today", "7d", "30d", "all"].includes(periodParam) ? periodParam : "all";
      const limitParam = parseInt(url.searchParams.get("limit") || "10", 10);
      const limit = isNaN(limitParam) ? 10 : Math.min(Math.max(1, limitParam), 50);

      const topAlbums = await db.getTopAlbums(period, limit);
      return json({ success: true, data: topAlbums });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to fetch top albums";
      return json({ success: false, error: msg }, 500);
    }
  }

  // GET /api/admin/analytics/top-images (Admin RBAC required)
  if (pathname === "/api/admin/analytics/top-images" && method === "GET") {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    try {
      const periodParam = (url.searchParams.get("period") || "all") as
        "today" | "7d" | "30d" | "all";
      const period = ["today", "7d", "30d", "all"].includes(periodParam) ? periodParam : "all";
      const limitParam = parseInt(url.searchParams.get("limit") || "10", 10);
      const limit = isNaN(limitParam) ? 10 : Math.min(Math.max(1, limitParam), 50);

      const topImages = await db.getTopImages(period, limit);
      return json({ success: true, data: topImages });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to fetch top images";
      return json({ success: false, error: msg }, 500);
    }
  }

  // --- PHASE 3.2: LIKES & FAVORITES ENDPOINTS ---

  // POST /api/interactions/like (Public/User)
  if (pathname === "/api/interactions/like" && method === "POST") {
    try {
      const body = await request.json().catch(() => ({}));
      const { resourceType, resourceId, visitorId } = body;
      if (!resourceType || !resourceId || !visitorId) {
        return json(
          {
            success: false,
            error: "Missing required fields (resourceType, resourceId, visitorId)",
          },
          400,
        );
      }
      if (!["album", "image"].includes(resourceType)) {
        return json(
          { success: false, error: "Invalid resourceType. Must be 'album' or 'image'" },
          400,
        );
      }

      const auth = await authenticateRequest(request);
      const result = await db.recordLike(
        resourceType,
        String(resourceId).trim(),
        String(visitorId).trim(),
        auth.user?.id,
      );
      return json({ success: true, ...result });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Like recording failed";
      return json({ success: false, error: msg }, 500);
    }
  }

  // DELETE /api/interactions/like (Public/User)
  if (pathname === "/api/interactions/like" && method === "DELETE") {
    try {
      const body = await request.json().catch(() => ({}));
      const resourceType = body?.resourceType || url.searchParams.get("resourceType");
      const resourceId = body?.resourceId || url.searchParams.get("resourceId");
      const visitorId = body?.visitorId || url.searchParams.get("visitorId");

      if (!resourceType || !resourceId || !visitorId) {
        return json(
          {
            success: false,
            error: "Missing required fields (resourceType, resourceId, visitorId)",
          },
          400,
        );
      }
      if (!["album", "image"].includes(resourceType)) {
        return json({ success: false, error: "Invalid resourceType" }, 400);
      }

      const auth = await authenticateRequest(request);
      const result = await db.removeLike(
        resourceType as "album" | "image",
        String(resourceId).trim(),
        String(visitorId).trim(),
        auth.user?.id,
      );
      return json({ success: true, ...result });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Like removal failed";
      return json({ success: false, error: msg }, 500);
    }
  }

  // GET /api/interactions/like/status
  if (pathname === "/api/interactions/like/status" && method === "GET") {
    try {
      const resourceType = url.searchParams.get("resourceType") as "album" | "image";
      const resourceId = url.searchParams.get("resourceId");
      const visitorId = url.searchParams.get("visitorId") || undefined;

      if (!resourceType || !resourceId) {
        return json({ success: false, error: "Missing resourceType or resourceId" }, 400);
      }
      if (!["album", "image"].includes(resourceType)) {
        return json({ success: false, error: "Invalid resourceType" }, 400);
      }

      const auth = await authenticateRequest(request);
      const status = await db.getLikeStatus(
        resourceType,
        String(resourceId).trim(),
        visitorId,
        auth.user?.id,
      );
      return json({ success: true, ...status });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to fetch like status";
      return json({ success: false, error: msg }, 500);
    }
  }

  // GET /api/interactions/like/count
  if (pathname === "/api/interactions/like/count" && method === "GET") {
    try {
      const resourceType = url.searchParams.get("resourceType") as "album" | "image";
      const resourceId = url.searchParams.get("resourceId");

      if (!resourceType || !resourceId) {
        return json({ success: false, error: "Missing resourceType or resourceId" }, 400);
      }
      if (!["album", "image"].includes(resourceType)) {
        return json({ success: false, error: "Invalid resourceType" }, 400);
      }

      const count = await db.getLikeCount(resourceType, String(resourceId).trim());
      return json({ success: true, count });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to fetch like count";
      return json({ success: false, error: msg }, 500);
    }
  }

  // POST /api/interactions/favorite (Public/User)
  if (pathname === "/api/interactions/favorite" && method === "POST") {
    try {
      const body = await request.json().catch(() => ({}));
      const { resourceType = "image", resourceId, visitorId } = body;

      if (!resourceId || !visitorId) {
        return json(
          { success: false, error: "Missing required fields (resourceId, visitorId)" },
          400,
        );
      }
      if (!["album", "image"].includes(resourceType)) {
        return json({ success: false, error: "Invalid resourceType" }, 400);
      }

      const auth = await authenticateRequest(request);
      const result = await db.recordFavorite(
        resourceType,
        String(resourceId).trim(),
        String(visitorId).trim(),
        auth.user?.id,
      );
      return json({ success: true, ...result });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Favorite recording failed";
      return json({ success: false, error: msg }, 500);
    }
  }

  // DELETE /api/interactions/favorite (Public/User)
  if (pathname === "/api/interactions/favorite" && method === "DELETE") {
    try {
      const body = await request.json().catch(() => ({}));
      const resourceType = (body?.resourceType ||
        url.searchParams.get("resourceType") ||
        "image") as "album" | "image";
      const resourceId = body?.resourceId || url.searchParams.get("resourceId");
      const visitorId = body?.visitorId || url.searchParams.get("visitorId");

      if (!resourceId || !visitorId) {
        return json(
          { success: false, error: "Missing required fields (resourceId, visitorId)" },
          400,
        );
      }
      if (!["album", "image"].includes(resourceType)) {
        return json({ success: false, error: "Invalid resourceType" }, 400);
      }

      const auth = await authenticateRequest(request);
      const result = await db.removeFavorite(
        resourceType,
        String(resourceId).trim(),
        String(visitorId).trim(),
        auth.user?.id,
      );
      return json({ success: true, ...result });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Favorite removal failed";
      return json({ success: false, error: msg }, 500);
    }
  }

  // GET /api/interactions/favorite/status
  if (pathname === "/api/interactions/favorite/status" && method === "GET") {
    try {
      const resourceType = (url.searchParams.get("resourceType") || "image") as "album" | "image";
      const resourceId = url.searchParams.get("resourceId");
      const visitorId = url.searchParams.get("visitorId") || undefined;

      if (!resourceId) {
        return json({ success: false, error: "Missing resourceId" }, 400);
      }

      const auth = await authenticateRequest(request);
      const favorited = await db.getFavoriteStatus(
        resourceType,
        String(resourceId).trim(),
        visitorId,
        auth.user?.id,
      );
      return json({ success: true, favorited });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to fetch favorite status";
      return json({ success: false, error: msg }, 500);
    }
  }

  // GET /api/interactions/favorites
  if (pathname === "/api/interactions/favorites" && method === "GET") {
    try {
      const visitorId = url.searchParams.get("visitorId") || undefined;
      const resourceType = (url.searchParams.get("resourceType") || "all") as
        "album" | "image" | "all";

      const auth = await authenticateRequest(request);
      const favorites = await db.getUserFavorites(visitorId, auth.user?.id, resourceType);
      return json({ success: true, data: favorites });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to fetch favorites";
      return json({ success: false, error: msg }, 500);
    }
  }

  // GET /api/admin/analytics/interactions (Admin RBAC required)
  if (pathname === "/api/admin/analytics/interactions" && method === "GET") {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    try {
      const periodParam = (url.searchParams.get("period") || "all") as
        "today" | "7d" | "30d" | "all";
      const period = ["today", "7d", "30d", "all"].includes(periodParam) ? periodParam : "all";

      const data = await db.getInteractionsAnalytics(period);
      return json({ success: true, data });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to fetch interactions analytics";
      return json({ success: false, error: msg }, 500);
    }
  }

  // --- PHASE 3.3: SEARCH ANALYTICS & POPULARITY INTELLIGENCE ENDPOINTS ---

  // POST /api/analytics/search (Public, non-blocking search logging)
  if (pathname === "/api/analytics/search" && method === "POST") {
    try {
      const body = await request.json().catch(() => ({}));
      const { query, resultsCount = 0, visitorId, selectedResultId, selectedResultType } = body;

      if (!query || typeof query !== "string") {
        return json({ success: false, error: "Missing query" }, 400);
      }

      const auth = await authenticateRequest(request);
      const result = await db.recordSearch({
        query: query.trim(),
        resultsCount: Number(resultsCount) || 0,
        visitorId: visitorId ? String(visitorId).trim() : undefined,
        userId: auth.user?.id,
        selectedResultId: selectedResultId ? String(selectedResultId).trim() : undefined,
        selectedResultType: selectedResultType ? String(selectedResultType).trim() : undefined,
      });

      return json({ success: true, ...result });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Search logging failed";
      return json({ success: false, error: msg }, 500);
    }
  }

  // POST /api/analytics/search-click (Public, track search result selection)
  if (pathname === "/api/analytics/search-click" && method === "POST") {
    try {
      const body = await request.json().catch(() => ({}));
      const { logId, query, visitorId, selectedResultId, selectedResultType = "album" } = body;

      if (!selectedResultId) {
        return json({ success: false, error: "Missing selectedResultId" }, 400);
      }

      const auth = await authenticateRequest(request);
      const result = await db.recordSearchClick({
        logId: logId ? Number(logId) : undefined,
        query: query ? String(query).trim() : undefined,
        visitorId: visitorId ? String(visitorId).trim() : undefined,
        userId: auth.user?.id,
        selectedResultId: String(selectedResultId).trim(),
        selectedResultType: selectedResultType as "album" | "image" | "festival",
      });

      return json({ success: true, ...result });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Search click tracking failed";
      return json({ success: false, error: msg }, 500);
    }
  }

  // GET /api/archive/search-trending (Public, top trending search terms)
  if (pathname === "/api/archive/search-trending" && method === "GET") {
    try {
      const limitParam = parseInt(url.searchParams.get("limit") || "8", 10);
      const limit = isNaN(limitParam) ? 8 : Math.min(Math.max(1, limitParam), 20);
      const suggestions = await db.getTrendingSearchSuggestions(limit);
      return json({ success: true, data: suggestions });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to fetch trending searches";
      return json({ success: false, error: msg }, 500);
    }
  }

  // GET /api/admin/analytics/search (Admin RBAC required)
  if (pathname === "/api/admin/analytics/search" && method === "GET") {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    try {
      const periodParam = (url.searchParams.get("period") || "7d") as
        "today" | "7d" | "30d" | "all";
      const period = ["today", "7d", "30d", "all"].includes(periodParam) ? periodParam : "7d";

      const data = await db.getSearchAnalytics(period);
      return json({ success: true, data });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to fetch search analytics";
      return json({ success: false, error: msg }, 500);
    }
  }

  // GET /api/admin/analytics/popularity (Admin RBAC required)
  if (pathname === "/api/admin/analytics/popularity" && method === "GET") {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    try {
      const periodParam = (url.searchParams.get("period") || "all") as
        "today" | "7d" | "30d" | "all";
      const period = ["today", "7d", "30d", "all"].includes(periodParam) ? periodParam : "all";

      const data = await db.getPopularityIntelligence(period);
      return json({ success: true, data });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to fetch popularity intelligence";
      return json({ success: false, error: msg }, 500);
    }
  }

  // --- PHASE 3.4: ADVANCED ADMIN DASHBOARD & REPORTS ENDPOINTS ---

  // GET /api/admin/reports/summary (Admin RBAC required)
  if (pathname === "/api/admin/reports/summary" && method === "GET") {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    try {
      const period = url.searchParams.get("period") || "7d";
      const startDate = url.searchParams.get("startDate");
      const endDate = url.searchParams.get("endDate");

      const data = await db.getReportsSummary(period, startDate, endDate);
      return json({ success: true, data });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to fetch reports summary";
      return json({ success: false, error: msg }, 500);
    }
  }

  // GET /api/admin/reports/content-performance (Admin RBAC required)
  if (pathname === "/api/admin/reports/content-performance" && method === "GET") {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    try {
      const period = url.searchParams.get("period") || "all";
      const startDate = url.searchParams.get("startDate");
      const endDate = url.searchParams.get("endDate");
      const festivalId = url.searchParams.get("festivalId");
      const yearParam = url.searchParams.get("year");
      const year = yearParam ? parseInt(yearParam, 10) : undefined;

      const data = await db.getContentPerformance(period, startDate, endDate, festivalId, year);
      return json({ success: true, data });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to fetch content performance report";
      return json({ success: false, error: msg }, 500);
    }
  }

  // GET /api/admin/reports/growth (Admin RBAC required)
  if (pathname === "/api/admin/reports/growth" && method === "GET") {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    try {
      const groupByParam = url.searchParams.get("groupBy") === "year" ? "year" : "month";
      const data = await db.getArchiveGrowth(groupByParam);
      return json({ success: true, data });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to fetch archive growth report";
      return json({ success: false, error: msg }, 500);
    }
  }

  // GET /api/admin/reports/activity (Admin RBAC required)
  if (pathname === "/api/admin/reports/activity" && method === "GET") {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    try {
      const period = url.searchParams.get("period") || "30d";
      const startDate = url.searchParams.get("startDate");
      const endDate = url.searchParams.get("endDate");

      const data = await db.getAdminActivitySummary(period, startDate, endDate);
      return json({ success: true, data });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to fetch admin activity report";
      return json({ success: false, error: msg }, 500);
    }
  }

  // GET /api/admin/reports/export (Admin RBAC required)
  if (pathname === "/api/admin/reports/export" && method === "GET") {
    const auth = await requireAuth(request);
    if (auth instanceof Response) return auth;

    try {
      const format = url.searchParams.get("format") === "json" ? "json" : "csv";
      const reportType = (url.searchParams.get("reportType") || "all") as
        | "all"
        | "summary"
        | "content-performance"
        | "top-albums"
        | "top-images"
        | "search-queries"
        | "growth"
        | "activity";
      const period = url.searchParams.get("period") || "7d";
      const startDate = url.searchParams.get("startDate");
      const endDate = url.searchParams.get("endDate");

      const exportResult = await db.exportReport(format, reportType, period, startDate, endDate);

      return new Response(exportResult.content, {
        status: 200,
        headers: {
          "Content-Type": exportResult.mimeType,
          "Content-Disposition": `attachment; filename="${exportResult.filename}"`,
        },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to export report";
      return json({ success: false, error: msg }, 500);
    }
  }

  return json({ success: false, error: "Endpoint not found" }, 404);
}
