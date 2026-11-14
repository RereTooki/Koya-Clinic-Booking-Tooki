import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";
import postgres from "postgres";

// Standalone Node scripts do not automatically load Next.js environment files.
// Load the ignored local/server configuration before resolving DATABASE_URL.
loadEnvConfig(process.cwd());

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required to run migrations.");

  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    const migration = await readFile(join(process.cwd(), "db/migrations/001_initial.sql"), "utf8");
    await sql.unsafe(migration);
    console.log("Applied db/migrations/001_initial.sql");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

void main().catch(() => {
  // Do not emit driver errors: they can include connection details.
  console.error("Migration failed.");
  process.exitCode = 1;
});
