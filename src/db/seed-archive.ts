import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getPgPool, getDrizzleDb, isPostgresConfigured } from "./index.ts";
import * as schema from "./schema.ts";
import { sql } from "drizzle-orm";
import { initializeDatabaseSchema } from "./migrate.ts";
import {
  STATIC_FESTIVALS as primaryFestivals,
  STATIC_PREDEFINED_EXTRA_FESTIVALS as PREDEFINED_EXTRA_FESTIVALS,
  STATIC_YEARS as staticYears,
  generateAlbumsForFestival,
  albumPhotos,
  type Festival,
  type Album,
} from "../data/static-archive.ts";

export interface SeedSummary {
  success: boolean;
  postgresConfigured: boolean;
  importedFromStatic: boolean;
  importedFromJsonBackup: boolean;
  counts: {
    festivals: number;
    years: number;
    albums: number;
    images: number;
    users: number;
    activityLogs: number;
  };
  errors: string[];
}

/**
 * Safely hashes a password using Node scrypt
 */
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

/**
 * Performs a completely safe, idempotent import/seed of all static archive data
 * (festivals, extra festivals, historical years, albums, images, and root Super Admin)
 * into the PostgreSQL database 'wat_peareang_archive'.
 */
export async function seedStaticArchiveToPostgres(): Promise<SeedSummary> {
  const summary: SeedSummary = {
    success: false,
    postgresConfigured: isPostgresConfigured(),
    importedFromStatic: false,
    importedFromJsonBackup: false,
    counts: {
      festivals: 0,
      years: 0,
      albums: 0,
      images: 0,
      users: 0,
      activityLogs: 0,
    },
    errors: [],
  };

  if (!summary.postgresConfigured) {
    summary.errors.push("DATABASE_URL is not configured in the environment or .env file.");
    return summary;
  }

  const db = getDrizzleDb();
  if (!db) {
    summary.errors.push("Could not connect to PostgreSQL via Drizzle ORM.");
    return summary;
  }

  try {
    // 1. Ensure all tables are present
    await initializeDatabaseSchema();

    // 2. Prepare Super Admin User (Idempotent upsert)
    const initialEmail = (process.env["ADMIN_INITIAL_EMAIL"] || "shalvannouyear2005@gmail.com")
      .toLowerCase()
      .trim();
    const initialPass = process.env["ADMIN_INITIAL_PASSWORD"] || "NenNou2026";
    const superAdminPasswordHash = hashPassword(initialPass);

    await db
      .insert(schema.users)
      .values({
        id: "super-admin-root",
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
          "review_content",
        ]),
        status: "active",
        passwordHash: superAdminPasswordHash,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.users.id,
        set: {
          email: initialEmail,
          name: "អគ្គអ្នកគ្រប់គ្រង (Super Admin)",
          role: "super_admin",
          status: "active",
          updatedAt: new Date(),
        },
      });

    // 3. Seed Years from static archive
    // years: [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2018]
    const distinctYears = Array.from(
      new Set([...staticYears, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027]),
    ).sort((a, b) => b - a);

    for (const yearVal of distinctYears) {
      await db
        .insert(schema.years)
        .values({
          year: yearVal,
          createdAt: new Date(),
        })
        .onConflictDoNothing();
    }

    // 4. Seed Festivals from static archive
    // Combines primary 8 festivals and predefined extra festivals
    const allFestivalDefs: Festival[] = [
      ...primaryFestivals,
      ...PREDEFINED_EXTRA_FESTIVALS.filter(
        (extra) => !primaryFestivals.some((p) => p.id === extra.id),
      ),
    ];

    for (const fest of allFestivalDefs) {
      await db
        .insert(schema.festivals)
        .values({
          id: fest.id,
          name: fest.name,
          emoji: fest.emoji,
          accent: fest.accent,
          month: fest.month,
          description: `បណ្ណសាររូបភាពប្រចាំ ${fest.name} វត្តពារាំង`,
          coverUrl: fest.cover || null,
          status: "published",
          isCustom: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.festivals.id,
          set: {
            name: fest.name,
            emoji: fest.emoji,
            accent: fest.accent,
            month: fest.month,
            coverUrl: fest.cover || null,
            updatedAt: new Date(),
          },
        });
    }

    // 5. Seed Albums generated deterministically from static definitions
    // Generate valid historical albums across the static years
    for (const fest of allFestivalDefs) {
      const festAlbums = generateAlbumsForFestival(fest, distinctYears);
      for (const alb of festAlbums) {
        await db
          .insert(schema.albums)
          .values({
            id: alb.id,
            festivalId: alb.festivalId,
            year: alb.year,
            title: alb.title,
            description: `កម្រងរូបភាពពិធីបុណ្យ ${alb.festival.name} ឆ្នាំ ${alb.year} នៅ${alb.location}`,
            location: alb.location,
            coverImage: alb.festival.cover || null,
            photoCount: alb.photoCount,
            status: "published",
            viewsCount: 0,
            likesCount: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: schema.albums.id,
            set: {
              festivalId: alb.festivalId,
              year: alb.year,
              title: alb.title,
              location: alb.location,
              coverImage: alb.festival.cover || null,
              photoCount: alb.photoCount,
              updatedAt: new Date(),
            },
          });

        // 6. Seed Sample Gallery Images for each album (batched per album)
        // Creates valid relational images linked to album and festival
        const photos = albumPhotos(alb);
        const imageRows = photos.map((photo) => ({
          id: photo.id,
          albumId: alb.id,
          title: photo.caption,
          description: `រូបថតប្រវត្តិសាស្ត្រក្នុងកម្រងរូបភាព ${alb.title} ឆ្នាំ ${alb.year}`,
          url: photo.src,
          thumbnailUrl: photo.src,
          size: 1024 * 512, // approx 512 KB
          mimeType: "image/jpeg",
          photographer: "គណៈកម្មការវត្តពារាំង",
          dateTaken: `${alb.year}`,
          copyright: "វត្តពារាំង (Wat Peareang)",
          tags: `${fest.name},${alb.year},វត្តពារាំង`,
          status: "published",
          viewsCount: 0,
          likesCount: 0,
          downloadsCount: 0,
          sharesCount: 0,
          uploadedBy: "super-admin-root",
          createdAt: new Date(),
          updatedAt: new Date(),
        }));

        if (imageRows.length > 0) {
          await db.insert(schema.images).values(imageRows).onConflictDoNothing();
        }
      }
    }

    // 7. Check if optional .data/archive_db.json exists and import any additional content idempotently
    const jsonPath = path.join(process.cwd(), ".data", "archive_db.json");
    if (fs.existsSync(jsonPath)) {
      try {
        const rawJson = fs.readFileSync(jsonPath, "utf-8");
        const parsed = JSON.parse(rawJson);
        summary.importedFromJsonBackup = true;

        // Merge any custom activity logs
        if (Array.isArray(parsed.activityLogs)) {
          for (const log of parsed.activityLogs) {
            await db
              .insert(schema.activityLogs)
              .values({
                id: log.id,
                userId: log.userId || "super-admin-root",
                userName: log.userName || "អគ្គអ្នកគ្រប់គ្រង",
                userRole: log.userRole || "super_admin",
                action: log.action || "system_init",
                resource: log.resource || "system",
                resourceId: log.resourceId || null,
                details: log.details || "Initial seed import",
                ip: log.ip || "127.0.0.1",
                timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
              })
              .onConflictDoNothing();
          }
        }
      } catch (jsonErr) {
        console.warn("[JSON Backup Check]: Optional JSON parse skipped", jsonErr);
      }
    }

    // Record initial system activity log if empty
    await db
      .insert(schema.activityLogs)
      .values({
        id: `log-seed-${Date.now()}`,
        userId: "super-admin-root",
        userName: "អគ្គអ្នកគ្រប់គ្រង (Super Admin)",
        userRole: "super_admin",
        action: "seed_static_archive",
        resource: "database",
        resourceId: "wat_peareang_archive",
        details: "បាននាំចូលទិន្នន័យបណ្ណសារបុណ្យ និងកម្រងរូបភាពចូលក្នុងប្រព័ន្ធទិន្នន័យ PostgreSQL",
        ip: "127.0.0.1",
        timestamp: new Date(),
      })
      .onConflictDoNothing();

    summary.importedFromStatic = true;

    // 8. Query Final Database Counts directly from PostgreSQL
    const festivalsRes = await db.select({ count: sql<number>`count(*)` }).from(schema.festivals);
    const yearsRes = await db.select({ count: sql<number>`count(*)` }).from(schema.years);
    const albumsRes = await db.select({ count: sql<number>`count(*)` }).from(schema.albums);
    const imagesRes = await db.select({ count: sql<number>`count(*)` }).from(schema.images);
    const usersRes = await db.select({ count: sql<number>`count(*)` }).from(schema.users);
    const logsRes = await db.select({ count: sql<number>`count(*)` }).from(schema.activityLogs);

    summary.counts.festivals = Number(festivalsRes[0]?.count || 0);
    summary.counts.years = Number(yearsRes[0]?.count || 0);
    summary.counts.albums = Number(albumsRes[0]?.count || 0);
    summary.counts.images = Number(imagesRes[0]?.count || 0);
    summary.counts.users = Number(usersRes[0]?.count || 0);
    summary.counts.activityLogs = Number(logsRes[0]?.count || 0);

    summary.success = true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    summary.errors.push(`Seeding error: ${msg}`);
    console.error("[PostgreSQL Static Archive Seed Error]:", err);
  }

  return summary;
}
