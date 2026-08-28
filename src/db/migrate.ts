import fs from "node:fs";
import path from "node:path";
import { getPgPool, getDrizzleDb, isPostgresConfigured } from "./index.ts";
import * as schema from "./schema.ts";
import { eq, sql } from "drizzle-orm";

interface JsonDatabaseContent {
  users?: Array<{
    id: string;
    email: string;
    name: string;
    role: string;
    permissions: string[];
    status: string;
    createdAt: string;
    passwordHash: string;
    lastLoginAt?: string;
  }>;
  sessions?: Array<{
    token: string;
    userId: string;
    expiresAt: number;
    createdAt: string;
    userAgent?: string;
    ip?: string;
  }>;
  festivals?: Array<{
    id: string;
    name: string;
    emoji: string;
    accent: string;
    month: string;
    description?: string;
    coverUrl?: string;
    isCustom?: boolean;
  }>;
  years?: number[];
  albums?: Array<{
    id: string;
    festivalId: string;
    year: number;
    location?: string;
    title: string;
    description?: string;
    photoCount?: number;
    coverImage?: string;
    status?: string;
    viewsCount?: number;
    likesCount?: number;
    createdAt?: string;
  }>;
  images?: Array<{
    id: string;
    albumId: string;
    title: string;
    description?: string;
    url: string;
    thumbnailUrl?: string;
    size?: number;
    mimeType?: string;
    photographer?: string;
    dateTaken?: string;
    copyright?: string;
    tags?: string;
    status?: string;
    viewsCount?: number;
    likesCount?: number;
    downloadsCount?: number;
    sharesCount?: number;
    uploadedBy?: string;
    createdAt?: string;
  }>;
  activityLogs?: Array<{
    id: string;
    userId: string;
    userName: string;
    userRole: string;
    action: string;
    resource: string;
    resourceId?: string;
    details?: string;
    ip?: string;
    timestamp: string;
  }>;
}

export interface MigrationSummary {
  success: boolean;
  postgresConfigured: boolean;
  jsonSourceFound: boolean;
  counts: {
    festivals: { json: number; postgres: number };
    years: { json: number; postgres: number };
    albums: { json: number; postgres: number };
    images: { json: number; postgres: number };
    users: { json: number; postgres: number };
    sessions: { json: number; postgres: number };
    activityLogs: { json: number; postgres: number };
  };
  errors: string[];
}

export const REQUIRED_TABLES = [
  "users",
  "sessions",
  "festivals",
  "years",
  "albums",
  "images",
  "likes",
  "favorites",
  "views_log",
  "downloads_log",
  "shares_log",
  "search_logs",
  "reports",
  "notifications",
  "activity_logs",
] as const;

export interface TableVerificationResult {
  ok: boolean;
  existing: string[];
  missing: string[];
}

/**
 * Verifies that all required tables exist in PostgreSQL public schema.
 */
export async function verifyRequiredTablesExist(): Promise<TableVerificationResult> {
  const pool = getPgPool();
  if (!pool) {
    return { ok: false, existing: [], missing: [...REQUIRED_TABLES] };
  }

  const client = await pool.connect();
  try {
    const res = await client.query<{ table_name: string }>(
      `SELECT table_name 
       FROM information_schema.tables 
       WHERE table_schema = 'public' 
         AND table_type = 'BASE TABLE'`,
    );

    const existing = res.rows.map((r) => r.table_name.toLowerCase());
    const missing = REQUIRED_TABLES.filter((t) => !existing.includes(t.toLowerCase()));

    return {
      ok: missing.length === 0,
      existing,
      missing,
    };
  } catch (error) {
    console.error("[Table Verification Error]:", error);
    return { ok: false, existing: [], missing: [...REQUIRED_TABLES] };
  } finally {
    client.release();
  }
}

/**
 * Initializes database tables using DDL and migration files to guarantee
 * all required tables and indexes exist in the PostgreSQL database.
 */
export async function initializeDatabaseSchema(): Promise<boolean> {
  const pool = getPgPool();
  if (!pool) {
    console.error("[Schema Init Failed]: PostgreSQL pool is not available.");
    return false;
  }

  const client = await pool.connect();
  try {
    // 1. Check if there are migration files in drizzle/
    const drizzleDir = path.join(process.cwd(), "drizzle");
    if (fs.existsSync(drizzleDir)) {
      const sqlFiles = fs
        .readdirSync(drizzleDir)
        .filter((f) => f.endsWith(".sql"))
        .sort();

      for (const file of sqlFiles) {
        const filePath = path.join(drizzleDir, file);
        const sqlContent = fs.readFileSync(filePath, "utf-8");
        const statements = sqlContent
          .split("--> statement-breakpoint")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        for (const stmt of statements) {
          try {
            await client.query(stmt);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            // Safely skip already exists / duplicate errors
            if (
              !msg.includes("already exists") &&
              !msg.includes("duplicate") &&
              !msg.includes("multiple primary keys")
            ) {
              // Log warning but continue so other statements can run
              console.warn(`[Migration File Note (${file})]:`, msg);
            }
          }
        }
      }
    }

    // 2. Safe Fallback DDL: Guarantee all 16 tables exist with CREATE TABLE IF NOT EXISTS
    const fallbackDdl = [
      // years
      `CREATE TABLE IF NOT EXISTS "years" (
        "year" integer PRIMARY KEY NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      );`,

      // festivals
      `CREATE TABLE IF NOT EXISTS "festivals" (
        "id" text PRIMARY KEY NOT NULL,
        "name" text NOT NULL,
        "emoji" text NOT NULL,
        "accent" text NOT NULL,
        "month" text NOT NULL,
        "description" text,
        "cover_url" text,
        "status" text DEFAULT 'published' NOT NULL,
        "is_custom" boolean DEFAULT false NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );`,

      // users
      `CREATE TABLE IF NOT EXISTS "users" (
        "id" text PRIMARY KEY NOT NULL,
        "email" text UNIQUE NOT NULL,
        "name" text NOT NULL,
        "role" text NOT NULL,
        "permissions" text NOT NULL,
        "status" text DEFAULT 'active' NOT NULL,
        "password_hash" text NOT NULL,
        "last_login_at" timestamp with time zone,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );`,

      // sessions
      `CREATE TABLE IF NOT EXISTS "sessions" (
        "token" text PRIMARY KEY NOT NULL,
        "user_id" text NOT NULL,
        "user_agent" text,
        "ip" text,
        "expires_at" timestamp with time zone NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      );`,

      // albums
      `CREATE TABLE IF NOT EXISTS "albums" (
        "id" text PRIMARY KEY NOT NULL,
        "festival_id" text NOT NULL,
        "year" integer NOT NULL,
        "title" text NOT NULL,
        "description" text,
        "location" text DEFAULT 'វត្តពារាំង' NOT NULL,
        "cover_image" text,
        "photo_count" integer DEFAULT 0 NOT NULL,
        "status" text DEFAULT 'published' NOT NULL,
        "views_count" integer DEFAULT 0 NOT NULL,
        "likes_count" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );`,

      // images
      `CREATE TABLE IF NOT EXISTS "images" (
        "id" text PRIMARY KEY NOT NULL,
        "album_id" text NOT NULL,
        "title" text NOT NULL,
        "description" text,
        "url" text NOT NULL,
        "thumbnail_url" text,
        "size" integer DEFAULT 0 NOT NULL,
        "mime_type" text DEFAULT 'image/jpeg' NOT NULL,
        "photographer" text,
        "date_taken" text,
        "copyright" text,
        "tags" text,
        "status" text DEFAULT 'published' NOT NULL,
        "views_count" integer DEFAULT 0 NOT NULL,
        "likes_count" integer DEFAULT 0 NOT NULL,
        "downloads_count" integer DEFAULT 0 NOT NULL,
        "shares_count" integer DEFAULT 0 NOT NULL,
        "uploaded_by" text,
        "deleted_at" timestamp with time zone,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );`,

      // likes
      `CREATE TABLE IF NOT EXISTS "likes" (
        "id" serial PRIMARY KEY NOT NULL,
        "resource_type" text NOT NULL,
        "resource_id" text NOT NULL,
        "visitor_id" text NOT NULL,
        "user_id" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      );`,

      // favorites
      `CREATE TABLE IF NOT EXISTS "favorites" (
        "id" serial PRIMARY KEY NOT NULL,
        "resource_type" text DEFAULT 'image' NOT NULL,
        "resource_id" text,
        "image_id" text,
        "visitor_id" text NOT NULL,
        "user_id" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      );`,

      // Additive columns for favorites
      `ALTER TABLE "favorites" ADD COLUMN IF NOT EXISTS "resource_type" text DEFAULT 'image' NOT NULL;`,
      `ALTER TABLE "favorites" ADD COLUMN IF NOT EXISTS "resource_id" text;`,
      `ALTER TABLE "favorites" ALTER COLUMN "image_id" DROP NOT NULL;`,
      `UPDATE "favorites" SET "resource_id" = "image_id" WHERE "resource_id" IS NULL AND "image_id" IS NOT NULL;`,

      // visitor_sessions
      `CREATE TABLE IF NOT EXISTS "visitor_sessions" (
        "id" text PRIMARY KEY NOT NULL,
        "ip_hash" text,
        "user_agent" text,
        "user_id" text,
        "device" text,
        "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );`,

      // Additive columns for existing tables
      `ALTER TABLE "visitor_sessions" ADD COLUMN IF NOT EXISTS "user_id" text;`,
      `ALTER TABLE "visitor_sessions" ADD COLUMN IF NOT EXISTS "device" text;`,
      `ALTER TABLE "visitor_sessions" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;`,

      // views_log
      `CREATE TABLE IF NOT EXISTS "views_log" (
        "id" serial PRIMARY KEY NOT NULL,
        "resource_type" text NOT NULL,
        "resource_id" text NOT NULL,
        "visitor_id" text NOT NULL,
        "user_id" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      );`,

      // Additive columns for views_log
      `ALTER TABLE "views_log" ADD COLUMN IF NOT EXISTS "user_id" text;`,

      // downloads_log
      `CREATE TABLE IF NOT EXISTS "downloads_log" (
        "id" serial PRIMARY KEY NOT NULL,
        "image_id" text NOT NULL,
        "visitor_id" text NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      );`,

      // shares_log
      `CREATE TABLE IF NOT EXISTS "shares_log" (
        "id" serial PRIMARY KEY NOT NULL,
        "resource_type" text NOT NULL,
        "resource_id" text NOT NULL,
        "platform" text NOT NULL,
        "visitor_id" text NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      );`,

      // search_logs
      `CREATE TABLE IF NOT EXISTS "search_logs" (
        "id" serial PRIMARY KEY NOT NULL,
        "query" text NOT NULL,
        "normalized_query" text,
        "results_count" integer DEFAULT 0 NOT NULL,
        "visitor_id" text,
        "user_id" text,
        "selected_result_id" text,
        "selected_result_type" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      );`,

      // Additive columns for search_logs
      `ALTER TABLE "search_logs" ADD COLUMN IF NOT EXISTS "normalized_query" text;`,
      `ALTER TABLE "search_logs" ADD COLUMN IF NOT EXISTS "user_id" text;`,
      `ALTER TABLE "search_logs" ADD COLUMN IF NOT EXISTS "selected_result_id" text;`,
      `ALTER TABLE "search_logs" ADD COLUMN IF NOT EXISTS "selected_result_type" text;`,
      `ALTER TABLE "search_logs" ALTER COLUMN "results_count" SET DEFAULT 0;`,
      `CREATE INDEX IF NOT EXISTS "idx_search_logs_created_at" ON "search_logs" ("created_at");`,
      `CREATE INDEX IF NOT EXISTS "idx_search_logs_normalized_query" ON "search_logs" ("normalized_query");`,
      `CREATE INDEX IF NOT EXISTS "idx_search_logs_visitor_id" ON "search_logs" ("visitor_id");`,
      `CREATE INDEX IF NOT EXISTS "idx_search_logs_results_count" ON "search_logs" ("results_count");`,
      `CREATE INDEX IF NOT EXISTS "idx_search_logs_selected_result" ON "search_logs" ("selected_result_id");`,

      // reports
      `CREATE TABLE IF NOT EXISTS "reports" (
        "id" text PRIMARY KEY NOT NULL,
        "image_id" text NOT NULL,
        "reason" text NOT NULL,
        "details" text,
        "status" text DEFAULT 'pending' NOT NULL,
        "resolved_by" text,
        "resolution_notes" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );`,

      // notifications
      `CREATE TABLE IF NOT EXISTS "notifications" (
        "id" text PRIMARY KEY NOT NULL,
        "type" text NOT NULL,
        "title" text NOT NULL,
        "message" text NOT NULL,
        "link" text,
        "is_read" boolean DEFAULT false NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      );`,

      // activity_logs
      `CREATE TABLE IF NOT EXISTS "activity_logs" (
        "id" text PRIMARY KEY NOT NULL,
        "user_id" text NOT NULL,
        "user_name" text NOT NULL,
        "user_role" text NOT NULL,
        "action" text NOT NULL,
        "resource" text NOT NULL,
        "resource_id" text,
        "details" text,
        "ip" text,
        "timestamp" timestamp with time zone DEFAULT now() NOT NULL
      );`,

      // Foreign Keys (applied safely)
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'albums_festival_id_festivals_id_fk') THEN
          ALTER TABLE "albums" ADD CONSTRAINT "albums_festival_id_festivals_id_fk" FOREIGN KEY ("festival_id") REFERENCES "festivals"("id") ON DELETE cascade;
        END IF;
      END $$;`,

      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'albums_year_years_year_fk') THEN
          ALTER TABLE "albums" ADD CONSTRAINT "albums_year_years_year_fk" FOREIGN KEY ("year") REFERENCES "years"("year") ON DELETE cascade;
        END IF;
      END $$;`,

      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'images_album_id_albums_id_fk') THEN
          ALTER TABLE "images" ADD CONSTRAINT "images_album_id_albums_id_fk" FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE cascade;
        END IF;
      END $$;`,

      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'images_uploaded_by_users_id_fk') THEN
          ALTER TABLE "images" ADD CONSTRAINT "images_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE set null;
        END IF;
      END $$;`,

      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sessions_user_id_users_id_fk') THEN
          ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
        END IF;
      END $$;`,

      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'likes_user_id_users_id_fk') THEN
          ALTER TABLE "likes" ADD CONSTRAINT "likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null;
        END IF;
      END $$;`,

      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'favorites_image_id_images_id_fk') THEN
          ALTER TABLE "favorites" ADD CONSTRAINT "favorites_image_id_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "images"("id") ON DELETE cascade;
        END IF;
      END $$;`,

      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'favorites_user_id_users_id_fk') THEN
          ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null;
        END IF;
      END $$;`,

      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'downloads_log_image_id_images_id_fk') THEN
          ALTER TABLE "downloads_log" ADD CONSTRAINT "downloads_log_image_id_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "images"("id") ON DELETE cascade;
        END IF;
      END $$;`,

      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reports_image_id_images_id_fk') THEN
          ALTER TABLE "reports" ADD CONSTRAINT "reports_image_id_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "images"("id") ON DELETE cascade;
        END IF;
      END $$;`,

      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reports_resolved_by_users_id_fk') THEN
          ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE set null;
        END IF;
      END $$;`,

      // Indexes
      `CREATE INDEX IF NOT EXISTS "idx_festivals_status" ON "festivals" ("status");`,
      `CREATE INDEX IF NOT EXISTS "idx_albums_festival_id" ON "albums" ("festival_id");`,
      `CREATE INDEX IF NOT EXISTS "idx_albums_year" ON "albums" ("year");`,
      `CREATE INDEX IF NOT EXISTS "idx_albums_status" ON "albums" ("status");`,
      `CREATE INDEX IF NOT EXISTS "idx_images_album_id" ON "images" ("album_id");`,
      `CREATE INDEX IF NOT EXISTS "idx_images_status" ON "images" ("status");`,
      `CREATE INDEX IF NOT EXISTS "idx_images_created_at" ON "images" ("created_at");`,
      `CREATE INDEX IF NOT EXISTS "idx_images_deleted_at" ON "images" ("deleted_at");`,
      `CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users" ("email");`,
      `CREATE INDEX IF NOT EXISTS "idx_sessions_user_id" ON "sessions" ("user_id");`,
      `CREATE INDEX IF NOT EXISTS "idx_sessions_expires_at" ON "sessions" ("expires_at");`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "uniq_likes_resource_visitor" ON "likes" ("resource_type", "resource_id", "visitor_id");`,
      `CREATE INDEX IF NOT EXISTS "idx_likes_resource" ON "likes" ("resource_type", "resource_id");`,
      `CREATE INDEX IF NOT EXISTS "idx_likes_visitor" ON "likes" ("visitor_id");`,
      `CREATE INDEX IF NOT EXISTS "idx_likes_user" ON "likes" ("user_id");`,
      `CREATE INDEX IF NOT EXISTS "idx_likes_created_at" ON "likes" ("created_at");`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "uniq_favorites_resource_visitor" ON "favorites" ("resource_type", "resource_id", "visitor_id");`,
      `CREATE INDEX IF NOT EXISTS "idx_favorites_resource" ON "favorites" ("resource_type", "resource_id");`,
      `CREATE INDEX IF NOT EXISTS "idx_favorites_visitor" ON "favorites" ("visitor_id");`,
      `CREATE INDEX IF NOT EXISTS "idx_favorites_user" ON "favorites" ("user_id");`,
      `CREATE INDEX IF NOT EXISTS "idx_favorites_created_at" ON "favorites" ("created_at");`,
      `CREATE INDEX IF NOT EXISTS "idx_visitor_sessions_user_id" ON "visitor_sessions" ("user_id");`,
      `CREATE INDEX IF NOT EXISTS "idx_visitor_sessions_last_seen" ON "visitor_sessions" ("last_seen_at");`,
      `CREATE INDEX IF NOT EXISTS "idx_visitor_sessions_created_at" ON "visitor_sessions" ("created_at");`,
      `CREATE INDEX IF NOT EXISTS "idx_views_log_resource" ON "views_log" ("resource_type", "resource_id");`,
      `CREATE INDEX IF NOT EXISTS "idx_views_log_visitor" ON "views_log" ("visitor_id");`,
      `CREATE INDEX IF NOT EXISTS "idx_views_log_created_at" ON "views_log" ("created_at");`,
      `CREATE INDEX IF NOT EXISTS "idx_downloads_log_image_id" ON "downloads_log" ("image_id");`,
      `CREATE INDEX IF NOT EXISTS "idx_downloads_log_created_at" ON "downloads_log" ("created_at");`,
      `CREATE INDEX IF NOT EXISTS "idx_shares_log_resource" ON "shares_log" ("resource_type", "resource_id");`,
      `CREATE INDEX IF NOT EXISTS "idx_shares_log_created_at" ON "shares_log" ("created_at");`,
      `CREATE INDEX IF NOT EXISTS "idx_search_logs_created_at" ON "search_logs" ("created_at");`,
      `CREATE INDEX IF NOT EXISTS "idx_reports_status" ON "reports" ("status");`,
      `CREATE INDEX IF NOT EXISTS "idx_reports_created_at" ON "reports" ("created_at");`,
      `CREATE INDEX IF NOT EXISTS "idx_notifications_is_read" ON "notifications" ("is_read");`,
      `CREATE INDEX IF NOT EXISTS "idx_notifications_created_at" ON "notifications" ("created_at");`,
      `CREATE INDEX IF NOT EXISTS "idx_activity_logs_user_id" ON "activity_logs" ("user_id");`,
      `CREATE INDEX IF NOT EXISTS "idx_activity_logs_timestamp" ON "activity_logs" ("timestamp");`,
    ];

    for (const stmt of fallbackDdl) {
      try {
        await client.query(stmt);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        if (
          !errorMsg.includes("already exists") &&
          !errorMsg.includes("duplicate") &&
          !errorMsg.includes("multiple primary keys")
        ) {
          console.warn("[Schema Init Notice]:", errorMsg);
        }
      }
    }

    // 3. Explicit Verification Step
    const check = await verifyRequiredTablesExist();
    if (!check.ok) {
      console.error(
        `[Schema Init Incomplete]: Missing required tables in PostgreSQL: ${check.missing.join(", ")}`,
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error("[Schema Init Fatal Error]:", error);
    return false;
  } finally {
    client.release();
  }
}

/**
 * Migrates data from .data/archive_db.json into PostgreSQL tables idempotently.
 */
export async function migrateJsonToPostgres(): Promise<MigrationSummary> {
  const summary: MigrationSummary = {
    success: false,
    postgresConfigured: isPostgresConfigured(),
    jsonSourceFound: false,
    counts: {
      festivals: { json: 0, postgres: 0 },
      years: { json: 0, postgres: 0 },
      albums: { json: 0, postgres: 0 },
      images: { json: 0, postgres: 0 },
      users: { json: 0, postgres: 0 },
      sessions: { json: 0, postgres: 0 },
      activityLogs: { json: 0, postgres: 0 },
    },
    errors: [],
  };

  const jsonPath = path.join(process.cwd(), ".data", "archive_db.json");
  if (!fs.existsSync(jsonPath)) {
    summary.errors.push(`JSON file not found at ${jsonPath}`);
    return summary;
  }

  summary.jsonSourceFound = true;
  let jsonData: JsonDatabaseContent = {};

  try {
    const raw = fs.readFileSync(jsonPath, "utf-8");
    jsonData = JSON.parse(raw);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    summary.errors.push(`Failed to parse JSON file: ${msg}`);
    return summary;
  }

  // Update source counts
  summary.counts.festivals.json = jsonData.festivals?.length || 0;
  summary.counts.years.json = jsonData.years?.length || 0;
  summary.counts.albums.json = jsonData.albums?.length || 0;
  summary.counts.images.json = jsonData.images?.length || 0;
  summary.counts.users.json = jsonData.users?.length || 0;
  summary.counts.sessions.json = jsonData.sessions?.length || 0;
  summary.counts.activityLogs.json = jsonData.activityLogs?.length || 0;

  if (!summary.postgresConfigured) {
    summary.errors.push("DATABASE_URL / PostgreSQL is not currently configured in environment.");
    return summary;
  }

  const db = getDrizzleDb();
  if (!db) {
    summary.errors.push("Could not initialize Drizzle database connection.");
    return summary;
  }

  try {
    await initializeDatabaseSchema();

    // 1. Migrate Users
    if (jsonData.users && jsonData.users.length > 0) {
      for (const u of jsonData.users) {
        await db
          .insert(schema.users)
          .values({
            id: u.id,
            email: u.email.toLowerCase().trim(),
            name: u.name,
            role: u.role,
            permissions: JSON.stringify(u.permissions || []),
            status: u.status || "active",
            passwordHash: u.passwordHash,
            lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt) : null,
            createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: schema.users.id,
            set: {
              email: u.email.toLowerCase().trim(),
              name: u.name,
              role: u.role,
              permissions: JSON.stringify(u.permissions || []),
              status: u.status || "active",
              passwordHash: u.passwordHash,
              lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt) : null,
              updatedAt: new Date(),
            },
          });
      }
    }

    // 2. Migrate Years
    if (jsonData.years && jsonData.years.length > 0) {
      for (const y of jsonData.years) {
        await db
          .insert(schema.years)
          .values({
            year: y,
            createdAt: new Date(),
          })
          .onConflictDoNothing();
      }
    }

    // 3. Migrate Festivals
    if (jsonData.festivals && jsonData.festivals.length > 0) {
      for (const f of jsonData.festivals) {
        await db
          .insert(schema.festivals)
          .values({
            id: f.id,
            name: f.name,
            emoji: f.emoji,
            accent: f.accent,
            month: f.month,
            description: f.description || null,
            coverUrl: f.coverUrl || null,
            isCustom: f.isCustom ?? false,
            status: "published",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: schema.festivals.id,
            set: {
              name: f.name,
              emoji: f.emoji,
              accent: f.accent,
              month: f.month,
              description: f.description || null,
              coverUrl: f.coverUrl || null,
              isCustom: f.isCustom ?? false,
              updatedAt: new Date(),
            },
          });
      }
    }

    // 4. Migrate Albums
    if (jsonData.albums && jsonData.albums.length > 0) {
      for (const a of jsonData.albums) {
        await db
          .insert(schema.albums)
          .values({
            id: a.id,
            festivalId: a.festivalId,
            year: a.year,
            title: a.title,
            description: a.description || null,
            location: a.location || "វត្តពារាំង",
            coverImage: a.coverImage || null,
            photoCount: a.photoCount || 0,
            status: a.status || "published",
            viewsCount: a.viewsCount || 0,
            likesCount: a.likesCount || 0,
            createdAt: a.createdAt ? new Date(a.createdAt) : new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: schema.albums.id,
            set: {
              festivalId: a.festivalId,
              year: a.year,
              title: a.title,
              description: a.description || null,
              location: a.location || "វត្តពារាំង",
              coverImage: a.coverImage || null,
              photoCount: a.photoCount || 0,
              status: a.status || "published",
              updatedAt: new Date(),
            },
          });
      }
    }

    // 5. Migrate Images
    if (jsonData.images && jsonData.images.length > 0) {
      for (const img of jsonData.images) {
        await db
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
            photographer: img.photographer || null,
            dateTaken: img.dateTaken || null,
            copyright: img.copyright || null,
            tags: img.tags || null,
            status: img.status || "published",
            viewsCount: img.viewsCount || 0,
            likesCount: img.likesCount || 0,
            downloadsCount: img.downloadsCount || 0,
            sharesCount: img.sharesCount || 0,
            uploadedBy: img.uploadedBy || null,
            createdAt: img.createdAt ? new Date(img.createdAt) : new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoNothing();
      }
    }

    // 6. Migrate Sessions
    if (jsonData.sessions && jsonData.sessions.length > 0) {
      const now = Date.now();
      for (const s of jsonData.sessions) {
        if (s.expiresAt > now) {
          await db
            .insert(schema.sessions)
            .values({
              token: s.token,
              userId: s.userId,
              userAgent: s.userAgent || null,
              ip: s.ip || null,
              expiresAt: new Date(s.expiresAt),
              createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
            })
            .onConflictDoNothing();
        }
      }
    }

    // 7. Migrate Activity Logs
    if (jsonData.activityLogs && jsonData.activityLogs.length > 0) {
      for (const log of jsonData.activityLogs) {
        await db
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
            timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
          })
          .onConflictDoNothing();
      }
    }

    // Query destination counts from PostgreSQL
    const festivalsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.festivals);
    const yearsResult = await db.select({ count: sql<number>`count(*)` }).from(schema.years);
    const albumsResult = await db.select({ count: sql<number>`count(*)` }).from(schema.albums);
    const imagesResult = await db.select({ count: sql<number>`count(*)` }).from(schema.images);
    const usersResult = await db.select({ count: sql<number>`count(*)` }).from(schema.users);
    const sessionsResult = await db.select({ count: sql<number>`count(*)` }).from(schema.sessions);
    const logsResult = await db.select({ count: sql<number>`count(*)` }).from(schema.activityLogs);

    summary.counts.festivals.postgres = Number(festivalsResult[0]?.count || 0);
    summary.counts.years.postgres = Number(yearsResult[0]?.count || 0);
    summary.counts.albums.postgres = Number(albumsResult[0]?.count || 0);
    summary.counts.images.postgres = Number(imagesResult[0]?.count || 0);
    summary.counts.users.postgres = Number(usersResult[0]?.count || 0);
    summary.counts.sessions.postgres = Number(sessionsResult[0]?.count || 0);
    summary.counts.activityLogs.postgres = Number(logsResult[0]?.count || 0);

    summary.success = true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    summary.errors.push(`Migration error: ${msg}`);
    console.error("[PostgreSQL Migration Error]:", err);
  }

  return summary;
}
