import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/client.ts";
import { projects } from "../db/schema.ts";

const PER_PAGE = 25;

// Helper to transform empty strings to undefined
const emptyToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((val) => (val === "" ? undefined : val), schema);

// Zod schema for parsing + validating URL query params
export const filterParamsSchema = z.object({
  search: emptyToUndefined(z.string().optional()),
  ownership: emptyToUndefined(z.enum(["own", "forks"]).optional()),
  status: emptyToUndefined(
    z
      .enum([
        "active",
        "recent",
        "paused",
        "wip",
        "deployed",
        "active_this_week",
        "stalled",
      ])
      .optional()
  ),
  techStack: emptyToUndefined(z.string().optional()),
  type: emptyToUndefined(z.string().optional()),
  sort: emptyToUndefined(
    z.enum(["name", "last_commit_date", "commit_count"]).optional()
  ),
  direction: emptyToUndefined(z.enum(["asc", "desc"]).optional()),
  page: z.coerce.number().int().positive().optional().default(1),
});

export type FilterParams = z.infer<typeof filterParamsSchema>;

type ProjectSelect = typeof projects.$inferSelect;

// Search condition - matches name, path, commit message, or description
function searchCondition(query: string) {
  const pattern = `%${query}%`;
  return sql`(
		${projects.name} LIKE ${pattern} OR
		${projects.path} LIKE ${pattern} OR
		${projects.lastCommitMessage} LIKE ${pattern} OR
		json_extract(${projects.metadata}, '$.description') LIKE ${pattern}
	)`;
}

// Status conditions - match computeStatus() priority: WIP > Deployed > recency
function statusCondition(status: string) {
  if (status === "active" || status === "active_this_week") {
    // Active: recent commit AND not WIP AND not deployed
    return sql`(
      date(substr(${projects.lastCommitDate}, 1, 10)) >= date('now', '-7 days')
      AND NOT (
        COALESCE(${projects.lastCommitMessage}, '') LIKE '%WIP%' OR
        COALESCE(${projects.lastCommitMessage}, '') LIKE '%TODO%' OR
        COALESCE(${projects.lastCommitMessage}, '') LIKE '%FIXME%' OR
        COALESCE(${projects.lastCommitMessage}, '') LIKE '%in progress%' OR
        COALESCE(json_extract(${projects.metadata}, '$.currentState'), '') LIKE '%work in progress%'
      )
      AND NOT (COALESCE(json_extract(${projects.metadata}, '$.deploymentStatus'), '') LIKE '%likely deployed%')
    )`;
  }
  if (status === "recent") {
    // Recent: 7-30 days AND not WIP AND not deployed
    return sql`(
      date(substr(${projects.lastCommitDate}, 1, 10)) BETWEEN date('now', '-30 days') AND date('now', '-7 days')
      AND NOT (
        (${projects.lastCommitMessage} LIKE '%WIP%' OR
         ${projects.lastCommitMessage} LIKE '%TODO%' OR
         ${projects.lastCommitMessage} LIKE '%FIXME%' OR
         ${projects.lastCommitMessage} LIKE '%in progress%') OR
        json_extract(${projects.metadata}, '$.currentState') LIKE '%work in progress%'
      )
      AND NOT (json_extract(${projects.metadata}, '$.deploymentStatus') LIKE '%likely deployed%')
    )`;
  }
  if (status === "paused") {
    // Paused: >30 days AND not WIP AND not deployed
    return sql`(
      date(substr(${projects.lastCommitDate}, 1, 10)) < date('now', '-30 days')
      AND NOT (
        (${projects.lastCommitMessage} LIKE '%WIP%' OR
         ${projects.lastCommitMessage} LIKE '%TODO%' OR
         ${projects.lastCommitMessage} LIKE '%FIXME%' OR
         ${projects.lastCommitMessage} LIKE '%in progress%') OR
        json_extract(${projects.metadata}, '$.currentState') LIKE '%work in progress%'
      )
      AND NOT (json_extract(${projects.metadata}, '$.deploymentStatus') LIKE '%likely deployed%')
    )`;
  }
  if (status === "stalled") {
    return sql`date(substr(${projects.lastCommitDate}, 1, 10)) BETWEEN date('now', '-60 days') AND date('now', '-14 days')`;
  }
  if (status === "wip") {
    return sql`(
      (${projects.lastCommitMessage} LIKE '%WIP%' OR
       ${projects.lastCommitMessage} LIKE '%TODO%' OR
       ${projects.lastCommitMessage} LIKE '%FIXME%' OR
       ${projects.lastCommitMessage} LIKE '%in progress%') OR
      json_extract(${projects.metadata}, '$.currentState') LIKE '%work in progress%'
    )`;
  }
  if (status === "deployed") {
    // Deployed: has deployment status (simplified - WIP projects are rare)
    return sql`json_extract(${projects.metadata}, '$.deploymentStatus') LIKE '%likely deployed%'`;
  }
  return undefined;
}

// Tech stack condition - uses json_each for exact matching
function techStackCondition(tech: string) {
  return sql`EXISTS (
		SELECT 1 FROM json_each(json_extract(${projects.metadata}, '$.tech_stack'))
		WHERE value = ${tech}
	)`;
}

// Type condition
function typeCondition(type: string) {
  return sql`json_extract(${projects.metadata}, '$.inferred_type') = ${type}`;
}

// Ownership conditions
function ownershipCondition(ownership: string) {
  if (ownership === "own") {
    return eq(projects.isFork, false);
  }
  if (ownership === "forks") {
    return eq(projects.isFork, true);
  }
  return undefined;
}

// Build order by clause
function buildOrderBy(sort: string | undefined, direction: string | undefined) {
  const dir = direction === "asc" ? asc : desc;

  if (sort === "name") {
    return dir(projects.name);
  }
  if (sort === "commit_count") {
    const commitCountSql = sql`CAST(COALESCE(json_extract(${projects.metadata}, '$.commit_count_8m'), 0) AS INTEGER)`;
    return dir(commitCountSql);
  }
  // Default: last_commit_date
  return dir(projects.lastCommitDate);
}

// Main query function - returns paginated results
export async function queryProjects(params: FilterParams): Promise<{
  results: ProjectSelect[];
  totalCount: number;
  page: number;
  perPage: number;
}> {
  const conditions: (ReturnType<typeof sql> | ReturnType<typeof eq>)[] = [];

  if (params.search) {
    conditions.push(searchCondition(params.search));
  }

  if (params.status) {
    const statusCond = statusCondition(params.status);
    if (statusCond) {
      conditions.push(statusCond);
    }
  }

  if (params.techStack) {
    conditions.push(techStackCondition(params.techStack));
  }

  if (params.type) {
    conditions.push(typeCondition(params.type));
  }

  if (params.ownership) {
    const ownershipCond = ownershipCondition(params.ownership);
    if (ownershipCond) {
      conditions.push(ownershipCond);
    }
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const page = params.page ?? 1;
  const offset = (page - 1) * PER_PAGE;
  const orderBy = buildOrderBy(params.sort, params.direction);

  const [results, countResult] = await Promise.all([
    db
      .select()
      .from(projects)
      .where(where)
      .orderBy(orderBy)
      .limit(PER_PAGE)
      .offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(projects).where(where),
  ]);

  return {
    results,
    totalCount: countResult[0]?.count ?? 0,
    page,
    perPage: PER_PAGE,
  };
}

// Sidebar data - 3 queries run in parallel
export async function loadSidebarData(): Promise<{
  pinnedProjects: ProjectSelect[];
  recentlyViewed: ProjectSelect[];
  activeThisWeekCount: number;
  stalledCount: number;
}> {
  const [pinnedProjects, recentlyViewed, activeCount, stalledCount] =
    await Promise.all([
      // Pinned projects (up to 15, ordered by name)
      db
        .select()
        .from(projects)
        .where(eq(projects.pinned, true))
        .orderBy(asc(projects.name))
        .limit(15),
      // Recently viewed (up to 10, ordered by lastViewedAt desc)
      db
        .select()
        .from(projects)
        .where(sql`${projects.lastViewedAt} IS NOT NULL`)
        .orderBy(desc(projects.lastViewedAt))
        .limit(10),
      // Active this week count
      db
        .select({ count: sql<number>`count(*)` })
        .from(projects)
        .where(
          sql`date(substr(${projects.lastCommitDate}, 1, 10)) >= date('now', '-7 days')`
        ),
      // Stalled count (14-60 days ago)
      db
        .select({ count: sql<number>`count(*)` })
        .from(projects)
        .where(
          sql`date(substr(${projects.lastCommitDate}, 1, 10)) BETWEEN date('now', '-60 days') AND date('now', '-14 days')`
        ),
    ]);

  return {
    pinnedProjects,
    recentlyViewed,
    activeThisWeekCount: activeCount[0]?.count ?? 0,
    stalledCount: stalledCount[0]?.count ?? 0,
  };
}

// Get distinct tech stacks
export async function distinctTechStacks(): Promise<string[]> {
  const result = await db.all<{ tech_stack: string }>(sql`
		SELECT DISTINCT value as tech_stack
		FROM projects, json_each(json_extract(metadata, '$.tech_stack'))
		WHERE json_extract(metadata, '$.tech_stack') IS NOT NULL
		ORDER BY value
	`);

  return result.map((r) => r.tech_stack).filter(Boolean);
}

// Get distinct project types
export async function distinctProjectTypes(): Promise<string[]> {
  const result = await db.all<{ inferred_type: string }>(sql`
		SELECT DISTINCT json_extract(metadata, '$.inferred_type') as inferred_type
		FROM projects
		WHERE json_extract(metadata, '$.inferred_type') IS NOT NULL
		ORDER BY inferred_type
	`);

  return result.map((r) => r.inferred_type).filter(Boolean);
}

// Find adjacent projects for prev/next navigation
// Simplified approach: fetch all IDs in sorted order, then find adjacent by position
export async function findAdjacentProjects(
  currentProject: ProjectSelect,
  sort: string,
  direction: string
): Promise<[ProjectSelect | null, ProjectSelect | null]> {
  const dir = direction === "asc" ? asc : desc;

  // Get all project IDs in the current sort order
  const allProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .orderBy(dir(buildOrderBy(sort, direction)));

  const currentIndex = allProjects.findIndex((p) => p.id === currentProject.id);

  if (currentIndex === -1) {
    return [null, null];
  }

  // Get previous project
  let prevProject: ProjectSelect | null = null;
  if (currentIndex > 0) {
    const prevId = allProjects[currentIndex - 1]?.id;
    if (prevId) {
      const prevResult = await db
        .select()
        .from(projects)
        .where(eq(projects.id, prevId))
        .limit(1);
      prevProject = prevResult[0] ?? null;
    }
  }

  // Get next project
  let nextProject: ProjectSelect | null = null;
  if (currentIndex < allProjects.length - 1) {
    const nextId = allProjects[currentIndex + 1]?.id;
    if (nextId) {
      const nextResult = await db
        .select()
        .from(projects)
        .where(eq(projects.id, nextId))
        .limit(1);
      nextProject = nextResult[0] ?? null;
    }
  }

  return [prevProject, nextProject];
}
