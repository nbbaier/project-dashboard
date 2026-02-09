import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
// biome-ignore lint/performance/noNamespaceImport: Drizzle requires namespace import for relational queries
import * as schema from "./schema.ts";

const client = createClient({
  url: process.env.DATABASE_URL ?? "file:local.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
