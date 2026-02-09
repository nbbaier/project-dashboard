import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { db } from "./db/client.ts";

const app = new Hono();

app.use(secureHeaders());

app.get("/api/health", async (c) => {
  try {
    await db.run(sql`SELECT 1`);
    return c.json({ status: "ok" });
  } catch {
    return c.json({ status: "error" }, 503);
  }
});

export default { port: 3001, fetch: app.fetch };
