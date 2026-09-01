import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { User, ActivityLog, Session, Permission, UserRole } from "../types/auth";
import {
  STATIC_FESTIVALS as defaultFestivals,
  STATIC_YEARS as defaultYears,
} from "../data/static-archive";
import { getDrizzleDb, isPostgresConfigured, getPgPool } from "../db/index.ts";
import * as schema from "../db/schema.ts";
import { eq, and, sql, desc, gte, inArray } from "drizzle-orm";
import { migrateJsonToPostgres, initializeDatabaseSchema } from "../db/migrate.ts";
import { seedStaticArchiveToPostgres } from "../db/seed-archive.ts";
import {
  recordPostgresVisitorSession,
  recordPostgresView,
  getPostgresAnalyticsOverview,
  getPostgresAnalyticsViewsSeries,
  getPostgresTopAlbums,
  getPostgresTopImages,
  getPhnomPenhDateBounds,
  getPostgresLikeStatus,
  recordPostgresLike,
  removePostgresLike,
  getPostgresFavoriteStatus,
  recordPostgresFavorite,
  removePostgresFavorite,
  getPostgresUserFavorites,
  getPostgresInteractionsAnalytics,
  recordPostgresSearchLog,
  recordPostgresSearchClick,
  getPostgresSearchAnalytics,
  getPostgresPopularityIntelligence,
  getPostgresTrendingSearchSuggestions,
  getPostgresReportsSummary,
  getPostgresContentPerformance,
  getPostgresArchiveGrowth,
  getPostgresAdminActivitySummary,
  generatePostgresExportReport,
  type AdminAnalyticsOverview,
  type ViewsSeriesPoint,
  type TopAlbumItem,
  type TopImageItem,
  type FavoritedAlbumItem,
  type FavoritedImageItem,
  type InteractionsAnalyticsData,
  type SearchAnalyticsData,
  type PopularityIntelligenceData,
  type ReportsSummaryData,
  type ContentPerformanceReportData,
  type ArchiveGrowthReportData,
  type AdminActivitySummaryData,
  type ReportPeriod,
} from "./queries.ts";

export interface StoredUser extends User {
  passwordHash: string;
}

export interface StoredFestival {
  id: string;
  name: string;
  emoji: string;
  accent: string;
  month: string;
  description?: string | undefined;
  coverUrl?: string | undefined;
  status?: string | undefined;
  isCustom?: boolean | undefined;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
}

export interface StoredAlbum {
  id: string;
  festivalId: string;
  year: number;
  location: string;
  title: string;
  description?: string | undefined;
  photoCount: number;
  coverImage?: string | undefined;
  status?: string | undefined;
  viewsCount?: number | undefined;
  likesCount?: number | undefined;
  createdAt: string;
  updatedAt?: string | undefined;
}

export interface StoredImage {
  id: string;
  albumId: string;
  title: string;
  description?: string | undefined;
  url: string;
  thumbnailUrl?: string | undefined;
  size: number;
  mimeType: string;
  photographer?: string | undefined;
  dateTaken?: string | undefined;
  copyright?: string | undefined;
  tags?: string | undefined;
  status?: string | undefined;
  viewsCount?: number | undefined;
  likesCount?: number | undefined;
  downloadsCount?: number | undefined;
  sharesCount?: number | undefined;
  uploadedBy: string;
  deletedAt?: string | undefined;
  createdAt: string;
  updatedAt?: string | undefined;
}

export interface StoredReport {
  id: string;
  imageId: string;
  reason: string;
  details?: string | undefined;
  status: "pending" | "reviewed" | "resolved" | "dismissed";
  resolvedBy?: string | undefined;
  resolutionNotes?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export interface StoredNotification {
  id: string;
  type: "pending_review" | "report_submitted" | "upload_alert" | "system";
  title: string;
  message: string;
  link?: string | undefined;
  isRead: boolean;
  createdAt: string;
}

export interface StoredVisitorSession {
  id: string;
  ipHash?: string | undefined;
  userAgent?: string | undefined;
  userId?: string | undefined;
  device?: string | undefined;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredViewLog {
  id: number;
  resourceType: "page" | "album" | "image";
  resourceId: string;
  visitorId: string;
  userId?: string | undefined;
  createdAt: string;
}

export interface StoredLike {
  id: number;
  resourceType: "album" | "image";
  resourceId: string;
  visitorId: string;
  userId?: string | undefined;
  createdAt: string;
}

export interface StoredFavorite {
  id: number;
  resourceType: "album" | "image";
  resourceId: string;
  imageId?: string | undefined;
  visitorId: string;
  userId?: string | undefined;
  createdAt: string;
}

interface DatabaseSchema {
  users: StoredUser[];
  sessions: Session[];
  festivals: StoredFestival[];
  years: number[];
  albums: StoredAlbum[];
  images: StoredImage[];
  activityLogs: ActivityLog[];
  reports?: StoredReport[] | undefined;
  notifications?: StoredNotification[] | undefined;
  visitorSessions?: StoredVisitorSession[] | undefined;
  viewsLog?: StoredViewLog[] | undefined;
  likes?: StoredLike[] | undefined;
  favorites?: StoredFavorite[] | undefined;
  adminShortcut?:
    | {
        key: string;
        ctrlKey?: boolean;
        altKey?: boolean;
        shiftKey?: boolean;
        metaKey?: boolean;
        targetRoute?: string;
      }
    | undefined;
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "archive_db.json");

// Helper to hash password using Node crypto scrypt
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, combinedHash: string): boolean {
  try {
    const [salt, hash] = combinedHash.split(":");
    if (!salt || !hash) return false;
    const derived = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(derived, "hex"));
  } catch {
    return false;
  }
}

class Database {
  private data: DatabaseSchema;
  private postgresReady = false;

  constructor() {
    this.data = this.loadDatabase();
    this.ensureSuperAdmin();
    this.initPostgresIfAvailable();
  }

  private async initPostgresIfAvailable() {
    const isProd = process.env["NODE_ENV"] === "production";
    if (isPostgresConfigured()) {
      try {
        await initializeDatabaseSchema();
        this.postgresReady = true;
        console.log("[Wat Peareang Archive]: Connected to PostgreSQL database successfully.");
        await this.ensureSuperAdminInPostgres();

        // If PostgreSQL has 0 archive images (e.g. fresh production DB), seed the full archive dataset
        const drizzle = getDrizzleDb();
        if (drizzle) {
          const imagesCountRes = await drizzle
            .select({ count: sql<number>`count(*)` })
            .from(schema.images);
          const imagesCount = Number(imagesCountRes[0]?.count || 0);
          if (imagesCount === 0) {
            console.log(
              "[Wat Peareang Archive]: PostgreSQL has 0 images. Auto-populating initial archive dataset...",
            );
            await seedStaticArchiveToPostgres();
            console.log(
              "[Wat Peareang Archive]: Initial archive dataset successfully populated into PostgreSQL.",
            );
          }
        }

        await this.hydrateFromPostgres();
      } catch (err) {
        if (isProd) {
          console.error(
            "[FATAL - Wat Peareang Archive]: PostgreSQL is required in production but failed to initialize:",
            err,
          );
        } else {
          console.warn(
            "[Wat Peareang Archive]: PostgreSQL init deferred/failed, using local development fallback:",
            err,
          );
        }
      }
    } else if (isProd) {
      console.error(
        "[FATAL - Wat Peareang Archive]: DATABASE_URL is not configured in production mode. PostgreSQL is required for production operations.",
      );
    }
  }

  public async hydrateFromPostgres(): Promise<void> {
    const drizzle = getDrizzleDb();
    if (!drizzle || !isPostgresConfigured()) return;

    try {
      // 1. Hydrate users from PostgreSQL
      const pgUsers = await drizzle.select().from(schema.users);
      if (pgUsers && pgUsers.length > 0) {
        this.data.users = pgUsers.map((u) => {
          const userItem: StoredUser = {
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role as UserRole,
            permissions: (typeof u.permissions === "string"
              ? JSON.parse(u.permissions)
              : u.permissions) as Permission[],
            status: u.status === "disabled" ? "disabled" : "active",
            createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : new Date().toISOString(),
            passwordHash: u.passwordHash,
          };
          if (u.lastLoginAt) {
            userItem.lastLoginAt = new Date(u.lastLoginAt).toISOString();
          }
          return userItem;
        });
      }

      // 2. Hydrate active sessions from PostgreSQL
      const now = new Date();
      const pgSessions = await drizzle
        .select()
        .from(schema.sessions)
        .where(gte(schema.sessions.expiresAt, now));
      if (pgSessions) {
        this.data.sessions = pgSessions.map((s) => {
          const sessionItem: Session = {
            token: s.token,
            userId: s.userId,
            expiresAt: s.expiresAt ? new Date(s.expiresAt).getTime() : Date.now() + 86400000,
            createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : new Date().toISOString(),
          };
          if (s.userAgent) sessionItem.userAgent = s.userAgent;
          if (s.ip) sessionItem.ip = s.ip;
          return sessionItem;
        });
      }

      // 3. Hydrate festivals from PostgreSQL
      const pgFestivals = await drizzle.select().from(schema.festivals);
      if (pgFestivals && pgFestivals.length > 0) {
        this.data.festivals = pgFestivals.map((f) => ({
          id: f.id,
          name: f.name,
          emoji: f.emoji,
          accent: f.accent,
          month: f.month,
          description: f.description || undefined,
          coverUrl: f.coverUrl || undefined,
          status: f.status || "published",
          isCustom: f.isCustom ?? false,
        }));
      }

      // 4. Hydrate years from PostgreSQL
      const pgYears = await drizzle
        .select({ year: schema.years.year })
        .from(schema.years)
        .orderBy(desc(schema.years.year));
      if (pgYears && pgYears.length > 0) {
        this.data.years = pgYears.map((y) => y.year);
      }

      // 5. Reconcile PostgreSQL schema.albums.photoCount with schema.images counts
      try {
        const counts = await drizzle
          .select({
            albumId: schema.images.albumId,
            count: sql<number>`count(*)`,
          })
          .from(schema.images)
          .where(
            and(sql`${schema.images.status} != 'trashed'`, sql`${schema.images.deletedAt} IS NULL`),
          )
          .groupBy(schema.images.albumId);

        for (const row of counts) {
          await drizzle
            .update(schema.albums)
            .set({
              photoCount: Number(row.count),
            })
            .where(eq(schema.albums.id, row.albumId));
        }
      } catch {
        // non-blocking
      }

      console.log(
        `[Wat Peareang Archive]: Hydrated memory state from PostgreSQL (${this.data.festivals.length} festivals, ${this.data.years.length} years, ${this.data.users.length} users).`,
      );
    } catch (err) {
      console.warn("[Wat Peareang Archive]: Failed to hydrate from PostgreSQL:", err);
    }
  }

  private async ensureSuperAdminInPostgres(): Promise<void> {
    const drizzle = getDrizzleDb();
    if (!drizzle) return;

    try {
      const initialEmail = (process.env["ADMIN_INITIAL_EMAIL"] || "shalvannouyear2005@gmail.com")
        .toLowerCase()
        .trim();
      const initialPass = process.env["ADMIN_INITIAL_PASSWORD"] || "NenNou2026";

      const [existingUser] = await drizzle
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.email, initialEmail))
        .limit(1);

      if (!existingUser) {
        const superAdminId = "super-admin-root";
        const passwordHash = hashPassword(initialPass);
        await drizzle
          .insert(schema.users)
          .values({
            id: superAdminId,
            email: initialEmail,
            name: "អគ្គអ្នកគ្រប់គ្រង (Super Admin)",
            role: "super_admin",
            permissions: JSON.stringify([
              "view_images",
              "upload_images",
              "edit_images",
              "delete_images",
              "manage_festivals",
              "manage_years",
              "manage_albums",
              "manage_users",
              "view_logs",
              "manage_settings",
            ]),
            status: "active",
            passwordHash,
          })
          .onConflictDoNothing();
      }
    } catch (err) {
      console.warn("[Wat Peareang Archive]: PostgreSQL SuperAdmin sync warning:", err);
    }
  }

  private loadDatabase(): DatabaseSchema {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const content = fs.readFileSync(DB_FILE, "utf-8");
        const parsed = JSON.parse(content);
        return {
          users: parsed.users || [],
          sessions: parsed.sessions || [],
          festivals: parsed.festivals?.length ? parsed.festivals : this.getInitialFestivals(),
          years: parsed.years?.length ? parsed.years : defaultYears,
          albums: parsed.albums || [],
          images: parsed.images || [],
          activityLogs: parsed.activityLogs || [],
          reports: parsed.reports || [],
          notifications: parsed.notifications || [],
          visitorSessions: parsed.visitorSessions || [],
          viewsLog: parsed.viewsLog || [],
          likes: parsed.likes || [],
          favorites: parsed.favorites || [],
        };
      }
    } catch (e) {
      console.warn("Could not read database file, initializing in-memory store:", e);
    }

    return {
      users: [],
      sessions: [],
      festivals: this.getInitialFestivals(),
      years: defaultYears,
      albums: [],
      images: [],
      activityLogs: [],
      reports: [],
      notifications: [],
      visitorSessions: [],
      viewsLog: [],
      likes: [],
      favorites: [],
    };
  }

  private getInitialFestivals(): StoredFestival[] {
    return defaultFestivals.map((f) => ({
      id: f.id,
      name: f.name,
      emoji: f.emoji,
      accent: f.accent,
      month: f.month,
      isCustom: false,
    }));
  }

  private save() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), "utf-8");
    } catch (e) {
      console.error("Failed to persist database file:", e);
    }
  }

  private ensureSuperAdmin() {
    const existingSuperAdmin = this.data.users.find((u) => u.role === "super_admin");
    const initialEmail = process.env["ADMIN_INITIAL_EMAIL"] || "shalvannouyear2005@gmail.com";
    const initialPass = process.env["ADMIN_INITIAL_PASSWORD"] || "NenNou2026";

    if (!existingSuperAdmin) {
      const superAdmin: StoredUser = {
        id: "super-admin-root",
        email: initialEmail.toLowerCase().trim(),
        name: "អគ្គអ្នកគ្រប់គ្រង (Super Admin)",
        role: "super_admin",
        permissions: [
          "view_images",
          "upload_images",
          "edit_images",
          "delete_images",
          "manage_festivals",
          "manage_years",
          "manage_albums",
          "manage_users",
          "view_logs",
          "manage_settings",
        ],
        status: "active",
        createdAt: new Date().toISOString(),
        passwordHash: hashPassword(initialPass),
      };

      this.data.users.unshift(superAdmin);
      this.logActivity({
        userId: superAdmin.id,
        userName: superAdmin.name,
        userRole: "super_admin",
        action: "INITIALIZE_SYSTEM",
        resource: "SYSTEM",
        details: "ប្រព័ន្ធត្រូវបានចាប់ផ្ដើមជាមួយ Super Admin ដំបូង",
      });
      this.save();
    }
  }

  // --- USER & RBAC OPERATIONS ---
  public getSuperAdminCount(): number {
    return this.data.users.filter((u) => u.role === "super_admin").length;
  }

  public getUsers(): User[] {
    return this.data.users.map(({ passwordHash: _, ...user }) => user);
  }

  public findUserById(id: string): User | undefined {
    const user = this.data.users.find((u) => u.id === id);
    if (!user) return undefined;
    const { passwordHash: _, ...rest } = user;
    return rest;
  }

  public async findUserByIdAsync(id: string): Promise<User | undefined> {
    const existing = this.findUserById(id);
    if (existing) return existing;

    const drizzle = getDrizzleDb();
    if (drizzle) {
      try {
        const rows = await drizzle
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, id))
          .limit(1);

        const u = rows[0];
        if (u) {
          const user: User = {
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role as UserRole,
            permissions:
              typeof u.permissions === "string"
                ? JSON.parse(u.permissions)
                : (u.permissions as Permission[]),
            status: u.status as "active" | "disabled",
            createdAt: u.createdAt.toISOString(),
            ...(u.lastLoginAt ? { lastLoginAt: u.lastLoginAt.toISOString() } : {}),
          };
          const stored: StoredUser = {
            ...user,
            passwordHash: u.passwordHash,
          };
          this.data.users.push(stored);
          return user;
        }
      } catch (err) {
        console.warn("[PostgreSQL findUserByIdAsync Error]:", err);
      }
    }

    return undefined;
  }

  public findUserByEmail(email: string): StoredUser | undefined {
    const clean = email.toLowerCase().trim();
    return this.data.users.find((u) => u.email.toLowerCase().trim() === clean);
  }

  public async findUserByEmailAsync(email: string): Promise<StoredUser | undefined> {
    const clean = email.toLowerCase().trim();
    const existing = this.findUserByEmail(clean);
    if (existing) return existing;

    const drizzle = getDrizzleDb();
    if (drizzle) {
      try {
        const rows = await drizzle
          .select()
          .from(schema.users)
          .where(eq(schema.users.email, clean))
          .limit(1);

        const u = rows[0];
        if (u) {
          const stored: StoredUser = {
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role as UserRole,
            permissions:
              typeof u.permissions === "string"
                ? JSON.parse(u.permissions)
                : (u.permissions as Permission[]),
            status: u.status as "active" | "disabled",
            createdAt: u.createdAt.toISOString(),
            passwordHash: u.passwordHash,
            ...(u.lastLoginAt ? { lastLoginAt: u.lastLoginAt.toISOString() } : {}),
          };
          this.data.users.push(stored);
          return stored;
        }
      } catch (err) {
        console.warn("[PostgreSQL findUserByEmailAsync Error]:", err);
      }
    }

    return undefined;
  }
  public createUser(
    params: {
      name: string;
      email: string;
      password: string;
      role?: UserRole;
      permissions: Permission[];
    },
    creatorId: string,
  ): { user?: User; error?: string } {
    const creator = this.findUserById(creatorId);
    if (!creator || (creator.role !== "super_admin" && creator.role !== "admin")) {
      return { error: "លោកអ្នកមិនមានសិទ្ធិគ្រប់គ្រងគណនីអ្នកប្រើប្រាស់ឡើយ។" };
    }

    const cleanEmail = params.email.toLowerCase().trim();
    if (this.findUserByEmail(cleanEmail)) {
      return { error: "អ៊ីមែលនេះមានក្នុងប្រព័ន្ធរួចហើយ។" };
    }

    const targetRole: UserRole = params.role || "editor";
    if (targetRole === "super_admin" && creator.role !== "super_admin") {
      return { error: "មានតែ Super Admin ប៉ុណ្ណោះដែលអាចបង្កើត Super Admin ថ្មីបាន។" };
    }

    const newUser: StoredUser = {
      id: `user-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
      email: cleanEmail,
      name: params.name.trim(),
      role: targetRole,
      permissions: params.permissions,
      status: "active",
      createdAt: new Date().toISOString(),
      passwordHash: hashPassword(params.password),
    };

    this.data.users.push(newUser);
    this.logActivity({
      userId: creator.id,
      userName: creator.name,
      userRole: creator.role,
      action: "CREATE_USER",
      resource: "USER",
      resourceId: newUser.id,
      details: `បានបង្កើតគណនី (${newUser.role}) ឈ្មោះ ${newUser.name} (${newUser.email})`,
    });
    this.save();

    // Async sync to Postgres if available
    this.syncUserToPostgres(newUser);

    const { passwordHash: _, ...safeUser } = newUser;
    return { user: safeUser };
  }

  // Alias for backward compatibility
  public createEditor(
    params: {
      name: string;
      email: string;
      password: string;
      permissions: Permission[];
    },
    creatorId: string,
  ): { user?: User; error?: string } {
    return this.createUser({ ...params, role: "editor" }, creatorId);
  }

  private async syncUserToPostgres(user: StoredUser) {
    const drizzle = getDrizzleDb();
    if (!drizzle) return;
    try {
      await drizzle
        .insert(schema.users)
        .values({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          permissions: JSON.stringify(user.permissions),
          status: user.status,
          passwordHash: user.passwordHash,
          createdAt: new Date(user.createdAt),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.users.id,
          set: {
            email: user.email,
            name: user.name,
            role: user.role,
            permissions: JSON.stringify(user.permissions),
            status: user.status,
            passwordHash: user.passwordHash,
            updatedAt: new Date(),
          },
        });
    } catch (err) {
      console.warn("[PostgreSQL Sync Error (User)]:", err);
    }
  }

  public updateUser(
    id: string,
    params: {
      name?: string;
      email?: string;
      password?: string;
      role?: UserRole;
      permissions?: Permission[];
      status?: "active" | "disabled";
    },
    updaterId: string,
  ): { user?: User; error?: string } {
    const updater = this.findUserById(updaterId);
    if (!updater || (updater.role !== "super_admin" && updater.role !== "admin")) {
      return { error: "លោកអ្នកមិនមានសិទ្ធិកែសម្រួលគណនីអ្នកប្រើប្រាស់ឡើយ។" };
    }

    const user = this.data.users.find((u) => u.id === id);
    if (!user) {
      return { error: "រកមិនឃើញគណនីនេះទេ។" };
    }

    if (user.role === "super_admin" && updater.role !== "super_admin") {
      return { error: "មិនអាចកែប្រែគណនី Super Admin បានឡើយ។" };
    }

    if (user.role === "super_admin" && params.status === "disabled") {
      return { error: "មិនអាច Disable Super Admin បានឡើយ។" };
    }

    if (params.role && updater.role !== "super_admin" && params.role === "super_admin") {
      return { error: "មានតែ Super Admin ប៉ុណ្ណោះដែលអាចកំណត់ Role ជា Super Admin បាន។" };
    }

    if (params.name) user.name = params.name.trim();
    if (params.email) {
      const cleanEmail = params.email.toLowerCase().trim();
      const existing = this.findUserByEmail(cleanEmail);
      if (existing && existing.id !== user.id) {
        return { error: "អ៊ីមែលនេះត្រូវបានប្រើប្រាស់ដោយគណនីផ្សេងរួចហើយ។" };
      }
      user.email = cleanEmail;
    }
    if (params.password) {
      user.passwordHash = hashPassword(params.password);
    }
    if (params.role && user.role !== "super_admin") {
      user.role = params.role;
    }
    if (params.permissions && user.role !== "super_admin") {
      user.permissions = params.permissions;
    }
    if (params.status && user.role !== "super_admin") {
      user.status = params.status;
    }

    this.logActivity({
      userId: updater.id,
      userName: updater.name,
      userRole: updater.role,
      action: "UPDATE_USER",
      resource: "USER",
      resourceId: user.id,
      details: `បានកែសម្រួលគណនី ${user.name} (${user.email})`,
    });
    this.save();
    this.syncUserToPostgres(user);

    const { passwordHash: _, ...safeUser } = user;
    return { user: safeUser };
  }

  // Alias for backward compatibility
  public updateEditor(
    id: string,
    params: {
      name?: string;
      email?: string;
      password?: string;
      permissions?: Permission[];
      status?: "active" | "disabled";
    },
    updaterId: string,
  ): { user?: User; error?: string } {
    return this.updateUser(id, params, updaterId);
  }

  public deleteUser(id: string, requesterId: string): { success: boolean; error?: string } {
    const requester = this.findUserById(requesterId);
    if (!requester || requester.role !== "super_admin") {
      return { success: false, error: "មានតែ Super Admin ប៉ុណ្ណោះដែលអាចលុបគណនីបាន។" };
    }

    if (requesterId === id) {
      return { success: false, error: "មិនអាចលុបគណនីផ្ទាល់ខ្លួនឯងបានឡើយ។" };
    }

    const targetUser = this.data.users.find((u) => u.id === id);
    if (!targetUser) {
      return { success: false, error: "រកមិនឃើញគណនីនេះទេ។" };
    }

    if (targetUser.role === "super_admin") {
      return { success: false, error: "មិនអនុញ្ញាតឱ្យលុប Super Admin ជាដាច់ខាត!" };
    }

    this.data.users = this.data.users.filter((u) => u.id !== id);
    this.data.sessions = this.data.sessions.filter((s) => s.userId !== id);

    this.logActivity({
      userId: requester.id,
      userName: requester.name,
      userRole: requester.role,
      action: "DELETE_USER",
      resource: "USER",
      resourceId: id,
      details: `បានលុបគណនី ${targetUser.name} (${targetUser.email})`,
    });
    this.save();

    // Async delete from Postgres
    const drizzle = getDrizzleDb();
    if (drizzle) {
      drizzle
        .delete(schema.users)
        .where(eq(schema.users.id, id))
        .catch(() => {});
    }

    return { success: true };
  }

  // Alias for backward compatibility
  public deleteEditor(id: string, requesterId: string): { success: boolean; error?: string } {
    return this.deleteUser(id, requesterId);
  }

  public changePassword(userId: string, newPass: string): boolean {
    const user = this.data.users.find((u) => u.id === userId);
    if (!user) return false;
    user.passwordHash = hashPassword(newPass);
    this.save();
    this.syncUserToPostgres(user);
    return true;
  }

  public updateLastLogin(userId: string) {
    const user = this.data.users.find((u) => u.id === userId);
    if (user) {
      user.lastLoginAt = new Date().toISOString();
      this.save();
      const drizzle = getDrizzleDb();
      if (drizzle) {
        drizzle
          .update(schema.users)
          .set({ lastLoginAt: new Date() })
          .where(eq(schema.users.id, userId))
          .catch(() => {});
      }
    }
  }
  public getAdminShortcut(): {
    key: string;
    ctrlKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
    metaKey?: boolean;
    targetRoute?: string;
  } {
    return (
      this.data.adminShortcut || {
        key: "A",
        ctrlKey: true,
        shiftKey: true,
        altKey: false,
        metaKey: false,
        targetRoute: "/admin",
      }
    );
  }

  public setAdminShortcut(shortcut: {
    key: string;
    ctrlKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
    metaKey?: boolean;
    targetRoute?: string;
  }) {
    this.data.adminShortcut = shortcut;
    this.save();
    return shortcut;
  }

  // --- SESSIONS ---
  public async createSessionAsync(
    userId: string,
    userAgent?: string,
    ip?: string,
  ): Promise<Session> {
    const user = (await this.findUserByIdAsync(userId)) || this.findUserById(userId);
    const isSuperAdmin = user?.role === "super_admin";
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const token = crypto.randomBytes(32).toString("hex");

    const session: Session = {
      token,
      userId,
      expiresAt,
      createdAt: new Date().toISOString(),
      ...(userAgent ? { userAgent } : {}),
      ...(ip ? { ip } : {}),
    };

    const now = Date.now();
    let remainingSessions = this.data.sessions.filter((s) => s.expiresAt > now);

    if (isSuperAdmin) {
      remainingSessions = remainingSessions.filter((s) => s.userId !== userId);
    }

    remainingSessions.push(session);
    this.data.sessions = remainingSessions;
    this.save();

    // Authoritative sync session to Postgres
    const drizzle = getDrizzleDb();
    if (drizzle) {
      try {
        if (isSuperAdmin) {
          await drizzle.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
        }
        await drizzle.insert(schema.sessions).values({
          token: session.token,
          userId: session.userId,
          userAgent: session.userAgent || null,
          ip: session.ip || null,
          expiresAt: new Date(session.expiresAt),
          createdAt: new Date(session.createdAt),
        });
      } catch (e) {
        console.error("[PostgreSQL createSessionAsync Error]:", e);
      }
    }

    return session;
  }

  public createSession(userId: string, userAgent?: string, ip?: string): Session {
    const user = this.findUserById(userId);
    const isSuperAdmin = user?.role === "super_admin";
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const token = crypto.randomBytes(32).toString("hex");

    const session: Session = {
      token,
      userId,
      expiresAt,
      createdAt: new Date().toISOString(),
      ...(userAgent ? { userAgent } : {}),
      ...(ip ? { ip } : {}),
    };

    const now = Date.now();
    let remainingSessions = this.data.sessions.filter((s) => s.expiresAt > now);

    if (isSuperAdmin) {
      remainingSessions = remainingSessions.filter((s) => s.userId !== userId);
    }

    remainingSessions.push(session);
    this.data.sessions = remainingSessions;
    this.save();

    const drizzle = getDrizzleDb();
    if (drizzle) {
      if (isSuperAdmin) {
        drizzle
          .delete(schema.sessions)
          .where(eq(schema.sessions.userId, userId))
          .catch(() => {});
      }
      drizzle
        .insert(schema.sessions)
        .values({
          token: session.token,
          userId: session.userId,
          userAgent: session.userAgent || null,
          ip: session.ip || null,
          expiresAt: new Date(session.expiresAt),
          createdAt: new Date(session.createdAt),
        })
        .catch(() => {});
    }

    return session;
  }

  public cacheSession(session: Session) {
    const now = Date.now();
    this.data.sessions = this.data.sessions.filter(
      (s) => s.token !== session.token && s.expiresAt > now,
    );
    this.data.sessions.push(session);
  }

  public getUserSessions(userId: string): Session[] {
    const now = Date.now();
    return this.data.sessions.filter((s) => s.userId === userId && s.expiresAt > now);
  }

  public isSuperAdminSessionActive(userId: string, token: string): boolean {
    const session = this.getSession(token);
    return !!session && session.userId === userId;
  }

  public getSession(token: string): Session | undefined {
    const session = this.data.sessions.find((s) => s.token === token);
    if (!session) return undefined;
    if (session.expiresAt <= Date.now()) {
      this.deleteSession(token);
      return undefined;
    }
    return session;
  }

  public async deleteSessionAsync(token: string): Promise<void> {
    this.data.sessions = this.data.sessions.filter((s) => s.token !== token);
    this.save();
    const drizzle = getDrizzleDb();
    if (drizzle) {
      try {
        await drizzle.delete(schema.sessions).where(eq(schema.sessions.token, token));
      } catch (e) {
        console.error("[PostgreSQL deleteSessionAsync Error]:", e);
      }
    }
  }

  public deleteSession(token: string) {
    this.data.sessions = this.data.sessions.filter((s) => s.token !== token);
    this.save();
    const drizzle = getDrizzleDb();
    if (drizzle) {
      drizzle
        .delete(schema.sessions)
        .where(eq(schema.sessions.token, token))
        .catch(() => {});
    }
  }

  public async invalidateUserSessionsAsync(userId: string): Promise<void> {
    this.data.sessions = this.data.sessions.filter((s) => s.userId !== userId);
    this.save();
    const drizzle = getDrizzleDb();
    if (drizzle) {
      try {
        await drizzle.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
      } catch (e) {
        console.error("[PostgreSQL invalidateUserSessionsAsync Error]:", e);
      }
    }
  }

  public invalidateUserSessions(userId: string) {
    this.data.sessions = this.data.sessions.filter((s) => s.userId !== userId);
    this.save();
    const drizzle = getDrizzleDb();
    if (drizzle) {
      drizzle
        .delete(schema.sessions)
        .where(eq(schema.sessions.userId, userId))
        .catch(() => {});
    }
  }

  // --- ACTIVITY AUDIT LOGS ---
  public logActivity(params: {
    userId: string;
    userName: string;
    userRole: UserRole;
    action: string;
    resource: string;
    resourceId?: string;
    details?: string;
    ip?: string;
  }) {
    const log: ActivityLog = {
      id: `log-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
      ...params,
      timestamp: new Date().toISOString(),
    };

    this.data.activityLogs.unshift(log);
    if (this.data.activityLogs.length > 1000) {
      this.data.activityLogs = this.data.activityLogs.slice(0, 1000);
    }
    this.save();

    const drizzle = getDrizzleDb();
    if (drizzle) {
      drizzle
        .insert(schema.activityLogs)
        .values({
          id: log.id,
          userId: log.userId,
          userName: log.userName,
          userRole: log.userRole,
          action: log.action,
          resource: log.resource,
          resourceId: log.resourceId || null,
          details: log.details || null,
          ip: log.ip || null,
          timestamp: new Date(log.timestamp),
        })
        .catch(() => {});
    }

    return log;
  }

  public getActivityLogs(limit = 100): ActivityLog[] {
    return this.data.activityLogs.slice(0, limit);
  }

  // --- CONTENT: FESTIVALS, YEARS, ALBUMS, IMAGES ---
  public getFestivals(): StoredFestival[] {
    return this.data.festivals;
  }

  public addFestival(fest: StoredFestival, user: User): { success: boolean; error?: string } {
    if (this.data.festivals.some((f) => f.id === fest.id)) {
      return { success: false, error: "ប្រភេទបុណ្យនេះមានក្នុងបញ្ជីរួចហើយ។" };
    }
    this.data.festivals.push(fest);
    this.logActivity({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: "ADD_FESTIVAL",
      resource: "FESTIVAL",
      resourceId: fest.id,
      details: `បានបន្ថែមពិធីបុណ្យ «${fest.name}» (${fest.emoji})`,
    });
    this.save();

    const drizzle = getDrizzleDb();
    if (drizzle) {
      drizzle
        .insert(schema.festivals)
        .values({
          id: fest.id,
          name: fest.name,
          emoji: fest.emoji,
          accent: fest.accent,
          month: fest.month,
          description: fest.description || null,
          coverUrl: fest.coverUrl || null,
          isCustom: fest.isCustom ?? false,
          status: "published",
        })
        .catch(() => {});
    }

    return { success: true };
  }

  public updateFestival(
    id: string,
    updates: Partial<StoredFestival>,
    user: User,
  ): { success: boolean; error?: string } {
    const target = this.data.festivals.find((f) => f.id === id);
    if (!target) return { success: false, error: "រកមិនឃើញបុណ្យនេះទេ។" };

    Object.assign(target, updates);
    this.logActivity({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: "EDIT_FESTIVAL",
      resource: "FESTIVAL",
      resourceId: id,
      details: `បានកែប្រែព័ត៌មានបុណ្យ «${target.name}»`,
    });
    this.save();

    const drizzle = getDrizzleDb();
    if (drizzle) {
      drizzle
        .update(schema.festivals)
        .set({
          name: target.name,
          emoji: target.emoji,
          accent: target.accent,
          month: target.month,
          description: target.description || null,
          coverUrl: target.coverUrl || null,
          status: target.status || "published",
          updatedAt: new Date(),
        })
        .where(eq(schema.festivals.id, id))
        .catch(() => {});
    }

    return { success: true };
  }

  public trashFestival(id: string, user: User): { success: boolean; error?: string } {
    const target = this.data.festivals.find((f) => f.id === id);
    if (!target) return { success: false, error: "រកមិនឃើញបុណ្យនេះទេ។" };

    target.status = "trashed";
    this.logActivity({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: "TRASH_FESTIVAL",
      resource: "FESTIVAL",
      resourceId: id,
      details: `បានផ្លាស់ទីពិធីបុណ្យ «${target.name}» ទៅកាន់ធុងសំរាម (Trash)`,
    });
    this.save();

    const drizzle = getDrizzleDb();
    if (drizzle) {
      drizzle
        .update(schema.festivals)
        .set({
          status: "trashed",
          updatedAt: new Date(),
        })
        .where(eq(schema.festivals.id, id))
        .catch(() => {});
    }

    return { success: true };
  }

  public restoreFestival(id: string, user: User): { success: boolean; error?: string } {
    const target = this.data.festivals.find((f) => f.id === id);
    if (!target) return { success: false, error: "រកមិនឃើញបុណ្យនេះទេ។" };

    target.status = "published";
    this.logActivity({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: "RESTORE_FESTIVAL",
      resource: "FESTIVAL",
      resourceId: id,
      details: `បានស្តារពិធីបុណ្យ «${target.name}» ឡើងវិញពីធុងសំរាម`,
    });
    this.save();

    const drizzle = getDrizzleDb();
    if (drizzle) {
      drizzle
        .update(schema.festivals)
        .set({
          status: "published",
          updatedAt: new Date(),
        })
        .where(eq(schema.festivals.id, id))
        .catch(() => {});
    }

    return { success: true };
  }

  public permanentDeleteFestival(id: string, user: User): { success: boolean; error?: string } {
    if (user.role !== "super_admin") {
      return { success: false, error: "មានតែ Super Admin ប៉ុណ្ណោះដែលអាចលុបជាអចិន្ត្រៃយ៍បាន។" };
    }

    const target = this.data.festivals.find((f) => f.id === id);
    if (!target) return { success: false, error: "រកមិនឃើញបុណ្យនេះទេ។" };

    // Check if dependent active albums exist
    const hasActiveAlbums = this.data.albums.some(
      (a) => a.festivalId === id && a.status !== "trashed",
    );
    if (hasActiveAlbums) {
      return {
        success: false,
        error: "មិនអាចលុបពិធីបុណ្យនេះបានទេ ព្រោះនៅមាន Album សកម្មដែលកំពុងប្រើប្រាស់។",
      };
    }

    this.data.festivals = this.data.festivals.filter((f) => f.id !== id);
    this.logActivity({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: "PERMANENT_DELETE_FESTIVAL",
      resource: "FESTIVAL",
      resourceId: id,
      details: `បានលុបពិធីបុណ្យ «${target.name}» ជាអចិន្ត្រៃយ៍`,
    });
    this.save();

    const drizzle = getDrizzleDb();
    if (drizzle) {
      drizzle
        .delete(schema.festivals)
        .where(eq(schema.festivals.id, id))
        .catch(() => {});
    }

    return { success: true };
  }

  public deleteFestival(id: string, user: User): { success: boolean; error?: string } {
    return this.trashFestival(id, user);
  }

  public getYears(): number[] {
    return this.data.years.sort((a, b) => b - a);
  }

  public addYear(year: number, user: User): { success: boolean; error?: string } {
    if (this.data.years.includes(year)) {
      return { success: false, error: `ឆ្នាំ ${year} មានរួចហើយ។` };
    }
    this.data.years.push(year);
    this.data.years.sort((a, b) => b - a);
    this.logActivity({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: "ADD_YEAR",
      resource: "YEAR",
      resourceId: String(year),
      details: `បានបន្ថែមឆ្នាំ ${year} ក្នុងបណ្ណសារ`,
    });
    this.save();

    const drizzle = getDrizzleDb();
    if (drizzle) {
      drizzle
        .insert(schema.years)
        .values({ year })
        .onConflictDoNothing()
        .catch(() => {});
    }

    return { success: true };
  }

  public trashYear(year: number, user: User): { success: boolean; error?: string } {
    if (!this.data.years.includes(year)) {
      return { success: false, error: "រកមិនឃើញឆ្នាំនេះទេ។" };
    }
    this.data.years = this.data.years.filter((y) => y !== year);
    this.logActivity({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: "TRASH_YEAR",
      resource: "YEAR",
      resourceId: String(year),
      details: `បានដកឆ្នាំ ${year} ចេញពីបញ្ជីសកម្ម`,
    });
    this.save();

    const drizzle = getDrizzleDb();
    if (drizzle) {
      drizzle
        .delete(schema.years)
        .where(eq(schema.years.year, year))
        .catch(() => {});
    }

    return { success: true };
  }

  public deleteYear(year: number, user: User): { success: boolean; error?: string } {
    return this.trashYear(year, user);
  }

  public getAlbums(): StoredAlbum[] {
    return this.data.albums;
  }

  public addAlbum(album: StoredAlbum, user: User): { success: boolean; error?: string } {
    if (this.data.albums.some((a) => a.id === album.id)) {
      return { success: false, error: "Album នេះមានរួចហើយ។" };
    }
    this.data.albums.push(album);
    this.logActivity({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: "ADD_ALBUM",
      resource: "ALBUM",
      resourceId: album.id,
      details: `បានបង្កើត Album «${album.title}» ឆ្នាំ ${album.year}`,
    });
    this.save();

    const drizzle = getDrizzleDb();
    if (drizzle) {
      drizzle
        .insert(schema.albums)
        .values({
          id: album.id,
          festivalId: album.festivalId,
          year: album.year,
          title: album.title,
          description: album.description || null,
          location: album.location || "វត្តពារាំង",
          coverImage: album.coverImage || null,
          photoCount: album.photoCount || 0,
          status: "published",
        })
        .onConflictDoNothing()
        .catch(() => {});
    }

    return { success: true };
  }

  public updateAlbum(
    id: string,
    updates: Partial<StoredAlbum>,
    user: User,
  ): { success: boolean; error?: string } {
    const album = this.data.albums.find((a) => a.id === id);
    if (!album) return { success: false, error: "រកមិនឃើញ Album នេះទេ។" };
    Object.assign(album, updates);
    this.logActivity({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: "EDIT_ALBUM",
      resource: "ALBUM",
      resourceId: id,
      details: `បានកែសម្រួល Album «${album.title}»`,
    });
    this.save();

    const drizzle = getDrizzleDb();
    if (drizzle) {
      drizzle
        .update(schema.albums)
        .set({
          festivalId: album.festivalId,
          year: album.year,
          title: album.title,
          description: album.description || null,
          location: album.location,
          coverImage: album.coverImage || null,
          status: album.status || "published",
          updatedAt: new Date(),
        })
        .where(eq(schema.albums.id, id))
        .catch(() => {});
    }

    return { success: true };
  }

  public trashAlbum(id: string, user: User): { success: boolean; error?: string } {
    const album = this.data.albums.find((a) => a.id === id);
    if (!album) return { success: false, error: "រកមិនឃើញ Album នេះទេ។" };

    album.status = "trashed";
    this.logActivity({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: "TRASH_ALBUM",
      resource: "ALBUM",
      resourceId: id,
      details: `បានផ្លាស់ទី Album «${album.title}» ទៅកាន់ធុងសំរាម`,
    });
    this.save();

    const drizzle = getDrizzleDb();
    if (drizzle) {
      drizzle
        .update(schema.albums)
        .set({
          status: "trashed",
          updatedAt: new Date(),
        })
        .where(eq(schema.albums.id, id))
        .catch(() => {});
    }

    return { success: true };
  }

  public restoreAlbum(id: string, user: User): { success: boolean; error?: string } {
    const album = this.data.albums.find((a) => a.id === id);
    if (!album) return { success: false, error: "រកមិនឃើញ Album នេះទេ។" };

    album.status = "published";
    this.logActivity({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: "RESTORE_ALBUM",
      resource: "ALBUM",
      resourceId: id,
      details: `បានស្តារ Album «${album.title}» ឡើងវិញពីធុងសំរាម`,
    });
    this.save();

    const drizzle = getDrizzleDb();
    if (drizzle) {
      drizzle
        .update(schema.albums)
        .set({
          status: "published",
          updatedAt: new Date(),
        })
        .where(eq(schema.albums.id, id))
        .catch(() => {});
    }

    return { success: true };
  }

  public permanentDeleteAlbum(id: string, user: User): { success: boolean; error?: string } {
    if (user.role !== "super_admin") {
      return { success: false, error: "មានតែ Super Admin ប៉ុណ្ណោះដែលអាចលុបជាអចិន្ត្រៃយ៍បាន។" };
    }

    const album = this.data.albums.find((a) => a.id === id);
    if (!album) return { success: false, error: "រកមិនឃើញ Album នេះទេ។" };

    this.data.albums = this.data.albums.filter((a) => a.id !== id);
    this.data.images = this.data.images.filter((img) => img.albumId !== id);
    this.logActivity({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: "PERMANENT_DELETE_ALBUM",
      resource: "ALBUM",
      resourceId: id,
      details: `បានលុប Album «${album.title}» ជាអចិន្ត្រៃយ៍`,
    });
    this.save();

    const drizzle = getDrizzleDb();
    if (drizzle) {
      drizzle
        .delete(schema.images)
        .where(eq(schema.images.albumId, id))
        .catch(() => {});
      drizzle
        .delete(schema.albums)
        .where(eq(schema.albums.id, id))
        .catch(() => {});
    }

    return { success: true };
  }

  public deleteAlbum(id: string, user: User): { success: boolean; error?: string } {
    return this.trashAlbum(id, user);
  }

  public getImages(albumId?: string): StoredImage[] {
    if (albumId) {
      return this.data.images.filter((img) => img.albumId === albumId && img.status !== "trashed");
    }
    return this.data.images.filter((img) => img.status !== "trashed");
  }

  public addImage(img: StoredImage, user: User) {
    this.data.images.unshift(img);
    this.logActivity({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: "UPLOAD_IMAGE",
      resource: "IMAGE",
      resourceId: img.id,
      details: `បានបង្ហោះរូបភាព ${img.title} ចូល Album #${img.albumId}`,
    });
    this.save();

    const drizzle = getDrizzleDb();
    if (drizzle) {
      drizzle
        .insert(schema.images)
        .values({
          id: img.id,
          albumId: img.albumId,
          title: img.title,
          description: img.description || null,
          url: img.url,
          thumbnailUrl: img.thumbnailUrl || null,
          size: img.size || 0,
          mimeType: img.mimeType || "image/jpeg",
          uploadedBy: img.uploadedBy || null,
          status: "published",
        })
        .onConflictDoNothing()
        .catch(() => {});
    }
  }

  public updateImage(
    id: string,
    updates: Partial<StoredImage>,
    user: User,
  ): { success: boolean; error?: string } {
    const img = this.data.images.find((i) => i.id === id);
    if (!img) return { success: false, error: "រកមិនឃើញរូបភាពនេះទេ។" };

    Object.assign(img, updates);
    this.logActivity({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: "UPDATE_IMAGE",
      resource: "IMAGE",
      resourceId: id,
      details: `បានកែប្រែព័ត៌មានរូបភាព ${img.title}`,
    });
    this.save();

    const drizzle = getDrizzleDb();
    if (drizzle) {
      drizzle
        .update(schema.images)
        .set({
          title: img.title,
          description: img.description || null,
          albumId: img.albumId,
          photographer: img.photographer || null,
          tags: img.tags || null,
          status: img.status || "published",
          updatedAt: new Date(),
        })
        .where(eq(schema.images.id, id))
        .catch(() => {});
    }

    return { success: true };
  }

  public trashImage(id: string, user: User): { success: boolean; error?: string } {
    const img = this.data.images.find((i) => i.id === id);
    if (!img) return { success: false, error: "រកមិនឃើញរូបភាពនេះទេ។" };

    img.status = "trashed";
    this.logActivity({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: "TRASH_IMAGE",
      resource: "IMAGE",
      resourceId: id,
      details: `បានផ្លាស់ទីរូបភាព ${img.title} ទៅកាន់ធុងសំរាម`,
    });
    this.save();

    const drizzle = getDrizzleDb();
    if (drizzle) {
      drizzle
        .update(schema.images)
        .set({
          status: "trashed",
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(schema.images.id, id))
        .catch(() => {});
    }

    return { success: true };
  }

  public restoreImage(id: string, user: User): { success: boolean; error?: string } {
    const img = this.data.images.find((i) => i.id === id);
    if (!img) return { success: false, error: "រកមិនឃើញរូបភាពនេះទេ។" };

    img.status = "published";
    this.logActivity({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: "RESTORE_IMAGE",
      resource: "IMAGE",
      resourceId: id,
      details: `បានស្តាររូបភាព ${img.title} ឡើងវិញពីធុងសំរាម`,
    });
    this.save();

    const drizzle = getDrizzleDb();
    if (drizzle) {
      drizzle
        .update(schema.images)
        .set({
          status: "published",
          deletedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.images.id, id))
        .catch(() => {});
    }

    return { success: true };
  }

  public permanentDeleteImage(id: string, user: User): { success: boolean; error?: string } {
    if (user.role !== "super_admin") {
      return { success: false, error: "មានតែ Super Admin ប៉ុណ្ណោះដែលអាចលុបជាអចិន្ត្រៃយ៍បាន។" };
    }

    const img = this.data.images.find((i) => i.id === id);
    if (!img) return { success: false, error: "រកមិនឃើញរូបភាពនេះទេ។" };

    this.data.images = this.data.images.filter((i) => i.id !== id);
    this.logActivity({
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: "PERMANENT_DELETE_IMAGE",
      resource: "IMAGE",
      resourceId: id,
      details: `បានលុបរូបភាព ${img.title} ជាអចិន្ត្រៃយ៍`,
    });
    this.save();

    const drizzle = getDrizzleDb();
    if (drizzle) {
      drizzle
        .delete(schema.images)
        .where(eq(schema.images.id, id))
        .catch(() => {});
    }

    return { success: true };
  }

  public batchTrashImages(ids: string[], user: User): { success: boolean; affected: number } {
    const idSet = new Set(ids);
    let count = 0;
    for (const img of this.data.images) {
      if (idSet.has(img.id) && img.status !== "trashed") {
        img.status = "trashed";
        count++;
      }
    }
    if (count > 0) {
      this.logActivity({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: "BATCH_TRASH_IMAGES",
        resource: "IMAGE",
        details: `បានផ្លាស់ទីរូបភាពចំនួន ${count} ទៅកាន់ធុងសំរាម (Trash)`,
      });
      this.save();

      const drizzle = getDrizzleDb();
      if (drizzle) {
        drizzle
          .update(schema.images)
          .set({
            status: "trashed",
            deletedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(inArray(schema.images.id, ids))
          .catch(() => {});
      }
    }
    return { success: true, affected: count };
  }

  public batchRestoreImages(ids: string[], user: User): { success: boolean; affected: number } {
    const idSet = new Set(ids);
    let count = 0;
    for (const img of this.data.images) {
      if (idSet.has(img.id) && img.status === "trashed") {
        img.status = "published";
        count++;
      }
    }
    if (count > 0) {
      this.logActivity({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: "BATCH_RESTORE_IMAGES",
        resource: "IMAGE",
        details: `បានស្តាររូបភាពចំនួន ${count} ឡើងវិញពីធុងសំរាម`,
      });
      this.save();

      const drizzle = getDrizzleDb();
      if (drizzle) {
        drizzle
          .update(schema.images)
          .set({
            status: "published",
            deletedAt: null,
            updatedAt: new Date(),
          })
          .where(inArray(schema.images.id, ids))
          .catch(() => {});
      }
    }
    return { success: true, affected: count };
  }

  public batchMoveImages(
    ids: string[],
    targetAlbumId: string,
    user: User,
  ): { success: boolean; affected: number; error?: string } {
    const targetAlbum = this.data.albums.find((a) => a.id === targetAlbumId);
    const idSet = new Set(ids);
    let count = 0;
    for (const img of this.data.images) {
      if (idSet.has(img.id)) {
        img.albumId = targetAlbumId;
        count++;
      }
    }
    if (count > 0) {
      this.logActivity({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: "BATCH_MOVE_IMAGES",
        resource: "IMAGE",
        details: `បានផ្លាស់ប្តូរ Album នៃរូបភាពចំនួន ${count} ទៅកាន់ Album #${targetAlbumId}`,
      });
      this.save();

      const drizzle = getDrizzleDb();
      if (drizzle) {
        drizzle
          .update(schema.images)
          .set({
            albumId: targetAlbumId,
            updatedAt: new Date(),
          })
          .where(inArray(schema.images.id, ids))
          .catch(() => {});
      }
    }
    return { success: true, affected: count };
  }

  public batchUpdateImageTags(
    ids: string[],
    tags: string,
    user: User,
  ): { success: boolean; affected: number; error?: string } {
    const idSet = new Set(ids);
    let count = 0;
    for (const img of this.data.images) {
      if (idSet.has(img.id)) {
        img.tags = tags;
        count++;
      }
    }
    if (count > 0) {
      this.logActivity({
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        action: "BATCH_UPDATE_TAGS",
        resource: "IMAGE",
        details: `បានកែសម្រួលស្លាក (Tags) នៃរូបភាពចំនួន ${count} ទៅជា "${tags}"`,
      });
      this.save();

      const drizzle = getDrizzleDb();
      if (drizzle) {
        drizzle
          .update(schema.images)
          .set({
            tags: tags || null,
            updatedAt: new Date(),
          })
          .where(inArray(schema.images.id, ids))
          .catch(() => {});
      }
    }
    return { success: true, affected: count };
  }

  public async reconcileCounts(): Promise<{
    success: boolean;
    reconciledAlbums: number;
    reconciledImages: number;
  }> {
    let reconciledAlbums = 0;
    const reconciledImages = 0;

    // Recalculate local album photo counts
    const albumCountMap = new Map<string, number>();
    for (const img of this.data.images) {
      if (img.status !== "trashed") {
        albumCountMap.set(img.albumId, (albumCountMap.get(img.albumId) || 0) + 1);
      }
    }

    for (const alb of this.data.albums) {
      const realCount = albumCountMap.get(alb.id) || 0;
      if (alb.photoCount !== realCount) {
        alb.photoCount = realCount;
        reconciledAlbums++;
      }
    }
    this.save();

    // Recalculate PostgreSQL counts if connected
    const drizzle = getDrizzleDb();
    if (drizzle) {
      try {
        const counts = await drizzle
          .select({
            albumId: schema.images.albumId,
            count: sql<number>`count(*)`,
          })
          .from(schema.images)
          .where(
            and(sql`${schema.images.status} != 'trashed'`, sql`${schema.images.deletedAt} IS NULL`),
          )
          .groupBy(schema.images.albumId);

        for (const row of counts) {
          await drizzle
            .update(schema.albums)
            .set({
              photoCount: Number(row.count),
              updatedAt: new Date(),
            })
            .where(eq(schema.albums.id, row.albumId));
          reconciledAlbums++;
        }
      } catch (err) {
        console.warn("[reconcileCounts error]:", err);
      }
    }

    return {
      success: true,
      reconciledAlbums,
      reconciledImages,
    };
  }

  public deleteImage(id: string, user: User): { success: boolean; error?: string } {
    return this.trashImage(id, user);
  }

  public getDashboardStats() {
    const totalFestivals = this.data.festivals.length;
    const totalYears = this.data.years.length;
    const totalAlbums = defaultFestivals.length * defaultYears.length + this.data.albums.length;
    const totalImages = this.data.images.length + totalAlbums * 36;
    const editors = this.data.users.filter((u) => u.role === "editor");
    const activeEditors = editors.filter((e) => e.status === "active").length;

    return {
      totalFestivals,
      totalYears,
      totalAlbums,
      totalImages,
      totalEditors: editors.length,
      activeEditors,
      recentActivities: this.getActivityLogs(8),
      recentImages: this.data.images.slice(0, 10),
      isPostgresConnected: this.postgresReady || isPostgresConfigured(),
    };
  }

  // --- PHASE 1 ENGAGEMENT & ANALYTICS FOUNDATION METHODS ---
  // NOTE: the legacy `recordView` implementation that lived here was removed —
  // it was a duplicate of the Phase 3.1 version below (which also handles
  // deduplication and the in-memory fallback).

  public async toggleLike(params: {
    resourceType: "album" | "image";
    resourceId: string;
    visitorId: string;
    userId?: string;
  }): Promise<{ liked: boolean; totalLikes: number }> {
    const drizzle = getDrizzleDb();
    if (!drizzle) {
      return { liked: true, totalLikes: 1 };
    }

    try {
      const existing = await drizzle
        .select()
        .from(schema.likes)
        .where(
          and(
            eq(schema.likes.resourceType, params.resourceType),
            eq(schema.likes.resourceId, params.resourceId),
            eq(schema.likes.visitorId, params.visitorId),
          ),
        );

      let liked = false;
      if (existing.length > 0) {
        await drizzle
          .delete(schema.likes)
          .where(
            and(
              eq(schema.likes.resourceType, params.resourceType),
              eq(schema.likes.resourceId, params.resourceId),
              eq(schema.likes.visitorId, params.visitorId),
            ),
          );
        liked = false;
      } else {
        await drizzle.insert(schema.likes).values({
          resourceType: params.resourceType,
          resourceId: params.resourceId,
          visitorId: params.visitorId,
          userId: params.userId || null,
        });
        liked = true;
      }

      // Count total likes
      const countResult = await drizzle
        .select({ count: sql<number>`count(*)` })
        .from(schema.likes)
        .where(
          and(
            eq(schema.likes.resourceType, params.resourceType),
            eq(schema.likes.resourceId, params.resourceId),
          ),
        );
      const totalLikes = Number(countResult[0]?.count || 0);

      // Update counters
      if (params.resourceType === "album") {
        await drizzle
          .update(schema.albums)
          .set({ likesCount: totalLikes })
          .where(eq(schema.albums.id, params.resourceId));
      } else if (params.resourceType === "image") {
        await drizzle
          .update(schema.images)
          .set({ likesCount: totalLikes })
          .where(eq(schema.images.id, params.resourceId));
      }

      return { liked, totalLikes };
    } catch (e) {
      console.warn("[PostgreSQL toggleLike error]:", e);
      return { liked: true, totalLikes: 1 };
    }
  }

  public async toggleFavorite(params: {
    imageId: string;
    visitorId: string;
    userId?: string;
  }): Promise<{ favorited: boolean }> {
    const drizzle = getDrizzleDb();
    if (!drizzle) return { favorited: true };

    try {
      const existing = await drizzle
        .select()
        .from(schema.favorites)
        .where(
          and(
            eq(schema.favorites.imageId, params.imageId),
            eq(schema.favorites.visitorId, params.visitorId),
          ),
        );

      if (existing.length > 0) {
        await drizzle
          .delete(schema.favorites)
          .where(
            and(
              eq(schema.favorites.imageId, params.imageId),
              eq(schema.favorites.visitorId, params.visitorId),
            ),
          );
        return { favorited: false };
      } else {
        await drizzle.insert(schema.favorites).values({
          imageId: params.imageId,
          visitorId: params.visitorId,
          userId: params.userId || null,
        });
        return { favorited: true };
      }
    } catch (e) {
      console.warn("[PostgreSQL toggleFavorite error]:", e);
      return { favorited: true };
    }
  }

  public async logSearch(query: string, resultsCount: number, visitorId?: string) {
    const drizzle = getDrizzleDb();
    if (!drizzle) return;
    try {
      await drizzle.insert(schema.searchLogs).values({
        query: query.trim(),
        resultsCount,
        visitorId: visitorId || null,
      });
    } catch (e) {
      console.warn("[PostgreSQL logSearch error]:", e);
    }
  }

  // =========================================================================
  // PHASE 3.1 — VISITOR TRACKING & VIEWS ANALYTICS
  // =========================================================================

  public async trackVisitorSession(params: {
    sessionId: string;
    userAgent?: string | undefined;
    userId?: string | undefined;
    device?: string | undefined;
    ipHash?: string | undefined;
  }): Promise<boolean> {
    if (isPostgresConfigured()) {
      const ok = await recordPostgresVisitorSession({
        id: params.sessionId,
        ipHash: params.ipHash,
        userAgent: params.userAgent,
        userId: params.userId,
        device: params.device,
      });
      if (ok) return true;
    }

    // In-memory fallback
    const now = new Date().toISOString();
    const existing = this.data.visitorSessions?.find((s) => s.id === params.sessionId);
    if (existing) {
      existing.lastSeenAt = now;
      existing.updatedAt = now;
      if (params.userId) existing.userId = params.userId;
      if (params.device) existing.device = params.device;
      if (params.userAgent) existing.userAgent = params.userAgent;
    } else {
      if (!this.data.visitorSessions) this.data.visitorSessions = [];
      this.data.visitorSessions.push({
        id: params.sessionId,
        ipHash: params.ipHash,
        userAgent: params.userAgent,
        userId: params.userId,
        device: params.device,
        lastSeenAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }
    this.save();
    return true;
  }

  public async recordView(params: {
    resourceType: "page" | "album" | "image";
    resourceId: string;
    visitorId: string;
    userId?: string | undefined;
  }): Promise<{ recorded: boolean; deduplicated: boolean }> {
    if (isPostgresConfigured()) {
      const pgRes = await recordPostgresView(params);
      if (pgRes.recorded || pgRes.deduplicated) {
        return pgRes;
      }
    }

    // In-memory fallback with deduplication
    const { resourceType, resourceId, visitorId, userId } = params;
    if (!this.data.viewsLog) this.data.viewsLog = [];

    const now = new Date();
    const nowIso = now.toISOString();

    // Check deduplication in last 30s
    const thirtySecsAgo = new Date(now.getTime() - 30_000).toISOString();
    const recentDuplicate = this.data.viewsLog.some(
      (v) =>
        v.resourceType === resourceType &&
        v.resourceId === resourceId &&
        v.visitorId === visitorId &&
        v.createdAt >= thirtySecsAgo,
    );

    if (recentDuplicate) {
      return { recorded: false, deduplicated: true };
    }

    this.data.viewsLog.push({
      id: this.data.viewsLog.length + 1,
      resourceType,
      resourceId,
      visitorId,
      userId,
      createdAt: nowIso,
    });

    if (resourceType === "album") {
      const album = this.data.albums.find((a) => a.id === resourceId);
      if (album) {
        album.viewsCount = (album.viewsCount || 0) + 1;
      }
    } else if (resourceType === "image") {
      const img = this.data.images.find((i) => i.id === resourceId);
      if (img) {
        img.viewsCount = (img.viewsCount || 0) + 1;
      }
    }

    this.save();
    return { recorded: true, deduplicated: false };
  }

  public async getAnalyticsOverview(
    period: "today" | "7d" | "30d" | "all" = "today",
  ): Promise<AdminAnalyticsOverview> {
    if (isPostgresConfigured()) {
      return await getPostgresAnalyticsOverview(period);
    }

    const { startDate: startToday } = getPhnomPenhDateBounds("today");
    const { startDate: start7d } = getPhnomPenhDateBounds("7d");
    const { startDate: start30d } = getPhnomPenhDateBounds("30d");
    const { startDate: startPeriod } = getPhnomPenhDateBounds(period);

    const logs = this.data.viewsLog || [];
    const sessions = this.data.visitorSessions || [];

    const startTodayIso = startToday.toISOString();
    const start7dIso = start7d.toISOString();
    const start30dIso = start30d.toISOString();
    const startPeriodIso = startPeriod.toISOString();

    const visitorsToday = new Set(
      logs.filter((l) => l.createdAt >= startTodayIso).map((l) => l.visitorId),
    ).size;
    const visitorsThisWeek = new Set(
      logs.filter((l) => l.createdAt >= start7dIso).map((l) => l.visitorId),
    ).size;
    const visitorsThisMonth = new Set(
      logs.filter((l) => l.createdAt >= start30dIso).map((l) => l.visitorId),
    ).size;
    const totalVisitors = Math.max(sessions.length, new Set(logs.map((l) => l.visitorId)).size);

    const pageViewsToday = logs.filter(
      (l) => l.resourceType === "page" && l.createdAt >= startTodayIso,
    ).length;
    const pageViewsThisWeek = logs.filter(
      (l) => l.resourceType === "page" && l.createdAt >= start7dIso,
    ).length;
    const pageViewsThisMonth = logs.filter(
      (l) => l.resourceType === "page" && l.createdAt >= start30dIso,
    ).length;
    const totalPageViews = logs.filter((l) => l.resourceType === "page").length;
    const totalAlbumViews = logs.filter((l) => l.resourceType === "album").length;
    const totalImageViews = logs.filter((l) => l.resourceType === "image").length;
    const totalViews = totalPageViews + totalAlbumViews + totalImageViews;

    const periodLogs = period === "all" ? logs : logs.filter((l) => l.createdAt >= startPeriodIso);
    const currentPeriodVisitors =
      period === "all" ? totalVisitors : new Set(periodLogs.map((l) => l.visitorId)).size;
    const currentPeriodPageViews = periodLogs.filter((l) => l.resourceType === "page").length;
    const currentPeriodAlbumViews = periodLogs.filter((l) => l.resourceType === "album").length;
    const currentPeriodImageViews = periodLogs.filter((l) => l.resourceType === "image").length;
    const currentPeriodTotalViews =
      currentPeriodPageViews + currentPeriodAlbumViews + currentPeriodImageViews;

    return {
      visitorsToday,
      visitorsThisWeek,
      visitorsThisMonth,
      totalVisitors,
      pageViewsToday,
      pageViewsThisWeek,
      pageViewsThisMonth,
      totalPageViews,
      totalAlbumViews,
      totalImageViews,
      totalViews,
      period,
      currentPeriodVisitors,
      currentPeriodPageViews,
      currentPeriodAlbumViews,
      currentPeriodImageViews,
      currentPeriodTotalViews,
    };
  }

  public async getAnalyticsViewsSeries(
    period: "today" | "7d" | "30d" = "7d",
  ): Promise<ViewsSeriesPoint[]> {
    if (isPostgresConfigured()) {
      return await getPostgresAnalyticsViewsSeries(period);
    }

    const KHMER_DAYS = ["អាទិត្យ", "ចន្ទ", "អង្គារ", "ពុធ", "ព្រហស្បតិ៍", "សុក្រ", "សៅរ៍"];
    const OFFSET_MS = 7 * 60 * 60 * 1000;
    const logs = this.data.viewsLog || [];
    const now = new Date();

    if (period === "today") {
      const slots: Record<
        number,
        {
          visitors: Set<string>;
          pageViews: number;
          albumViews: number;
          imageViews: number;
        }
      > = {};

      for (let h = 0; h < 24; h += 2) {
        slots[h] = {
          visitors: new Set(),
          pageViews: 0,
          albumViews: 0,
          imageViews: 0,
        };
      }

      const { startDate } = getPhnomPenhDateBounds("today");
      const startDateIso = startDate.toISOString();
      const todayLogs = logs.filter((l) => l.createdAt >= startDateIso);

      for (const log of todayLogs) {
        const d = new Date(new Date(log.createdAt).getTime() + OFFSET_MS);
        const h = Math.floor(d.getUTCHours() / 2) * 2;
        if (slots[h]) {
          slots[h].visitors.add(log.visitorId);
          if (log.resourceType === "page") slots[h].pageViews++;
          else if (log.resourceType === "album") slots[h].albumViews++;
          else if (log.resourceType === "image") slots[h].imageViews++;
        }
      }

      return Object.entries(slots).map(([hourStr, val]) => {
        const h = parseInt(hourStr, 10);
        return {
          date: `${h.toString().padStart(2, "0")}:00`,
          label: `${h.toString().padStart(2, "0")}:00`,
          visitors: val.visitors.size,
          pageViews: val.pageViews,
          albumViews: val.albumViews,
          imageViews: val.imageViews,
          totalViews: val.pageViews + val.albumViews + val.imageViews,
        };
      });
    } else {
      const daysCount = period === "7d" ? 7 : 30;
      const daySlots: Record<
        string,
        {
          label: string;
          visitors: Set<string>;
          pageViews: number;
          albumViews: number;
          imageViews: number;
        }
      > = {};

      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(now.getTime() + OFFSET_MS - i * 24 * 60 * 60 * 1000);
        const dayOfWeek = KHMER_DAYS[d.getUTCDay()];
        const dateNum = d.getUTCDate();
        const dateStr = d.toISOString().split("T")[0]!;
        daySlots[dateStr] = {
          label: `${dayOfWeek} ${dateNum}`,
          visitors: new Set(),
          pageViews: 0,
          albumViews: 0,
          imageViews: 0,
        };
      }

      const { startDate } = getPhnomPenhDateBounds(period);
      const startDateIso = startDate.toISOString();
      const periodLogs = logs.filter((l) => l.createdAt >= startDateIso);

      for (const log of periodLogs) {
        const d = new Date(new Date(log.createdAt).getTime() + OFFSET_MS);
        const dateStr = d.toISOString().split("T")[0]!;
        if (daySlots[dateStr]) {
          daySlots[dateStr].visitors.add(log.visitorId);
          if (log.resourceType === "page") daySlots[dateStr].pageViews++;
          else if (log.resourceType === "album") daySlots[dateStr].albumViews++;
          else if (log.resourceType === "image") daySlots[dateStr].imageViews++;
        }
      }

      return Object.entries(daySlots).map(([dateStr, val]) => ({
        date: dateStr,
        label: val.label,
        visitors: val.visitors.size,
        pageViews: val.pageViews,
        albumViews: val.albumViews,
        imageViews: val.imageViews,
        totalViews: val.pageViews + val.albumViews + val.imageViews,
      }));
    }
  }

  public async getTopAlbums(
    period: "today" | "7d" | "30d" | "all" = "all",
    limit = 10,
  ): Promise<TopAlbumItem[]> {
    if (isPostgresConfigured()) {
      const top = await getPostgresTopAlbums(period, limit);
      if (top && top.length > 0) return top;
    }

    const albums = this.data.albums.filter((a) => a.status !== "trashed");
    const festivals = this.data.festivals || [];

    const sorted = [...albums].sort((a, b) => (b.viewsCount || 0) - (a.viewsCount || 0));
    return sorted.slice(0, limit).map((a, idx) => {
      const fest = festivals.find((f) => f.id === a.festivalId);
      return {
        rank: idx + 1,
        albumId: a.id,
        title: a.title,
        festivalName: fest?.name || "ពិធីបុណ្យ",
        festivalEmoji: fest?.emoji || "🏮",
        festivalAccent: fest?.accent || "#d4af37",
        year: a.year,
        coverImage: a.coverImage,
        photoCount: a.photoCount,
        views: a.viewsCount || 0,
      };
    });
  }

  public async getTopImages(
    period: "today" | "7d" | "30d" | "all" = "all",
    limit = 10,
  ): Promise<TopImageItem[]> {
    if (isPostgresConfigured()) {
      const top = await getPostgresTopImages(period, limit);
      if (top && top.length > 0) return top;
    }

    const images = this.data.images.filter((i) => i.status !== "trashed");
    const albums = this.data.albums || [];
    const festivals = this.data.festivals || [];

    const sorted = [...images].sort((a, b) => (b.viewsCount || 0) - (a.viewsCount || 0));
    return sorted.slice(0, limit).map((img, idx) => {
      const album = albums.find((a) => a.id === img.albumId);
      const fest = album ? festivals.find((f) => f.id === album.festivalId) : undefined;
      return {
        rank: idx + 1,
        imageId: img.id,
        title: img.title,
        url: img.url,
        thumbnailUrl: img.thumbnailUrl,
        albumId: img.albumId,
        albumTitle: album?.title || "Album",
        year: album?.year,
        festivalName: fest?.name,
        views: img.viewsCount || 0,
      };
    });
  }

  public async getLikeStatus(
    resourceType: "album" | "image",
    resourceId: string,
    visitorId?: string,
    userId?: string,
  ): Promise<{ liked: boolean; count: number }> {
    if (isPostgresConfigured()) {
      return await getPostgresLikeStatus(resourceType, resourceId, visitorId, userId);
    }

    const likes = this.data.likes || [];
    const matching = likes.filter(
      (l) => l.resourceType === resourceType && l.resourceId === resourceId,
    );
    const count = matching.length;
    let liked = false;
    if (visitorId || userId) {
      liked = matching.some(
        (l) => (visitorId && l.visitorId === visitorId) || (userId && l.userId === userId),
      );
    }
    return { liked, count };
  }

  public async recordLike(
    resourceType: "album" | "image",
    resourceId: string,
    visitorId: string,
    userId?: string,
  ): Promise<{ liked: boolean; count: number; alreadyLiked: boolean }> {
    if (isPostgresConfigured()) {
      return await recordPostgresLike(resourceType, resourceId, visitorId, userId);
    }

    if (!this.data.likes) this.data.likes = [];
    const exists = this.data.likes.some(
      (l) =>
        l.resourceType === resourceType &&
        l.resourceId === resourceId &&
        (l.visitorId === visitorId || (userId && l.userId === userId)),
    );

    if (exists) {
      const current = await this.getLikeStatus(resourceType, resourceId, visitorId, userId);
      return { liked: true, count: current.count, alreadyLiked: true };
    }

    this.data.likes.push({
      id: Date.now() + Math.floor(Math.random() * 1000),
      resourceType,
      resourceId,
      visitorId,
      userId,
      createdAt: new Date().toISOString(),
    });

    if (resourceType === "album") {
      const alb = this.data.albums.find((a) => a.id === resourceId);
      if (alb) alb.likesCount = (alb.likesCount || 0) + 1;
    } else if (resourceType === "image") {
      const img = this.data.images.find((i) => i.id === resourceId);
      if (img) img.likesCount = (img.likesCount || 0) + 1;
    }

    this.save();
    const updated = await this.getLikeStatus(resourceType, resourceId, visitorId, userId);
    return { liked: true, count: updated.count, alreadyLiked: false };
  }

  public async removeLike(
    resourceType: "album" | "image",
    resourceId: string,
    visitorId: string,
    userId?: string,
  ): Promise<{ liked: boolean; count: number }> {
    if (isPostgresConfigured()) {
      return await removePostgresLike(resourceType, resourceId, visitorId, userId);
    }

    if (!this.data.likes) this.data.likes = [];
    const prevLen = this.data.likes.length;
    this.data.likes = this.data.likes.filter(
      (l) =>
        !(
          l.resourceType === resourceType &&
          l.resourceId === resourceId &&
          (l.visitorId === visitorId || (userId && l.userId === userId))
        ),
    );

    if (this.data.likes.length < prevLen) {
      if (resourceType === "album") {
        const alb = this.data.albums.find((a) => a.id === resourceId);
        if (alb) alb.likesCount = Math.max(0, (alb.likesCount || 0) - 1);
      } else if (resourceType === "image") {
        const img = this.data.images.find((i) => i.id === resourceId);
        if (img) img.likesCount = Math.max(0, (img.likesCount || 0) - 1);
      }
      this.save();
    }

    const updated = await this.getLikeStatus(resourceType, resourceId, visitorId, userId);
    return { liked: false, count: updated.count };
  }

  public async getLikeCount(resourceType: "album" | "image", resourceId: string): Promise<number> {
    const status = await this.getLikeStatus(resourceType, resourceId);
    return status.count;
  }

  public async getFavoriteStatus(
    resourceType: "album" | "image",
    resourceId: string,
    visitorId?: string,
    userId?: string,
  ): Promise<boolean> {
    if (isPostgresConfigured()) {
      return await getPostgresFavoriteStatus(resourceType, resourceId, visitorId, userId);
    }

    if (!visitorId && !userId) return false;
    const favorites = this.data.favorites || [];
    return favorites.some(
      (f) =>
        (f.resourceType === resourceType && f.resourceId === resourceId) ||
        (resourceType === "image" &&
          f.imageId === resourceId &&
          ((visitorId && f.visitorId === visitorId) || (userId && f.userId === userId))),
    );
  }

  public async recordFavorite(
    resourceType: "album" | "image",
    resourceId: string,
    visitorId: string,
    userId?: string,
  ): Promise<{ favorited: boolean; alreadyFavorited: boolean }> {
    if (isPostgresConfigured()) {
      return await recordPostgresFavorite(resourceType, resourceId, visitorId, userId);
    }

    if (!this.data.favorites) this.data.favorites = [];
    const exists = this.data.favorites.some(
      (f) =>
        ((f.resourceType === resourceType && f.resourceId === resourceId) ||
          (resourceType === "image" && f.imageId === resourceId)) &&
        (f.visitorId === visitorId || (userId && f.userId === userId)),
    );

    if (exists) {
      return { favorited: true, alreadyFavorited: true };
    }

    this.data.favorites.push({
      id: Date.now() + Math.floor(Math.random() * 1000),
      resourceType,
      resourceId,
      imageId: resourceType === "image" ? resourceId : undefined,
      visitorId,
      userId,
      createdAt: new Date().toISOString(),
    });
    this.save();
    return { favorited: true, alreadyFavorited: false };
  }

  public async removeFavorite(
    resourceType: "album" | "image",
    resourceId: string,
    visitorId: string,
    userId?: string,
  ): Promise<{ favorited: boolean }> {
    if (isPostgresConfigured()) {
      return await removePostgresFavorite(resourceType, resourceId, visitorId, userId);
    }

    if (!this.data.favorites) this.data.favorites = [];
    this.data.favorites = this.data.favorites.filter(
      (f) =>
        !(
          ((f.resourceType === resourceType && f.resourceId === resourceId) ||
            (resourceType === "image" && f.imageId === resourceId)) &&
          (f.visitorId === visitorId || (userId && f.userId === userId))
        ),
    );
    this.save();
    return { favorited: false };
  }

  public async getUserFavorites(
    visitorId?: string,
    userId?: string,
    resourceType: "album" | "image" | "all" = "all",
  ): Promise<{ albums: FavoritedAlbumItem[]; images: FavoritedImageItem[] }> {
    if (isPostgresConfigured()) {
      const res = await getPostgresUserFavorites(visitorId, userId, resourceType);
      if (res.albums.length > 0 || res.images.length > 0) return res;
    }

    if (!visitorId && !userId) return { albums: [], images: [] };

    const favs = (this.data.favorites || []).filter(
      (f) => (visitorId && f.visitorId === visitorId) || (userId && f.userId === userId),
    );

    const albums: FavoritedAlbumItem[] = [];
    const images: FavoritedImageItem[] = [];

    const allAlbums = this.data.albums || [];
    const allFestivals = this.data.festivals || [];
    const allImages = this.data.images || [];

    for (const f of favs) {
      if (
        (f.resourceType === "album" || (!f.imageId && f.resourceId)) &&
        (resourceType === "all" || resourceType === "album")
      ) {
        const alb = allAlbums.find((a) => a.id === (f.resourceId || f.imageId));
        if (alb && alb.status !== "trashed") {
          const fest = allFestivals.find((ft) => ft.id === alb.festivalId);
          albums.push({
            id: alb.id,
            festivalId: alb.festivalId,
            festivalName: fest?.name || "ពិធីបុណ្យ",
            festivalEmoji: fest?.emoji || "🏮",
            festivalAccent: fest?.accent || "#d4af37",
            year: alb.year,
            location: alb.location,
            title: alb.title,
            description: alb.description,
            photoCount: alb.photoCount,
            coverImage: alb.coverImage,
            favoritedAt: f.createdAt,
          });
        }
      } else if (
        (f.resourceType === "image" || f.imageId) &&
        (resourceType === "all" || resourceType === "image")
      ) {
        const img = allImages.find((i) => i.id === (f.resourceId || f.imageId));
        if (img && img.status !== "trashed") {
          const alb = allAlbums.find((a) => a.id === img.albumId);
          const fest = alb ? allFestivals.find((ft) => ft.id === alb.festivalId) : undefined;
          images.push({
            id: img.id,
            albumId: img.albumId,
            albumTitle: alb?.title || "Album",
            year: alb?.year,
            festivalName: fest?.name,
            title: img.title,
            url: img.url,
            thumbnailUrl: img.thumbnailUrl || img.url,
            favoritedAt: f.createdAt,
          });
        }
      }
    }

    return { albums, images };
  }

  public async getInteractionsAnalytics(
    period: "today" | "7d" | "30d" | "all" = "all",
  ): Promise<InteractionsAnalyticsData> {
    if (isPostgresConfigured()) {
      return await getPostgresInteractionsAnalytics(period);
    }

    const likes = this.data.likes || [];
    const favorites = this.data.favorites || [];
    const { startDate: todayStart } = getPhnomPenhDateBounds("today");
    const { startDate: weekStart } = getPhnomPenhDateBounds("7d");
    const { startDate: monthStart } = getPhnomPenhDateBounds("30d");

    const todayIso = todayStart.toISOString();
    const weekIso = weekStart.toISOString();
    const monthIso = monthStart.toISOString();

    const likesToday = likes.filter((l) => l.createdAt >= todayIso).length;
    const likesThisWeek = likes.filter((l) => l.createdAt >= weekIso).length;
    const likesThisMonth = likes.filter((l) => l.createdAt >= monthIso).length;

    const favsToday = favorites.filter((f) => f.createdAt >= todayIso).length;
    const favsThisWeek = favorites.filter((f) => f.createdAt >= weekIso).length;
    const favsThisMonth = favorites.filter((f) => f.createdAt >= monthIso).length;

    return {
      likes: {
        total: likes.length,
        today: likesToday,
        thisWeek: likesThisWeek,
        thisMonth: likesThisMonth,
      },
      favorites: {
        total: favorites.length,
        today: favsToday,
        thisWeek: favsThisWeek,
        thisMonth: favsThisMonth,
      },
      topLikedAlbums: [],
      topLikedImages: [],
      topFavoritedAlbums: [],
      topFavoritedImages: [],
    };
  }

  public async recordSearch(params: {
    query: string;
    resultsCount: number;
    visitorId?: string | undefined;
    userId?: string | undefined;
    selectedResultId?: string | undefined;
    selectedResultType?: string | undefined;
  }) {
    return await recordPostgresSearchLog(params);
  }

  public async recordSearchClick(params: {
    logId?: number | undefined;
    query?: string | undefined;
    visitorId?: string | undefined;
    userId?: string | undefined;
    selectedResultId: string;
    selectedResultType: "album" | "image" | "festival";
  }) {
    return await recordPostgresSearchClick(params);
  }

  public async getSearchAnalytics(
    period: "today" | "7d" | "30d" | "all" = "7d",
  ): Promise<SearchAnalyticsData> {
    return await getPostgresSearchAnalytics(period);
  }

  public async getPopularityIntelligence(
    period: "today" | "7d" | "30d" | "all" = "all",
  ): Promise<PopularityIntelligenceData> {
    return await getPostgresPopularityIntelligence(period);
  }

  public async getTrendingSearchSuggestions(limit: number = 8) {
    return await getPostgresTrendingSearchSuggestions(limit);
  }

  public async getReportsSummary(
    period: ReportPeriod | string = "7d",
    customStartDate?: string | null,
    customEndDate?: string | null,
  ): Promise<ReportsSummaryData> {
    return await getPostgresReportsSummary(period, customStartDate, customEndDate);
  }

  public async getContentPerformance(
    period: ReportPeriod | string = "all",
    customStartDate?: string | null,
    customEndDate?: string | null,
    filterFestivalId?: string | null,
    filterYear?: number | null,
  ): Promise<ContentPerformanceReportData> {
    return await getPostgresContentPerformance(
      period,
      customStartDate,
      customEndDate,
      filterFestivalId,
      filterYear,
    );
  }

  public async getArchiveGrowth(
    groupBy: "month" | "year" = "month",
  ): Promise<ArchiveGrowthReportData> {
    return await getPostgresArchiveGrowth(groupBy);
  }

  public async getAdminActivitySummary(
    period: ReportPeriod | string = "30d",
    customStartDate?: string | null,
    customEndDate?: string | null,
  ): Promise<AdminActivitySummaryData> {
    return await getPostgresAdminActivitySummary(period, customStartDate, customEndDate);
  }

  public async exportReport(
    format: "csv" | "json",
    reportType:
      | "all"
      | "summary"
      | "content-performance"
      | "top-albums"
      | "top-images"
      | "search-queries"
      | "growth"
      | "activity",
    period: ReportPeriod | string = "7d",
    customStartDate?: string | null,
    customEndDate?: string | null,
  ) {
    return await generatePostgresExportReport(
      format,
      reportType,
      period,
      customStartDate,
      customEndDate,
    );
  }

  public async runMigration() {
    return await migrateJsonToPostgres();
  }
}

export const db = new Database();
