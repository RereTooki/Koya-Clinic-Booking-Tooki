import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { loadEnvConfig } from "@next/env";

// Standalone Node scripts do not automatically load Next.js environment files.
loadEnvConfig(process.cwd());

const testUrl = process.env.DATABASE_URL_TEST;
if (!testUrl) {
  console.log("Integration tests skipped: DATABASE_URL_TEST is not configured.");
  process.exit(0);
}

if (process.env.RUN_DATABASE_INTEGRATION_TESTS !== "1") {
  console.log("Integration tests skipped: set RUN_DATABASE_INTEGRATION_TESTS=1 to opt in to destructive test-database setup.");
  process.exit(0);
}

if (process.env.DATABASE_URL && process.env.DATABASE_URL === testUrl) {
  throw new Error("DATABASE_URL_TEST must not equal DATABASE_URL.");
}

const vitestCli = join(process.cwd(), "node_modules", "vitest", "vitest.mjs");
const result = spawnSync(process.execPath, [vitestCli, "run", "--config", "vitest.integration.config.ts"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL_TEST: testUrl },
});
process.exit(result.status ?? 1);
