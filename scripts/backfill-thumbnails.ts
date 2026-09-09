/**
 * Safe, Throttled Thumbnail Backfill Utility
 * 
 * Usage:
 *   npx tsx scripts/backfill-thumbnails.ts --dry-run
 *   npx tsx scripts/backfill-thumbnails.ts --albumId <albumId> --limit 10
 *   npx tsx scripts/backfill-thumbnails.ts --limit 20 --delay 500
 */

import { getDrizzleDb, isPostgresConfigured } from "../src/db/index.ts";
import * as schema from "../src/db/schema.ts";
import { eq, or, isNull, and, sql } from "drizzle-orm";
import { getStorageProvider } from "../src/server/storage/index.ts";
import { createImageThumbnail } from "../src/server/storage/thumbnail.ts";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import crypto from "node:crypto";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  
  let targetAlbumId: string | null = null;
  const albumIdx = args.indexOf("--albumId");
  if (albumIdx !== -1 && args[albumIdx + 1]) {
    targetAlbumId = args[albumIdx + 1];
  }

  let limit = 10;
  const limitIdx = args.indexOf("--limit");
  if (limitIdx !== -1 && args[limitIdx + 1]) {
    limit = parseInt(args[limitIdx + 1], 10) || 10;
  }

  let delayMs = 300;
  const delayIdx = args.indexOf("--delay");
  if (delayIdx !== -1 && args[delayIdx + 1]) {
    delayMs = parseInt(args[delayIdx + 1], 10) || 300;
  }

  console.log("================================================================================");
  console.log("           THUMBNAIL BACKFILL UTILITY (SAFE & THROTTLED)                        ");
  console.log(` Mode: ${isDryRun ? "DRY-RUN (Preview only)" : "LIVE UPDATE"}`);
  console.log(` Target Album: ${targetAlbumId || "ALL albums"}`);
  console.log(` Batch Limit: ${limit} images | Delay between uploads: ${delayMs}ms`);
  console.log("================================================================================\n");

  const db = getDrizzleDb();
  if (!db || !isPostgresConfigured()) {
    console.error("Database connection not configured.");
    process.exit(1);
  }

  const storage = getStorageProvider();

  // Find images needing thumbnails (excluding static local bundled assets)
  const conditions = [
    or(isNull(schema.images.thumbnailUrl), eq(schema.images.thumbnailUrl, schema.images.url)),
    sql`${schema.images.deletedAt} IS NULL`,
    sql`${schema.images.url} NOT LIKE '/assets/%'`,
  ];

  if (targetAlbumId) {
    conditions.push(eq(schema.images.albumId, targetAlbumId));
  }

  const candidateImages = await db
    .select({
      id: schema.images.id,
      albumId: schema.images.albumId,
      url: schema.images.url,
      thumbnailUrl: schema.images.thumbnailUrl,
      title: schema.images.title,
    })
    .from(schema.images)
    .where(and(...conditions))
    .limit(limit);

  console.log(`Found ${candidateImages.length} images needing thumbnails.\n`);

  if (candidateImages.length === 0) {
    console.log("No images require thumbnail backfill.");
    process.exit(0);
  }

  if (isDryRun) {
    console.log("Candidate images for backfill:");
    for (const img of candidateImages) {
      console.log(`  * [${img.id}] Album: ${img.albumId} | URL: ${img.url}`);
    }
    console.log("\nDry-run complete. Run without --dry-run to process.");
    process.exit(0);
  }

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < candidateImages.length; i++) {
    const img = candidateImages[i];
    console.log(`[${i + 1}/${candidateImages.length}] Processing image ${img.id}...`);

    try {
      // 1. Fetch original image buffer
      let originalBuffer: Buffer | null = null;
      if (img.url.startsWith("/api/storage/r2/") || img.url.startsWith("https://")) {
        const key = img.url.replace(/^.*\/api\/storage\/r2\//, "").replace(/^\/+/, "");
        if (storage.getObject) {
          const obj = await storage.getObject(key);
          if (obj) originalBuffer = Buffer.from(obj.body);
        }
      }

      if (!originalBuffer) {
        console.warn(`  - Skipping ${img.id}: Unable to read original file from storage.`);
        failCount++;
        continue;
      }

      // 2. Generate WebP thumbnail
      const thumb = await createImageThumbnail(originalBuffer, 600, 80);
      if (!thumb.isOptimized) {
        console.warn(`  - Skipping ${img.id}: Could not generate optimized thumbnail.`);
        failCount++;
        continue;
      }

      // 3. Upload thumbnail
      const thumbKey = `uploads/thumbs/${Date.now()}-${crypto.randomBytes(6).toString("hex")}${thumb.ext}`;
      const bucketName = (process.env["R2_BUCKET_NAME"] || "").trim();

      // Access S3Client through storage provider save if R2
      let newThumbUrl = "";
      if (process.env["R2_ACCESS_KEY_ID"] && bucketName) {
        const s3 = new S3Client({
          region: "auto",
          endpoint: process.env["R2_ENDPOINT"] || (process.env["R2_ACCOUNT_ID"] ? `https://${process.env["R2_ACCOUNT_ID"]}.r2.cloudflarestorage.com` : undefined),
          credentials: {
            accessKeyId: process.env["R2_ACCESS_KEY_ID"]!,
            secretAccessKey: process.env["R2_SECRET_ACCESS_KEY"]!,
          },
        });
        await s3.send(
          new PutObjectCommand({
            Bucket: bucketName,
            Key: thumbKey,
            Body: thumb.buffer,
            ContentType: thumb.mimeType,
          }),
        );
        newThumbUrl = `/api/storage/r2/${thumbKey}`;
      } else {
        // Local fallback
        const saved = await storage.saveImage({
          buffer: thumb.buffer,
          originalFilename: `thumb-${img.id}.webp`,
          mimeType: thumb.mimeType,
        });
        newThumbUrl = saved.thumbnailUrl || saved.url;
      }

      // 4. Update database
      await db
        .update(schema.images)
        .set({
          thumbnailUrl: newThumbUrl,
          updatedAt: new Date(),
        })
        .where(eq(schema.images.id, img.id));

      console.log(`  -> Thumbnail generated! (${(originalBuffer.length / 1024).toFixed(0)} KB -> ${(thumb.buffer.length / 1024).toFixed(0)} KB) | Saved as: ${newThumbUrl}`);
      successCount++;

      // Delay to respect rate limits
      if (i < candidateImages.length - 1 && delayMs > 0) {
        await sleep(delayMs);
      }
    } catch (err) {
      console.error(`  - Error processing image ${img.id}:`, err instanceof Error ? err.message : err);
      failCount++;
    }
  }

  console.log("\n================================================================================");
  console.log(` Backfill Finished: ${successCount} updated, ${failCount} skipped/failed.`);
  console.log("================================================================================");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal backfill error:", err);
  process.exit(1);
});

