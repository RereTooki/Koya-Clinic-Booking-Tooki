import { readFile } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";

const testUrl = process.env.DATABASE_URL_TEST;
if (!testUrl) throw new Error("DATABASE_URL_TEST is required for integration tests.");
if (process.env.DATABASE_URL && process.env.DATABASE_URL === testUrl) {
  throw new Error("DATABASE_URL_TEST must be separate from DATABASE_URL.");
}

process.env.DATABASE_URL = testUrl;
process.env.KOYA_API_KEY = "integration-test-key";

const sql = postgres(testUrl, { max: 1, prepare: false, onnotice: () => undefined });
const migration = await readFile(join(process.cwd(), "db/migrations/001_initial.sql"), "utf8");
await sql.unsafe(migration);
await sql.end({ timeout: 5 });
