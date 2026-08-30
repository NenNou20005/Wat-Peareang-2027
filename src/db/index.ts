import "dotenv/config";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import * as schema from "./schema.ts";

declare global {
  var _watPeareangPgPool: Pool | undefined;
  var _watPeareangDrizzleDb: NodePgDatabase<typeof schema> | undefined;
}

/**
 * Parses and returns the PostgreSQL PoolConfig.
 * Priority:
 * 1. DATABASE_URL
 * 2. SQL_* variables
 * 3. Standard PG* environment variables
 */
export function getPoolConfig(): PoolConfig | null {
  const databaseUrl = process.env["DATABASE_URL"];

  if (databaseUrl && databaseUrl.trim().length > 0) {
    // Only accept postgresql / postgres protocols
    if (databaseUrl.startsWith("postgresql://") || databaseUrl.startsWith("postgres://")) {
      const trimmedUrl = databaseUrl.trim();
      const isLocalhost =
        trimmedUrl.includes("@localhost") ||
        trimmedUrl.includes("@127.0.0.1") ||
        trimmedUrl.includes("localhost:") ||
        trimmedUrl.includes("127.0.0.1:");
      const isExplicitSslDisable =
        trimmedUrl.includes("sslmode=disable") || process.env["PGSSLMODE"] === "disable";

      const shouldEnableSsl =
        !isExplicitSslDisable &&
        (trimmedUrl.includes("sslmode=require") ||
          trimmedUrl.includes("ssl=true") ||
          trimmedUrl.includes("sslmode=no-verify") ||
          !isLocalhost);

      return {
        connectionString: trimmedUrl,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        ssl: shouldEnableSsl ? { rejectUnauthorized: false } : undefined,
      };
    }
  }

  // Check SQL_* variables
  if (process.env["SQL_HOST"] && process.env["SQL_DB_NAME"]) {
    const isLocalhost =
      process.env["SQL_HOST"] === "localhost" || process.env["SQL_HOST"] === "127.0.0.1";
    const isExplicitSslDisable = process.env["PGSSLMODE"] === "disable";
    const shouldEnableSsl = !isExplicitSslDisable && !isLocalhost;
    return {
      host: process.env["SQL_HOST"],
      user: process.env["SQL_USER"] || "postgres",
      password: process.env["SQL_PASSWORD"] || "",
      database: process.env["SQL_DB_NAME"],
      port: process.env["SQL_PORT"] ? parseInt(process.env["SQL_PORT"], 10) : 5432,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: shouldEnableSsl ? { rejectUnauthorized: false } : undefined,
    };
  }

  // Check standard PG* variables
  if (process.env["PGHOST"] && process.env["PGDATABASE"]) {
    const isLocalhost =
      process.env["PGHOST"] === "localhost" || process.env["PGHOST"] === "127.0.0.1";
    const isExplicitSslDisable = process.env["PGSSLMODE"] === "disable";
    const shouldEnableSsl = !isExplicitSslDisable && !isLocalhost;
    return {
      host: process.env["PGHOST"],
      user: process.env["PGUSER"] || "postgres",
      password: process.env["PGPASSWORD"] || "",
      database: process.env["PGDATABASE"],
      port: process.env["PGPORT"] ? parseInt(process.env["PGPORT"], 10) : 5432,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: shouldEnableSsl ? { rejectUnauthorized: false } : undefined,
    };
  }

  return null;
}

/**
 * Returns true if PostgreSQL connection credentials are configured.
 */
export function isPostgresConfigured(): boolean {
  return getPoolConfig() !== null;
}

/**
 * Creates or retrieves the singleton PostgreSQL connection pool.
 */
export function getPgPool(): Pool | null {
  if (globalThis._watPeareangPgPool) {
    return globalThis._watPeareangPgPool;
  }

  const config = getPoolConfig();
  if (!config) {
    return null;
  }

  try {
    const pool = new Pool(config);

    // Prevent unhandled errors from crashing the Node process
    pool.on("error", (err) => {
      console.error("[PostgreSQL Pool Error]:", err.message);
    });

    globalThis._watPeareangPgPool = pool;
    return pool;
  } catch (err) {
    console.error("[PostgreSQL Initialization Error]:", err);
    return null;
  }
}

/**
 * Returns the Drizzle ORM client instance with full schema typing.
 */
export function getDrizzleDb(): NodePgDatabase<typeof schema> | null {
  if (globalThis._watPeareangDrizzleDb) {
    return globalThis._watPeareangDrizzleDb;
  }

  const pool = getPgPool();
  if (!pool) {
    return null;
  }

  const db = drizzle(pool, { schema });
  globalThis._watPeareangDrizzleDb = db;
  return db;
}

/**
 * Performs a lightweight health check query (`SELECT 1`) on the database pool.
 */
export async function checkDbHealth(): Promise<{
  configured: boolean;
  connected: boolean;
  latencyMs?: number;
  error?: string;
}> {
  if (!isPostgresConfigured()) {
    return { configured: false, connected: false };
  }

  const pool = getPgPool();
  if (!pool) {
    return { configured: true, connected: false, error: "Pool initialization failed" };
  }

  const start = Date.now();
  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1;");
      const latencyMs = Date.now() - start;
      return { configured: true, connected: true, latencyMs };
    } finally {
      client.release();
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { configured: true, connected: false, error: message };
  }
}

/**
 * Gracefully terminates the PostgreSQL connection pool on application shutdown.
 */
export async function closePgPool(): Promise<void> {
  if (globalThis._watPeareangPgPool) {
    try {
      await globalThis._watPeareangPgPool.end();
    } catch {
      // Ignore shutdown drain errors
    }
    globalThis._watPeareangPgPool = undefined;
    globalThis._watPeareangDrizzleDb = undefined;
  }
}

export { schema };
