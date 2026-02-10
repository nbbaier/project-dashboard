import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { db } from "./db/client.ts";
import projectsRoutes from "./routes/projects.tsx";

const app = new Hono();

// Middleware order: logger -> secure headers -> static files -> routes
app.use(logger());
app.use(secureHeaders());
app.use("/*", serveStatic({ root: "./public" }));

// Health check
app.get("/api/health", async (c) => {
  try {
    await db.run(sql`SELECT 1`);
    return c.json({ status: "ok" });
  } catch {
    return c.json({ status: "error" }, 503);
  }
});

// Redirect root to projects
app.get("/", (c) => c.redirect("/projects"));

// Mount project routes
app.route("/projects", projectsRoutes);

// 404 handler
app.notFound((c) => c.text("Not found", 404));

// Error handler
app.onError((err, c) => {
  console.error("Error:", err);
  return c.text("Internal error", 500);
});

export default { port: 3001, fetch: app.fetch };
