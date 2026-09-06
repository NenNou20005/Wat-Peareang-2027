/**
 * ============================================================================
 * WAT-PEAREANG DIGITAL ARCHIVE: PRODUCTION DATA SYNCHRONIZATION SCRIPT
 * ============================================================================
 * 
 * PURPOSE:
 * Safely synchronizes legitimate historical archive records from Local PostgreSQL
 * to Production PostgreSQL (Render Cloud DB).
 * 
 * ⚠️ WARNING: THIS IS A WRITE OPERATION SCRIPT.
 * ⚠️ DO NOT RUN WITHOUT EXPLICIT USER APPROVAL.
 * ⚠️ RUNS IN DRY-RUN MODE BY DEFAULT UNLESS --execute IS EXPLICITLY PASSED.
 * 
 * STRICT INTEGRITY & SAFETY RULES:
 * 1. Data Integrity Validation on Existing Records:
 *    - If ID does not exist in target DB -> INSERT with original metadata.
 *    - If ID exists and matches all key fields -> SKIP and report match.
 *    - If ID exists and ANY key field differs -> ABORT IMMEDIATELY & ROLLBACK.
 * 2. Protected Production Albums Integrity:
 *    - 'chrot-preah-nongkoal-2027' and 'chol-vossa-2027' are snapshotted before
 *      the transaction and deeply compared after insertion. Any change aborts.
 * 3. Exact Expected Target Counts Enforced:
 *    - Festivals = 17 (16 + 1 dar-lean)
 *    - Albums    = 159 (149 + 10)
 *    - Images    = 6,548 (6,155 + 393)
 *    - Years     = 10 (unchanged)
 * 4. Pre-Sync Recovery Snapshot:
 *    - Affected Production rows are exported to backups/ before execution.
 * 5. Exact Metadata & Timestamps Preserved:
 *    - Uses exact 'uploaded_by', 'createdAt', 'updatedAt' from source data.
 *    - No hard-coding 'super-admin-root', no guessing timestamps.
 * 6. Strict Whitelist & Blacklist Enforced:
 *    - Whitelist: 'dar-lean' (1 fest), 10 albums, 393 images.
 *    - Blacklist: 'custom-1788020113888', 'chaul-chnam-2020-mtlr2kj4', and
 *      18 test images (ChatGPT, Anime, English grammar, local disk paths).
 * 7. Zero R2 Mutations:
 *    - Validates bundled '/assets/fest-*.jpg' URLs.
 *    - No upload, delete, or modification of Cloudflare R2 objects.
 * ============================================================================
 */

import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { Pool, type PoolClient } from "pg";

// --- SANITIZE / REDACT SENSITIVE CONNECTION STRINGS IN LOGS ---
function redactConnectionString(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname;
    const port = parsed.port || "5432";
    const db = parsed.pathname.replace(/^\//, "");
    return `postgresql://[REDACTED_USER]:[REDACTED_PASSWORD]@${host}:${port}/${db}`;
  } catch {
    return "[REDACTED_CONNECTION_STRING]";
  }
}

// --- STRICT BLACKLIST OF TEST RECORD IDS ---
const BLACKLISTED_IDS = new Set<string>([
  "custom-1788020113888",
  "chaul-chnam-2020-mtlr2kj4",
  "img-1788020388043-2b57d580",
  "img-1788105168228-3435202a",
  "img-1788172923680-d1ca07d2",
  "img-1788172927668-45668e16",
  "img-1788176968566-26588c43",
  "img-1788179776260-36f83451",
  "img-1788180156228-553314a6",
  "img-1788180157093-5e258ec8",
  "img-1788180328618-8a19942a",
  "img-1788180327671-3b24c405",
  "img-1788180239496-29ce214b",
  "img-1788180237723-0babe10a",
  "img-1788172667426-d3a308e5",
  "img-1788180331038-bd5c4874",
  "img-1788180159423-bbbdc791",
  "img-1788194495455-af37ddfb",
  "img-1788577387798-4f449c70",
  "img-1788180333036-66f20f7a",
]);

// --- STRICT WHITELIST OF ALLOWED ALBUMS ---
const ALLOWED_ALBUM_IDS = new Set<string>([
  "dar-lean-2018",
  "dar-lean-2019",
  "dar-lean-2020",
  "dar-lean-2021",
  "dar-lean-2022",
  "dar-lean-2023",
  "dar-lean-2024",
  "dar-lean-2025",
  "dar-lean-2027",
  "kathin-2026",
]);

// --- PROTECTED PRODUCTION ALBUM IDS ---
const PROTECTED_ALBUM_IDS = ["chrot-preah-nongkoal-2027", "chol-vossa-2027"];

// --- SOURCE DATA INTERFACES (EXACT SOURCE METADATA) ---
export interface SourceFestival {
  id: string;
  name: string;
  emoji: string;
  accent: string;
  month: string;
  description: string;
  coverUrl: string;
  status: string;
  isCustom: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SourceAlbum {
  id: string;
  festivalId: string;
  year: number;
  eventId?: string | null;
  title: string;
  description: string;
  location: string;
  coverImage: string;
  photoCount: number;
  status: string;
  sortOrder?: number;
  viewsCount?: number;
  likesCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SourceImage {
  id: string;
  albumId: string;
  title: string;
  description: string;
  url: string;
  thumbnailUrl: string;
  size: number;
  mimeType: string;
  photographer: string;
  dateTaken: string;
  copyright: string;
  tags: string;
  status: string;
  viewsCount?: number;
  likesCount?: number;
  downloadsCount?: number;
  sharesCount?: number;
  uploadedBy: string;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SyncPayload {
  festival: SourceFestival;
  albums: SourceAlbum[];
  images: SourceImage[];
}

export interface FieldComparisonResult {
  matches: boolean;
  diffs: string[];
}

// --- COMPARISON HELPER: FESTIVAL ---
export function compareFestival(source: SourceFestival, existing: Record<string, unknown>): FieldComparisonResult {
  const diffs: string[] = [];
  if (source.id !== existing["id"]) diffs.push(`id (${source.id} vs ${existing["id"]})`);
  if (source.name !== existing["name"]) diffs.push(`name (${source.name} vs ${existing["name"]})`);
  if (source.emoji !== existing["emoji"]) diffs.push(`emoji (${source.emoji} vs ${existing["emoji"]})`);
  if (source.accent !== existing["accent"]) diffs.push(`accent (${source.accent} vs ${existing["accent"]})`);
  if (source.month !== existing["month"]) diffs.push(`month (${source.month} vs ${existing["month"]})`);
  if ((source.description || "") !== (existing["description"] || "")) {
    diffs.push(`description (${source.description} vs ${existing["description"]})`);
  }
  if ((source.coverUrl || "") !== (existing["cover_url"] || "")) {
    diffs.push(`cover_url (${source.coverUrl} vs ${existing["cover_url"]})`);
  }
  if (source.status !== existing["status"]) diffs.push(`status (${source.status} vs ${existing["status"]})`);
  if (Boolean(source.isCustom) !== Boolean(existing["is_custom"])) {
    diffs.push(`is_custom (${source.isCustom} vs ${existing["is_custom"]})`);
  }
  return { matches: diffs.length === 0, diffs };
}

// --- COMPARISON HELPER: ALBUM ---
export function compareAlbum(source: SourceAlbum, existing: Record<string, unknown>): FieldComparisonResult {
  const diffs: string[] = [];
  if (source.id !== existing["id"]) diffs.push(`id (${source.id} vs ${existing["id"]})`);
  if (source.festivalId !== existing["festival_id"]) diffs.push(`festival_id (${source.festivalId} vs ${existing["festival_id"]})`);
  if (Number(source.year) !== Number(existing["year"])) diffs.push(`year (${source.year} vs ${existing["year"]})`);
  if (source.title !== existing["title"]) diffs.push(`title (${source.title} vs ${existing["title"]})`);
  if ((source.description || "") !== (existing["description"] || "")) {
    diffs.push(`description (${source.description} vs ${existing["description"]})`);
  }
  if ((source.location || "") !== (existing["location"] || "")) {
    diffs.push(`location (${source.location} vs ${existing["location"]})`);
  }
  if ((source.coverImage || "") !== (existing["cover_image"] || "")) {
    diffs.push(`cover_image (${source.coverImage} vs ${existing["cover_image"]})`);
  }
  if (Number(source.photoCount) !== Number(existing["photo_count"])) {
    diffs.push(`photo_count (${source.photoCount} vs ${existing["photo_count"]})`);
  }
  if (source.status !== existing["status"]) diffs.push(`status (${source.status} vs ${existing["status"]})`);
  return { matches: diffs.length === 0, diffs };
}

// --- COMPARISON HELPER: IMAGE ---
export function compareImage(source: SourceImage, existing: Record<string, unknown>): FieldComparisonResult {
  const diffs: string[] = [];
  if (source.id !== existing["id"]) diffs.push(`id (${source.id} vs ${existing["id"]})`);
  if (source.albumId !== existing["album_id"]) diffs.push(`album_id (${source.albumId} vs ${existing["album_id"]})`);
  if (source.title !== existing["title"]) diffs.push(`title (${source.title} vs ${existing["title"]})`);
  if ((source.description || "") !== (existing["description"] || "")) {
    diffs.push(`description (${source.description} vs ${existing["description"]})`);
  }
  if (source.url !== existing["url"]) diffs.push(`url (${source.url} vs ${existing["url"]})`);
  if ((source.thumbnailUrl || "") !== (existing["thumbnail_url"] || "")) {
    diffs.push(`thumbnail_url (${source.thumbnailUrl} vs ${existing["thumbnail_url"]})`);
  }
  if (Number(source.size) !== Number(existing["size"])) diffs.push(`size (${source.size} vs ${existing["size"]})`);
  if (source.mimeType !== existing["mime_type"]) diffs.push(`mime_type (${source.mimeType} vs ${existing["mime_type"]})`);
  if ((source.photographer || "") !== (existing["photographer"] || "")) {
    diffs.push(`photographer (${source.photographer} vs ${existing["photographer"]})`);
  }
  if ((source.dateTaken || "") !== (existing["date_taken"] || "")) {
    diffs.push(`date_taken (${source.dateTaken} vs ${existing["date_taken"]})`);
  }
  if ((source.copyright || "") !== (existing["copyright"] || "")) {
    diffs.push(`copyright (${source.copyright} vs ${existing["copyright"]})`);
  }
  if ((source.tags || "") !== (existing["tags"] || "")) {
    diffs.push(`tags (${source.tags} vs ${existing["tags"]})`);
  }
  if (source.status !== existing["status"]) diffs.push(`status (${source.status} vs ${existing["status"]})`);
  if ((source.uploadedBy || "") !== (existing["uploaded_by"] || "")) {
    diffs.push(`uploaded_by (${source.uploadedBy} vs ${existing["uploaded_by"]})`);
  }
  return { matches: diffs.length === 0, diffs };
}

// --- DEEP COMPARISON HELPER FOR PROTECTED ALBUMS ---
export function compareProtectedAlbumRows(
  initial: Record<string, unknown>,
  current: Record<string, unknown>
): FieldComparisonResult {
  const fields = [
    "id",
    "festival_id",
    "year",
    "title",
    "description",
    "location",
    "cover_image",
    "photo_count",
    "status",
    "views_count",
    "likes_count",
  ];
  const diffs: string[] = [];
  for (const f of fields) {
    const v1 = initial[f] === null || initial[f] === undefined ? "" : String(initial[f]);
    const v2 = current[f] === null || current[f] === undefined ? "" : String(current[f]);
    if (v1 !== v2) {
      diffs.push(`${f} ('${v1}' !== '${v2}')`);
    }
  }
  return { matches: diffs.length === 0, diffs };
}

export async function main() {
  const isExecuteMode = process.argv.includes("--execute");
  const isDryRun = !isExecuteMode;

  console.log("\n=================================================================");
  console.log("   WAT PEAREANG ARCHIVE - PRODUCTION DATABASE SYNC PIPELINE     ");
  console.log("=================================================================");
  console.log(`MODE: ${isDryRun ? "🛡️ DRY-RUN (Simulation Only - Will ROLLBACK)" : "⚠️ LIVE EXECUTE (Will COMMIT on 100% Verification)"}`);

  // 1. Resolve Target Database URL
  const targetUrl =
    process.env["TARGET_DATABASE_URL"] ||
    process.env["PRODUCTION_DATABASE_URL"] ||
    process.env["DATABASE_URL"];

  if (!targetUrl) {
    console.error("\n❌ ERROR: TARGET_DATABASE_URL (or DATABASE_URL) is not set.");
    console.error("Provide the target connection string via environment variable or .env:");
    console.error("  TARGET_DATABASE_URL=postgresql://user:password@host:port/dbname\n");
    process.exit(1);
  }

  console.log(`\n🔌 Target DB Target: ${redactConnectionString(targetUrl)}`);

  // 2. Load and Strictly Validate Local Source Data
  console.log("\n📦 Loading and validating verified source sync data...");
  const patchPath = path.join(process.cwd(), "scratch", "sync_patch_data.json");
  if (!fs.existsSync(patchPath)) {
    console.error(`❌ ERROR: Source patch data file not found at ${patchPath}`);
    console.error("Ensure scratch/sync_patch_data.json exists before running sync.");
    process.exit(1);
  }

  const rawData = JSON.parse(fs.readFileSync(patchPath, "utf-8")) as SyncPayload;

  // A. Validate Festival
  if (!rawData.festival || rawData.festival.id !== "dar-lean") {
    console.error("❌ ERROR: Festival in source data must be strictly 'dar-lean'.");
    process.exit(1);
  }
  if (!rawData.festival.createdAt || !rawData.festival.updatedAt) {
    console.error("❌ ERROR: Source festival is missing original createdAt/updatedAt timestamps. Aborting.");
    process.exit(1);
  }

  // B. Validate Albums Whitelist & Integrity
  if (rawData.albums.length !== 10) {
    console.error(`❌ ERROR: Expected exactly 10 albums, found ${rawData.albums.length}. Aborting.`);
    process.exit(1);
  }

  for (const alb of rawData.albums) {
    if (!ALLOWED_ALBUM_IDS.has(alb.id)) {
      console.error(`❌ ERROR: Album ${alb.id} is not in allowed whitelist. Aborting.`);
      process.exit(1);
    }
    if (BLACKLISTED_IDS.has(alb.id)) {
      console.error(`❌ ERROR: Blacklisted album ${alb.id} found in payload. Aborting.`);
      process.exit(1);
    }
    if (!alb.createdAt || !alb.updatedAt) {
      console.error(`❌ ERROR: Album ${alb.id} is missing original createdAt/updatedAt timestamps. Aborting.`);
      process.exit(1);
    }
  }

  // C. Validate Images Whitelist, Integrity, and Static Asset Format
  if (rawData.images.length !== 393) {
    console.error(`❌ ERROR: Expected exactly 393 images, found ${rawData.images.length}. Aborting.`);
    process.exit(1);
  }

  for (const img of rawData.images) {
    if (BLACKLISTED_IDS.has(img.id)) {
      console.error(`❌ ERROR: Blacklisted test image ${img.id} found in payload. Aborting.`);
      process.exit(1);
    }
    if (!ALLOWED_ALBUM_IDS.has(img.albumId)) {
      console.error(`❌ ERROR: Image ${img.id} belongs to unauthorized album ${img.albumId}. Aborting.`);
      process.exit(1);
    }
    if (!img.url || img.url.trim().length === 0) {
      console.error(`❌ ERROR: Image ${img.id} has empty URL. Aborting.`);
      process.exit(1);
    }
    if (!img.thumbnailUrl || img.thumbnailUrl.trim().length === 0) {
      console.error(`❌ ERROR: Image ${img.id} has empty thumbnailUrl. Aborting.`);
      process.exit(1);
    }
    // Strict asset validation: must reference verified bundled static assets
    if (!img.url.startsWith("/assets/fest-") || !img.url.endsWith(".jpg")) {
      console.error(`❌ ERROR: Image ${img.id} URL '${img.url}' does not match expected static bundled asset pattern /assets/fest-*.jpg. Aborting.`);
      process.exit(1);
    }
    if (!img.thumbnailUrl.startsWith("/assets/fest-") || !img.thumbnailUrl.endsWith(".jpg")) {
      console.error(`❌ ERROR: Image ${img.id} thumbnailUrl '${img.thumbnailUrl}' does not match expected static bundled asset pattern /assets/fest-*.jpg. Aborting.`);
      process.exit(1);
    }
    if (!img.uploadedBy || img.uploadedBy.trim().length === 0) {
      console.error(`❌ ERROR: Image ${img.id} is missing source 'uploadedBy'. Aborting without guessing.`);
      process.exit(1);
    }
    if (!img.createdAt || !img.updatedAt) {
      console.error(`❌ ERROR: Image ${img.id} is missing source createdAt/updatedAt timestamps. Aborting.`);
      process.exit(1);
    }
  }

  console.log("   ✅ Source Data Pre-Validation Succeeded:");
  console.log(`      • Festival: '${rawData.festival.name}' (${rawData.festival.id}) [Timestamps & Metadata Verified]`);
  console.log(`      • Albums: ${rawData.albums.length} albums [All 10 whitelisted, Timestamps Verified]`);
  console.log(`      • Images: ${rawData.images.length} images [All 393 whitelisted, Asset URLs Verified, uploadedBy Verified]`);
  console.log("      • Blacklist check: 0 blacklisted items detected.");

  // 3. Connect to PostgreSQL Pool
  const pool = new Pool({
    connectionString: targetUrl,
    ssl: targetUrl.includes("localhost") || targetUrl.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  const client: PoolClient = await pool.connect();

  try {
    // 4. Preflight Database State Checks
    console.log("\n🔍 Running Preflight Database Checks on Target...");

    const [fCountRes, aCountRes, iCountRes, yCountRes] = await Promise.all([
      client.query<{ count: number }>("SELECT count(*)::int FROM festivals WHERE status != 'trashed';"),
      client.query<{ count: number }>("SELECT count(*)::int FROM albums WHERE status != 'trashed';"),
      client.query<{ count: number }>("SELECT count(*)::int FROM images WHERE status != 'trashed' AND deleted_at IS NULL;"),
      client.query<{ count: number }>("SELECT count(*)::int FROM years;"),
    ]);

    const beforeFestivals = Number(fCountRes.rows[0]?.count || 0);
    const beforeAlbums = Number(aCountRes.rows[0]?.count || 0);
    const beforeImages = Number(iCountRes.rows[0]?.count || 0);
    const beforeYears = Number(yCountRes.rows[0]?.count || 0);

    console.log("   📊 Current Target DB Record Counts:");
    console.log(`      • Festivals: ${beforeFestivals}`);
    console.log(`      • Albums:    ${beforeAlbums}`);
    console.log(`      • Images:    ${beforeImages}`);
    console.log(`      • Years:     ${beforeYears}`);

    // Preflight baseline validation
    if (beforeFestivals < 16 || beforeAlbums < 149 || beforeImages < 6155) {
      console.warn(`   ⚠️ WARNING: Target database has fewer records than expected Production baseline (16 fests, 149 albums, 6155 images).`);
    }

    // 5. Pre-Sync Snapshot of Affected & Protected Rows (Full Recovery Data)
    console.log("\n💾 Generating Pre-Sync Recovery Snapshot...");
    const backupDir = path.join(process.cwd(), "backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Query existing affected rows if any exist in target DB
    const existingDarLeanFest = await client.query("SELECT * FROM festivals WHERE id = 'dar-lean';");
    const existingTargetAlbums = await client.query(
      "SELECT * FROM albums WHERE id = ANY($1::text[]);",
      [Array.from(ALLOWED_ALBUM_IDS)]
    );
    const existingTargetImages = await client.query(
      "SELECT * FROM images WHERE id = ANY($1::text[]);",
      [rawData.images.map((i) => i.id)]
    );

    // Snapshot Protected Albums
    const protectedAlbumsSnapshot = await client.query(
      `SELECT id, festival_id, year, title, description, location, cover_image, photo_count, status, views_count, likes_count
       FROM albums
       WHERE id = ANY($1::text[])
       ORDER BY id;`,
      [PROTECTED_ALBUM_IDS]
    );

    if (protectedAlbumsSnapshot.rows.length !== PROTECTED_ALBUM_IDS.length) {
      throw new Error(
        `CRITICAL PREFLIGHT FAILURE: Expected ${PROTECTED_ALBUM_IDS.length} protected albums on target, found ${protectedAlbumsSnapshot.rows.length}. Aborting.`
      );
    }

    const snapshotData = {
      timestamp: new Date().toISOString(),
      target: redactConnectionString(targetUrl),
      baselineCounts: { beforeFestivals, beforeAlbums, beforeImages, beforeYears },
      protectedAlbums: protectedAlbumsSnapshot.rows,
      existingAffectedFestivals: existingDarLeanFest.rows,
      existingAffectedAlbums: existingTargetAlbums.rows,
      existingAffectedImagesCount: existingTargetImages.rows.length,
    };

    const snapshotFile = path.join(
      backupDir,
      `pre_sync_affected_rows_${new Date().toISOString().replace(/[:.]/g, "-")}.json`
    );
    fs.writeFileSync(snapshotFile, JSON.stringify(snapshotData, null, 2));
    console.log(`   ✅ Pre-sync recovery snapshot saved to ${snapshotFile}`);

    // Map initial protected album rows for post-transaction deep comparison
    const initialProtectedMap = new Map<string, Record<string, unknown>>();
    for (const row of protectedAlbumsSnapshot.rows) {
      initialProtectedMap.set(row.id as string, row);
    }

    // 6. Begin Safe Atomic Database Transaction
    console.log("\n🔒 Starting Database Transaction (BEGIN)...");
    await client.query("BEGIN;");

    // --- STEP 1: FESTIVAL 'dar-lean' VALIDATION & INSERT ---
    console.log("\n🌾 Step 1: Processing Festival 'dar-lean'...");
    const existingFestRes = await client.query("SELECT * FROM festivals WHERE id = $1;", [rawData.festival.id]);
    let festInserted = false;

    if (existingFestRes.rows.length > 0) {
      const existingRow = existingFestRes.rows[0];
      const comparison = compareFestival(rawData.festival, existingRow);
      if (comparison.matches) {
        console.log(`   ℹ️ Festival 'dar-lean' already exists in target DB and matches all fields. (SKIPPED)`);
      } else {
        throw new Error(
          `CRITICAL INTEGRITY CONFLICT: Festival 'dar-lean' already exists in target DB but data differs! Differing fields: ${comparison.diffs.join(", ")}`
        );
      }
    } else {
      await client.query(
        `INSERT INTO festivals (id, name, emoji, accent, month, description, cover_url, status, is_custom, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);`,
        [
          rawData.festival.id,
          rawData.festival.name,
          rawData.festival.emoji,
          rawData.festival.accent,
          rawData.festival.month,
          rawData.festival.description,
          rawData.festival.coverUrl,
          rawData.festival.status,
          rawData.festival.isCustom,
          new Date(rawData.festival.createdAt),
          new Date(rawData.festival.updatedAt),
        ]
      );
      festInserted = true;
      console.log(`   ✅ Inserted Festival 'dar-lean' with original metadata and timestamps.`);
    }

    // --- STEP 2: ALBUMS VALIDATION & INSERT ---
    console.log("\n📁 Step 2: Processing 10 Whitelisted Albums...");
    let albumsInsertedCount = 0;
    let albumsSkippedCount = 0;

    // Fetch any existing records for the 10 albums
    const existingAlbumsQuery = await client.query(
      "SELECT * FROM albums WHERE id = ANY($1::text[]);",
      [rawData.albums.map((a) => a.id)]
    );
    const existingAlbumsMap = new Map<string, Record<string, unknown>>();
    for (const r of existingAlbumsQuery.rows) {
      existingAlbumsMap.set(r.id as string, r);
    }

    for (const alb of rawData.albums) {
      const existingAlb = existingAlbumsMap.get(alb.id);
      if (existingAlb) {
        const comparison = compareAlbum(alb, existingAlb);
        if (comparison.matches) {
          console.log(`   ℹ️ Album '${alb.id}' already exists and matches all fields. (SKIPPED)`);
          albumsSkippedCount++;
        } else {
          throw new Error(
            `CRITICAL INTEGRITY CONFLICT: Album '${alb.id}' already exists in target DB but data differs! Differing fields: ${comparison.diffs.join(", ")}`
          );
        }
      } else {
        await client.query(
          `INSERT INTO albums (
             id, festival_id, year, title, description, location, cover_image,
             photo_count, status, sort_order, views_count, likes_count, created_at, updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, 0, $11, $12);`,
          [
            alb.id,
            alb.festivalId,
            alb.year,
            alb.title,
            alb.description,
            alb.location,
            alb.coverImage,
            alb.photoCount,
            alb.status,
            alb.sortOrder ?? 0,
            new Date(alb.createdAt),
            new Date(alb.updatedAt),
          ]
        );
        albumsInsertedCount++;
      }
    }
    console.log(`   ✅ Albums Processed: ${albumsInsertedCount} inserted, ${albumsSkippedCount} skipped (matched).`);

    // --- STEP 3: IMAGES VALIDATION & BATCH INSERT ---
    console.log("\n🖼️ Step 3: Processing 393 Whitelisted Archive Photos...");
    let imagesInsertedCount = 0;
    let imagesSkippedCount = 0;

    // Fetch any existing records for the 393 images
    const existingImagesQuery = await client.query(
      "SELECT * FROM images WHERE id = ANY($1::text[]);",
      [rawData.images.map((i) => i.id)]
    );
    const existingImagesMap = new Map<string, Record<string, unknown>>();
    for (const r of existingImagesQuery.rows) {
      existingImagesMap.set(r.id as string, r);
    }

    for (const img of rawData.images) {
      const existingImg = existingImagesMap.get(img.id);
      if (existingImg) {
        const comparison = compareImage(img, existingImg);
        if (comparison.matches) {
          imagesSkippedCount++;
        } else {
          throw new Error(
            `CRITICAL INTEGRITY CONFLICT: Image '${img.id}' already exists in target DB but data differs! Differing fields: ${comparison.diffs.join(", ")}`
          );
        }
      } else {
        await client.query(
          `INSERT INTO images (
             id, album_id, title, description, url, thumbnail_url,
             size, mime_type, photographer, date_taken, copyright, tags,
             status, views_count, likes_count, downloads_count, shares_count,
             uploaded_by, deleted_at, created_at, updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 0, 0, 0, 0, $14, $15, $16, $17);`,
          [
            img.id,
            img.albumId,
            img.title,
            img.description,
            img.url,
            img.thumbnailUrl,
            img.size,
            img.mimeType,
            img.photographer,
            img.dateTaken,
            img.copyright,
            img.tags,
            img.status,
            img.uploadedBy,
            img.deletedAt ? new Date(img.deletedAt) : null,
            new Date(img.createdAt),
            new Date(img.updatedAt),
          ]
        );
        imagesInsertedCount++;
      }
    }
    console.log(`   ✅ Images Processed: ${imagesInsertedCount} inserted, ${imagesSkippedCount} skipped (matched).`);

    // --- STEP 4: RECONCILE PHOTO_COUNT ON THE 10 ALBUMS ---
    console.log("\n🔢 Step 4: Reconciling photo_count on target albums...");
    const targetAlbumIds = rawData.albums.map((a) => a.id);
    await client.query(
      `UPDATE albums
       SET photo_count = (
         SELECT count(*)::int FROM images
         WHERE images.album_id = albums.id
           AND images.status != 'trashed'
           AND images.deleted_at IS NULL
       )
       WHERE id = ANY($1::text[]);`,
      [targetAlbumIds]
    );
    console.log("   ✅ Album photo counts reconciled against active relational image count.");

    // --- STEP 5: DEEP VERIFICATION OF PROTECTED PRODUCTION ALBUMS ---
    console.log("\n🛡️ Step 5: Performing Deep Integrity Check on Protected Production Albums...");
    const postProtectedRes = await client.query(
      `SELECT id, festival_id, year, title, description, location, cover_image, photo_count, status, views_count, likes_count
       FROM albums
       WHERE id = ANY($1::text[])
       ORDER BY id;`,
      [PROTECTED_ALBUM_IDS]
    );

    if (postProtectedRes.rows.length !== PROTECTED_ALBUM_IDS.length) {
      throw new Error(
        `CRITICAL SAFETY CHECK FAILED: Protected album count altered! Expected ${PROTECTED_ALBUM_IDS.length}, found ${postProtectedRes.rows.length}.`
      );
    }

    for (const currentProtRow of postProtectedRes.rows) {
      const albId = currentProtRow.id as string;
      const initialRow = initialProtectedMap.get(albId);
      if (!initialRow) {
        throw new Error(`CRITICAL SAFETY CHECK FAILED: Initial snapshot missing for protected album ${albId}.`);
      }
      const deepCheck = compareProtectedAlbumRows(initialRow, currentProtRow);
      if (!deepCheck.matches) {
        throw new Error(
          `CRITICAL SAFETY CHECK FAILED: Protected album '${albId}' was modified during sync! Differing fields: ${deepCheck.diffs.join(", ")}`
        );
      }
    }
    console.log("   ✅ Protected Production Albums 100% UNTOUCHED and identical in all fields.");

    // --- STEP 6: ENFORCE EXACT EXPECTED PRODUCTION COUNTS ---
    console.log("\n📊 Step 6: Enforcing Exact Expected Target Counts...");
    const [afterF, afterA, afterI, afterY] = await Promise.all([
      client.query<{ count: number }>("SELECT count(*)::int FROM festivals WHERE status != 'trashed';"),
      client.query<{ count: number }>("SELECT count(*)::int FROM albums WHERE status != 'trashed';"),
      client.query<{ count: number }>("SELECT count(*)::int FROM images WHERE status != 'trashed' AND deleted_at IS NULL;"),
      client.query<{ count: number }>("SELECT count(*)::int FROM years;"),
    ]);

    const actualFestivals = Number(afterF.rows[0]?.count || 0);
    const actualAlbums = Number(afterA.rows[0]?.count || 0);
    const actualImages = Number(afterI.rows[0]?.count || 0);
    const actualYears = Number(afterY.rows[0]?.count || 0);

    const EXPECTED_FESTIVALS = 17;
    const EXPECTED_ALBUMS = 159;
    const EXPECTED_IMAGES = 6548;
    const EXPECTED_YEARS = 10;

    console.log("   =============================================================");
    console.log("   STRICT TARGET COUNT VERIFICATION");
    console.log("   =============================================================");
    console.log(`   • Festivals: Actual = ${actualFestivals} | Expected = ${EXPECTED_FESTIVALS}`);
    console.log(`   • Albums:    Actual = ${actualAlbums}    | Expected = ${EXPECTED_ALBUMS}`);
    console.log(`   • Images:    Actual = ${actualImages}    | Expected = ${EXPECTED_IMAGES}`);
    console.log(`   • Years:     Actual = ${actualYears}     | Expected = ${EXPECTED_YEARS}`);
    console.log("   =============================================================");

    if (actualFestivals !== EXPECTED_FESTIVALS) {
      throw new Error(`EXACT COUNT ENFORCEMENT FAILED: Festivals must be exactly ${EXPECTED_FESTIVALS}, got ${actualFestivals}.`);
    }
    if (actualAlbums !== EXPECTED_ALBUMS) {
      throw new Error(`EXACT COUNT ENFORCEMENT FAILED: Albums must be exactly ${EXPECTED_ALBUMS}, got ${actualAlbums}.`);
    }
    if (actualImages !== EXPECTED_IMAGES) {
      throw new Error(`EXACT COUNT ENFORCEMENT FAILED: Images must be exactly ${EXPECTED_IMAGES}, got ${actualImages}.`);
    }
    if (actualYears !== EXPECTED_YEARS) {
      throw new Error(`EXACT COUNT ENFORCEMENT FAILED: Years must be exactly ${EXPECTED_YEARS}, got ${actualYears}.`);
    }

    console.log("   ✅ ALL EXACT PRODUCTION COUNTS PERFECTLY MATCH EXPECTATION (17 / 159 / 6548 / 10).");

    // --- STEP 7: EXPLICIT SAFETY GUARD & COMMIT/ROLLBACK ---
    if (isDryRun) {
      console.log("\n🛡️ DRY-RUN ACTIVE: Rolling back transaction (No changes were saved to database).");
      await client.query("ROLLBACK;");
      console.log("🎉 DRY-RUN SIMULATION COMPLETE! All data integrity checks and exact count validations PASSED.");
      console.log("👉 To apply live changes when approved, re-run with: --execute");
    } else {
      console.log("\n🔒 Final Confirmation Guard Passed. Committing transaction...");
      await client.query("COMMIT;");
      console.log("🎉 PRODUCTION SYNCHRONIZATION COMMITTED SUCCESSFULLY!");
    }
  } catch (error) {
    console.error("\n❌ TRANSACTION ABORTED DUE TO INTEGRITY ERROR. ISSUING ROLLBACK...");
    try {
      await client.query("ROLLBACK;");
      console.log("🔄 Transaction rolled back. Target database is completely unchanged.");
    } catch (rbErr) {
      console.error("Rollback error:", rbErr);
    }
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Execute when invoked directly
if (process.argv[1] && process.argv[1].endsWith("sync-local-to-production.ts")) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
