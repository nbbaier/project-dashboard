import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "./db/client.ts";

const app = new Hono();

app.get("/api/health", async (c) => {
  await db.run(sql`SELECT 1`);
  return c.json({ status: "ok" });
});

export default {
  port: 3001,
  fetch: app.fetch,
};
