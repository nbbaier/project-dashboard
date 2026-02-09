import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
// biome-ignore lint/performance/noNamespaceImport: Drizzle requires namespace import for relational queries
import * as schema from "./schema.ts";

const url = process.env.DATABASE_URL ?? "file:local.db";

if (
  (url.startsWith("libsql://") || url.startsWith("https://")) &&
  !process.env.DATABASE_AUTH_TOKEN
) {
  throw new Error("DATABASE_AUTH_TOKEN is required for remote database URLs");
}

const client = createClient({
  url,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

await client.execute("PRAGMA journal_mode = WAL");
await client.execute("PRAGMA foreign_keys = ON");
await client.execute("PRAGMA synchronous = NORMAL");
await client.execute("PRAGMA cache_size = -8000");

export const db = drizzle(client, { schema });
