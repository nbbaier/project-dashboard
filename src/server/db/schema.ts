import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// -- Constants --

export const PROJECT_GOAL_STATUSES = [
  "not_started",
  "in_progress",
  "completed",
] as const;

export type ProjectGoalStatus = (typeof PROJECT_GOAL_STATUSES)[number];

// -- Metadata type --

export interface ProjectMetadata {
  lastCommitAuthor: string;
  recentCommits: { date: string; message: string }[];
  commitCount8m: number;
  contributors: string[];
  gitRemote?: string;
  referenceFiles?: {
    root?: string[];
    ai?: string[];
    cursor?: string[];
    tasks?: string[];
    docs?: string[];
  };
  description?: string;
  currentState?: string;
  techStack: string[];
  inferredType: string;
  deploymentStatus?: string;
  nestedRepos?: string[];
  plansCount?: number;
  aiDocsCount?: number;
  claudeDescription?: string | null;
  errors?: string[];
  [key: string]: unknown;
}

// -- Tables --

export const projects = sqliteTable(
  "projects",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    path: text("path").notNull().unique(),
    name: text("name").notNull(),
    lastCommitDate: text("last_commit_date").notNull(),
    lastCommitMessage: text("last_commit_message"),
    metadata: text("metadata").$type<ProjectMetadata>(),
    isFork: integer("is_fork", { mode: "boolean" }).notNull().default(false),
    pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
    lastViewedAt: integer("last_viewed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("index_projects_on_is_fork").on(table.isFork),
    index("index_projects_on_last_commit_date").on(table.lastCommitDate),
    index("index_projects_on_last_viewed_at").on(table.lastViewedAt),
    index("index_projects_on_pinned").on(table.pinned),
  ]
);

export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const taggings = sqliteTable(
  "taggings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("index_taggings_on_project_id_and_tag_id").on(
      table.projectId,
      table.tagId
    ),
    index("index_taggings_on_project_id").on(table.projectId),
    index("index_taggings_on_tag_id").on(table.tagId),
  ]
);

export const notes = sqliteTable(
  "notes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("index_notes_on_project_id_and_created_at").on(
      table.projectId,
      table.createdAt
    ),
    index("index_notes_on_project_id").on(table.projectId),
  ]
);

export const goals = sqliteTable("goals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const projectGoals = sqliteTable(
  "project_goals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    goalId: integer("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("not_started"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    uniqueIndex("index_project_goals_on_project_id_and_goal_id").on(
      table.projectId,
      table.goalId
    ),
    index("index_project_goals_on_project_id").on(table.projectId),
    index("index_project_goals_on_goal_id").on(table.goalId),
  ]
);
