import postgres, { type Sql } from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var koyaSql: Sql | undefined;
}

export class DatabaseConfigurationError extends Error {
  constructor() {
    super("Database configuration is unavailable.");
    this.name = "DatabaseConfigurationError";
  }
}

/** Lazily creates the server-only PostgreSQL client. Never call this from client code. */
export function db(): Sql {
  if (global.koyaSql) return global.koyaSql;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new DatabaseConfigurationError();

  global.koyaSql = postgres(databaseUrl, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });

  return global.koyaSql;
}
