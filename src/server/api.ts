import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { db, verifyPassword } from "./db";
import { checkDbHealth, getDrizzleDb } from "../db/index";
import * as schema from "../db/schema";
import { eq, asc, desc, sql } from "drizzle-orm";
import { getOrGenerateRequestId, logger } from "./logger";
import { getStorageProvider } from "./storage/index";
import { detectImageMagicBytes } from "./validation";
import {
  getPostgresFestivals,
  getPostgresYears,
  getPostgresAlbums,
  getPostgresAlbumById,
  getPostgresPhotosForAlbum,
  getPostgresArchiveStats,
  searchPostgresArchive,
  getAdminDashboardMetrics,
  getAdminAlbumsPaginated,
  getAdminImagesPaginated,
  getAdminTrashItems,
} from "./queries";
import {
  authenticateRequest,
  requireAuth,
  requireSuperAdmin,
  createSessionCookie,
  createClearSessionCookie,
  checkLoginRateLimit,
  resetLoginRateLimit,
} from "./auth";
import type { Permission, UserRole } from "../types/auth";

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
        const { festivalId, year, location, title, description, coverImage } = body;
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

  // GET /api/archive/albums/:id
  if (pathname.startsWith("/api/archive/albums/") && method === "GET") {
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
      const results = await searchPostgresArchive(q);
      return json({ success: true, data: results });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Search failed";
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
