/**
 * ============================================================================
 * PHASE 2 — EXISTING IMAGE METADATA SCANNER (SAFE, THROTTLED, RESUMABLE)
 * ============================================================================
 *
 * PURPOSE:
 * Scans existing PostgreSQL image records that are missing SHA-256 metadata,
 * reads the original image bytes from Cloudflare R2, extracts SHA-256 hash
 * and dimensions (width, height), and updates ONLY those fields in PostgreSQL.
 *
 * SAFETY GUARANTEES:
 * - NEVER deletes or modifies any R2 object.
 * - NEVER modifies original image bytes or thumbnails.
 * - NEVER modifies album relationships, image URLs, or status.
 * - NEVER modifies likes, favorites, views, downloads, shares, or analytics.
 * - NEVER automatically merges or deletes duplicate images.
 * - Resumable & Idempotent: naturally selects records WHERE sha256 IS NULL.
 * - Sequential (concurrency = 1) with configurable inter-item delay.
 *
 * USAGE:
 *   npx tsx scripts/scan-existing-images.ts --dry-run
 *   npx tsx scripts/scan-existing-images.ts --limit 20
 *   npx tsx scripts/scan-existing-images.ts --limit 50 --delay 250
 *   npx tsx scripts/scan-existing-images.ts --albumId <albumId> --limit 10
 * ============================================================================
 */

import "dotenv/config";
import crypto from "node:crypto";
import sharp from "sharp";
import { getDrizzleDb, isPostgresConfigured } from "../src/db/index.ts";
import * as schema from "../src/db/schema.ts";
import { eq, isNull, and, sql } from "drizzle-orm";
import { R2StorageProvider } from "../src/server/storage/r2.ts";
import { initializeDatabaseSchema } from "../src/db/migrate.ts";

interface KeyMetadataCache {
  sha256: string;
  width: number | null;
  height: number | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");

  let targetAlbumId: string | null = null;
  const albumIdx = args.indexOf("--albumId");
  if (albumIdx !== -1 && args[albumIdx + 1]) {
    targetAlbumId = args[albumIdx + 1]!.trim();
  }

  let limit = 20;
  const limitIdx = args.indexOf("--limit");
  if (limitIdx !== -1 && args[limitIdx + 1]) {
    const parsed = parseInt(args[limitIdx + 1]!, 10);
    if (!isNaN(parsed) && parsed > 0) {
      limit = Math.min(parsed, 500);
    }
  }

  let delayMs = 200;
  const delayIdx = args.indexOf("--delay");
  if (delayIdx !== -1 && args[delayIdx + 1]) {
    const parsed = parseInt(args[delayIdx + 1]!, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      delayMs = parsed;
    }
  }

  console.log("================================================================================");
  console.log("      WAT PEAREANG ARCHIVE — EXISTING IMAGE METADATA SCANNER (PHASE 2)          ");
  console.log("================================================================================");
  console.log(` Mode:           ${isDryRun ? "DRY-RUN (Preview candidates only, no writes)" : "LIVE EXECUTION"}`);
  console.log(` Target Album:   ${targetAlbumId || "ALL albums"}`);
  console.log(` Batch Limit:    ${limit} images`);
  console.log(` Throttle Delay: ${delayMs}ms between downloads`);
  console.log(` Concurrency:    1 (Strict sequential memory protection)`);
  console.log("================================================================================\n");

  // Step 1: Verify PostgreSQL connection
  if (!isPostgresConfigured()) {
    console.error("❌ ERROR: PostgreSQL connection (DATABASE_URL) is not configured.");
    process.exit(1);
  }

  const db = getDrizzleDb();
  if (!db) {
    console.error("❌ ERROR: Failed to obtain Drizzle database instance.");
    process.exit(1);
  }

  // Step 2: Verify R2 storage provider configuration
  if (!isDryRun && !R2StorageProvider.isConfigured()) {
    console.error("❌ ERROR: Cloudflare R2 credentials (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) are not configured.");
    process.exit(1);
  }

  // In live execution mode, ensure additive Phase 1 columns exist
  if (!isDryRun) {
    await initializeDatabaseSchema();
  }

  const r2 = new R2StorageProvider();

  // Step 3: Build verified candidate conditions
  const candidateConditions = [
    isNull(schema.images.sha256),
    isNull(schema.images.deletedAt),
    sql`${schema.images.status} NOT IN ('trashed', 'trash')`,
    sql`${schema.images.url} NOT LIKE '/assets/%'`,
    sql`${schema.images.url} NOT LIKE '%/thumbs/%'`,
    sql`${schema.images.url} NOT LIKE '%-thumb.%'`,
    sql`${schema.images.mimeType} LIKE 'image/%'`,
  ];

  if (targetAlbumId) {
    candidateConditions.push(eq(schema.images.albumId, targetAlbumId));
  }

  const whereClause = and(...candidateConditions);

  // Step 4: Query total remaining count
  let totalRemaining = 0;
  try {
    const [countRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.images)
      .where(whereClause);
    totalRemaining = Number(countRes?.count ?? 0);
  } catch (countErr: any) {
    if (countErr?.cause?.code === "42703" || String(countErr).includes("sha256")) {
      console.error("\n❌ Database Schema Notice: Column 'images.sha256' does not exist in the connected database.");
      console.error("   The Phase 1 migration (0001_add_image_sha256_dimensions.sql) has not been applied to this database instance.");
      console.error("   In --dry-run mode, no schema changes are executed.");
      console.error("   To apply Phase 1 schema changes to this database, run: npm run db:migrate\n");
    } else {
      console.error("❌ Database Query Error:", countErr);
    }
    process.exit(1);
  }

  console.log(`📊 Found ${totalRemaining} total image record(s) currently missing SHA-256 metadata.`);

  if (totalRemaining === 0) {
    console.log("✨ All eligible images already have SHA-256 metadata. Nothing to scan.");
    process.exit(0);
  }

  // Step 5: Fetch candidate batch up to limit
  const candidates = await db
    .select({
      id: schema.images.id,
      albumId: schema.images.albumId,
      url: schema.images.url,
      size: schema.images.size,
      mimeType: schema.images.mimeType,
      title: schema.images.title,
    })
    .from(schema.images)
    .where(whereClause)
    .orderBy(schema.images.createdAt)
    .limit(limit);

  console.log(`📦 Selected batch of ${candidates.length} candidate(s) to process.\n`);

  // Dry-run mode early exit
  if (isDryRun) {
    console.log("--------------------------------------------------------------------------------");
    console.log("DRY-RUN CANDIDATES PREVIEW (No files downloaded, no database records modified):");
    console.log("--------------------------------------------------------------------------------");
    for (let i = 0; i < candidates.length; i++) {
      const cand = candidates[i]!;
      const resolvedKey = r2.extractKeyFromUrl(cand.url);
      console.log(` [${i + 1}/${candidates.length}] ID: ${cand.id}`);
      console.log(`    Album: ${cand.albumId} | Title: "${cand.title}"`);
      console.log(`    URL:   ${cand.url}`);
      console.log(`    Key:   ${resolvedKey || "(EMPTY / UNRESOLVABLE)"}`);
      console.log("");
    }
    console.log("================================================================================");
    console.log(` Dry-run complete. Total candidates listed: ${candidates.length}.`);
    console.log(` Remaining unscanned after this batch would be: ${Math.max(0, totalRemaining - candidates.length)}.`);
    console.log(" Run without --dry-run to execute live metadata calculation and persistence.");
    console.log("================================================================================");
    process.exit(0);
  }

  // Step 6: Live processing with in-memory R2 key deduplication cache
  const keyCache = new Map<string, KeyMetadataCache>();

  let processedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let missingR2Count = 0;

  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i]!;
    processedCount++;
    console.log(`[${i + 1}/${candidates.length}] Processing image "${cand.id}" (Album: ${cand.albumId})...`);

    try {
      // 1. Resolve R2 key
      const key = r2.extractKeyFromUrl(cand.url);
      if (!key) {
        console.warn(`  ⚠️ Skipped: Could not resolve valid R2 object key from URL "${cand.url}".`);
        skippedCount++;
        continue;
      }

      let meta: KeyMetadataCache | null = null;

      // 2. Check in-memory key cache for duplicate R2 object URLs
      if (keyCache.has(key)) {
        meta = keyCache.get(key)!;
        console.log(`  ⚡ Cache Hit: Reusing calculated metadata for R2 key "${key}".`);
      } else {
        // 3. Fetch original bytes from R2
        const obj = await r2.getObject(key);
        if (!obj || !obj.body || obj.body.length === 0) {
          console.warn(`  ⚠️ Missing R2 Object: Could not find or read object at key "${key}".`);
          missingR2Count++;
          failedCount++;
          continue;
        }

        const buffer = Buffer.from(obj.body);

        // 4. Calculate SHA-256 hash
        const sha256 = crypto.createHash("sha256").update(buffer).digest("hex").toLowerCase();

        // 5. Extract dimensions via Sharp
        let width: number | null = null;
        let height: number | null = null;
        try {
          const sharpMeta = await sharp(buffer).metadata();
          if (typeof sharpMeta.width === "number" && sharpMeta.width > 0) {
            width = sharpMeta.width;
          }
          if (typeof sharpMeta.height === "number" && sharpMeta.height > 0) {
            height = sharpMeta.height;
          }
        } catch (sharpErr) {
          console.warn(`  ⚠️ Sharp dimension extraction warning for key "${key}":`, sharpErr instanceof Error ? sharpErr.message : String(sharpErr));
        }

        meta = { sha256, width, height };
        keyCache.set(key, meta);
      }

      // 6. Update ONLY sha256, width, height, updatedAt on the specific image row
      await db
        .update(schema.images)
        .set({
          sha256: meta.sha256,
          width: meta.width,
          height: meta.height,
          updatedAt: new Date(),
        })
        .where(eq(schema.images.id, cand.id));

      updatedCount++;
      console.log(`  ✅ Updated! SHA-256: ${meta.sha256.substring(0, 16)}... | Dimensions: ${meta.width ?? "?"}x${meta.height ?? "?"}`);

      // 7. Inter-item throttle delay to protect network and memory
      if (i < candidates.length - 1 && delayMs > 0) {
        await sleep(delayMs);
      }
    } catch (err) {
      console.error(`  ❌ Failed processing image "${cand.id}":`, err instanceof Error ? err.message : String(err));
      failedCount++;
    }
  }

  // Step 7: Final summary report
  const remainingAfterBatch = Math.max(0, totalRemaining - updatedCount);

  console.log("\n================================================================================");
  console.log("                     PHASE 2 SCAN EXECUTION SUMMARY                             ");
  console.log("================================================================================");
  console.log(` Total Candidates in Batch: ${candidates.length}`);
  console.log(` Processed:                 ${processedCount}`);
  console.log(` Successfully Updated:      ${updatedCount}`);
  console.log(` Skipped (Invalid Key):     ${skippedCount}`);
  console.log(` Missing R2 Objects:        ${missingR2Count}`);
  console.log(` Failed (Errors):           ${failedCount}`);
  console.log(` Remaining Unscanned:       ${remainingAfterBatch} image record(s)`);
  console.log("================================================================================");
}

main().catch((fatalErr) => {
  console.error("\n💥 Fatal Scanner Error:", fatalErr);
  process.exit(1);
});
