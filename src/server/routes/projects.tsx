import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/client.ts";
import { notes, projects } from "../db/schema.ts";
import {
  distinctProjectTypes,
  distinctTechStacks,
  filterParamsSchema,
  findAdjacentProjects,
  loadSidebarData,
  queryProjects,
} from "../lib/filters.ts";
import { computeStatus } from "../lib/helpers.ts";
import { Layout } from "../views/layout.tsx";
import { ProjectsIndex } from "../views/projects/index.tsx";
import { ProjectShow } from "../views/projects/show.tsx";
import { Sidebar } from "../views/sidebar.tsx";

const app = new Hono();

// Index route - list all projects with filters
app.get("/", async (c) => {
  // Parse query params through Zod schema
  const parseResult = filterParamsSchema.safeParse(c.req.query());
  const params = parseResult.success ? parseResult.data : { page: 1 };

  // Run data queries in parallel
  const [
    projectsResult,
    sidebarData,
    techStacks,
    projectTypes,
    quickResumeRaw,
  ] = await Promise.all([
    queryProjects(params),
    loadSidebarData(),
    distinctTechStacks(),
    distinctProjectTypes(),
    // 30 recent non-fork projects for Quick Resume
    db
      .select()
      .from(projects)
      .where(eq(projects.isFork, false))
      .orderBy(desc(projects.lastCommitDate))
      .limit(30),
  ]);

  // Compute Quick Resume cards (status in TypeScript, filter + take 12)
  const quickResume = quickResumeRaw
    .filter((p) =>
      ["active", "wip", "recent", "deployed"].includes(computeStatus(p))
    )
    .slice(0, 12);

  // If htmx request, return only #results fragment
  if (c.req.header("HX-Request")) {
    // Return just the results partial
    return c.html(
      <ProjectsIndex
        page={projectsResult.page}
        params={params}
        perPage={projectsResult.perPage}
        projectTypes={projectTypes}
        quickResume={quickResume}
        results={projectsResult.results}
        techStacks={techStacks}
        totalCount={projectsResult.totalCount}
      />
    );
  }

  // Full page with layout
  return c.html(
    <Layout sidebar={<Sidebar data={sidebarData} />}>
      <ProjectsIndex
        page={projectsResult.page}
        params={params}
        perPage={projectsResult.perPage}
        projectTypes={projectTypes}
        quickResume={quickResume}
        results={projectsResult.results}
        techStacks={techStacks}
        totalCount={projectsResult.totalCount}
      />
    </Layout>
  );
});

// Show route - single project detail
app.get("/:id", async (c) => {
  const id = Number.parseInt(c.req.param("id"), 10);
  if (Number.isNaN(id)) {
    return c.text("Not found", 404);
  }

  // Load project with relations using Drizzle relational query
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
    with: {
      taggings: { with: { tag: true } },
      notes: { orderBy: [desc(notes.createdAt)] },
      projectGoals: { with: { goal: true } },
    },
  });

  if (!project) {
    return c.text("Not found", 404);
  }

  // Update last_viewed_at
  await db
    .update(projects)
    .set({ lastViewedAt: new Date() })
    .where(eq(projects.id, id));

  // Prev/Next respecting sort order from query params
  const sort = c.req.query("sort") ?? "last_commit_date";
  const direction = c.req.query("direction") ?? "desc";
  const [prev, next] = await findAdjacentProjects(project, sort, direction);

  const sidebarData = await loadSidebarData();

  return c.html(
    <Layout sidebar={<Sidebar data={sidebarData} />}>
      <ProjectShow next={next} prev={prev} project={project} />
    </Layout>
  );
});

// Pin toggle route
app.post("/:id/pin", async (c) => {
  const id = Number.parseInt(c.req.param("id"), 10);
  if (Number.isNaN(id)) {
    return c.text("Not found", 404);
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
    columns: { id: true, pinned: true },
  });

  if (!project) {
    return c.text("Not found", 404);
  }

  await db
    .update(projects)
    .set({ pinned: !project.pinned })
    .where(eq(projects.id, id));

  // Redirect back to referrer, or project detail page
  const referer = c.req.header("Referer");
  return c.redirect(referer ?? `/projects/${id}`);
});

export default app;
