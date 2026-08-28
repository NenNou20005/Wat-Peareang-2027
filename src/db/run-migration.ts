import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import {
  initializeDatabaseSchema,
  verifyRequiredTablesExist,
  migrateJsonToPostgres,
  REQUIRED_TABLES,
} from "./migrate.ts";
import { seedStaticArchiveToPostgres } from "./seed-archive.ts";
import { isPostgresConfigured, getDrizzleDb, getPgPool } from "./index.ts";
import * as schema from "./schema.ts";
import { sql } from "drizzle-orm";

async function main() {
  console.log("\n=================================================================");
  console.log("   WAT PEAREANG ARCHIVE - POSTGRESQL 17 PHASE 1 DATABASE SYNC   ");
  console.log("=================================================================\n");

  // Step 1: Check Connection & Configuration
  console.log("🔌 [Step 1/5] Checking PostgreSQL connection configuration...");
  if (!isPostgresConfigured()) {
    console.error("❌ ERROR: DATABASE_URL is not set in environment or .env file.");
    console.error("Please ensure your .env contains:");
    console.error(
      "DATABASE_URL=postgresql://postgres:<password>@localhost:5432/wat_peareang_archive\n",
    );
    process.exit(1);
  }

  const pool = getPgPool();
  if (!pool) {
    console.error("❌ ERROR: Failed to create PostgreSQL connection pool.");
    process.exit(1);
  }

  try {
    const client = await pool.connect();
    const dbRes = await client.query<{ current_database: string }>("SELECT current_database();");
    console.log(
      `   ✅ Connected to database: "${dbRes.rows[0]?.current_database || "wat_peareang_archive"}"`,
    );
    client.release();
  } catch (connErr) {
    console.error("❌ ERROR: Unable to connect to PostgreSQL:", connErr);
    process.exit(1);
  }

  // Step 2: Create / Initialize Schema & Tables
  console.log("\n🏗️  [Step 2/5] Creating / Verifying database tables and relations...");
  const schemaOk = await initializeDatabaseSchema();
  if (!schemaOk) {
    console.error("❌ ERROR: Database schema initialization failed.");
    process.exit(1);
  }
  console.log("   ✅ Database schema and tables created/verified successfully.");

  // Step 3: Explicitly verify that ALL required tables exist in public schema
  console.log("\n🔍 [Step 3/5] Verifying required tables in 'public' schema...");
  const tableCheck = await verifyRequiredTablesExist();
  if (!tableCheck.ok) {
    console.error("❌ ERROR: The following required tables are missing in PostgreSQL:");
    tableCheck.missing.forEach((t) => console.error(`   - ${t}`));
    process.exit(1);
  }
  console.log(`   ✅ All ${REQUIRED_TABLES.length} required tables verified in PostgreSQL:`);
  console.log(`      ${REQUIRED_TABLES.join(", ")}`);

  // Step 4: Seed static archive data or migrate JSON backup
  console.log("\n🌾 [Step 4/5] Populating initial archive and master records...");
  const jsonPath = path.join(process.cwd(), ".data", "archive_db.json");
  const hasJsonBackup = fs.existsSync(jsonPath);

  if (hasJsonBackup) {
    console.log("   📦 Found '.data/archive_db.json' backup file. Migrating records...");
    const jsonSummary = await migrateJsonToPostgres();
    if (jsonSummary.success) {
      console.log("   ✅ JSON backup records migrated idempotently.");
    } else {
      console.warn("   ⚠️ JSON migration notice:", jsonSummary.errors.join(", "));
    }
  } else {
    console.log("   ✨ Seeding static archive data (festivals, years, albums, images, users)...");
    const seedSummary = await seedStaticArchiveToPostgres();
    if (seedSummary.success) {
      console.log(
        "   ✅ Static archive data (festivals, years, albums, images, users) imported idempotently.",
      );
    } else {
      console.error(
        "   ❌ Static archive import encountered an error:",
        seedSummary.errors.join(", "),
      );
      process.exit(1);
    }
  }

  // Step 5: Query Live Record Counts
  console.log("\n📊 [Step 5/5] Querying live record counts directly from PostgreSQL...");
  const db = getDrizzleDb();
  if (!db) {
    console.error("❌ Could not obtain Drizzle DB instance.");
    process.exit(1);
  }

  try {
    const festivalsRes = await db.select({ count: sql<number>`count(*)` }).from(schema.festivals);
    const yearsRes = await db.select({ count: sql<number>`count(*)` }).from(schema.years);
    const albumsRes = await db.select({ count: sql<number>`count(*)` }).from(schema.albums);
    const imagesRes = await db.select({ count: sql<number>`count(*)` }).from(schema.images);
    const usersRes = await db.select({ count: sql<number>`count(*)` }).from(schema.users);
    const logsRes = await db.select({ count: sql<number>`count(*)` }).from(schema.activityLogs);

    console.log("\n=================================================================");
    console.log("                 POSTGRESQL RECORD COUNTS");
    console.log("=================================================================");
    console.log(`• Festivals (ពិធីបុណ្យ):      ${festivalsRes[0]?.count || 0}`);
    console.log(`• Years (ឆ្នាំបណ្ណសារ):         ${yearsRes[0]?.count || 0}`);
    console.log(`• Albums (កម្រងរូបភាព):        ${albumsRes[0]?.count || 0}`);
    console.log(`• Images (រូបថតបណ្ណសារ):       ${imagesRes[0]?.count || 0}`);
    console.log(`• Users (អ្នកប្រើប្រាស់/Admin):  ${usersRes[0]?.count || 0}`);
    console.log(`• Activity Logs (កំណត់ត្រា):   ${logsRes[0]?.count || 0}`);
    console.log("=================================================================\n");
    console.log("🎉 Database 'wat_peareang_archive' is verified and ready in pgAdmin 4!\n");
    process.exit(0);
  } catch (countErr) {
    console.error("❌ Failed to query database counts:", countErr);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("❌ Fatal Error:", e);
  process.exit(1);
});
