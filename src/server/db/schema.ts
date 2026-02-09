import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { ProjectMetadata } from "./validators.ts";

// -- Constants --

export const PROJECT_GOAL_STATUSES = [
  "not_started",
  "in_progress",
  "completed",
] as const;

export type ProjectGoalStatus = (typeof PROJECT_GOAL_STATUSES)[number];

// -- Shared columns --

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
} as const;

// -- Tables --

export const projects = sqliteTable(
  "projects",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    path: text("path").notNull().unique(),
    name: text("name").notNull(),
    lastCommitDate: text("last_commit_date").notNull(),
    lastCommitMessage: text("last_commit_message"),
    metadata: text("metadata", { mode: "json" }).$type<ProjectMetadata>(),
    isFork: integer("is_fork", { mode: "boolean" }).notNull().default(false),
    pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
    lastViewedAt: integer("last_viewed_at", { mode: "timestamp" }),
    ...timestamps,
  },
  (table) => [
    index("index_projects_on_name").on(table.name),
    index("index_projects_on_last_commit_date").on(table.lastCommitDate),
    index("index_projects_on_last_viewed_at").on(table.lastViewedAt),
  ]
);

export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  ...timestamps,
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
    ...timestamps,
  },
  (table) => [
    uniqueIndex("index_taggings_on_project_id_and_tag_id").on(
      table.projectId,
      table.tagId
    ),
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
    ...timestamps,
  },
  (table) => [
    index("index_notes_on_project_id_and_created_at").on(
      table.projectId,
      table.createdAt
    ),
  ]
);

export const goals = sqliteTable("goals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  description: text("description"),
  ...timestamps,
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
    status: text("status", { enum: PROJECT_GOAL_STATUSES })
      .notNull()
      .default("not_started"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("index_project_goals_on_project_id_and_goal_id").on(
      table.projectId,
      table.goalId
    ),
    index("index_project_goals_on_goal_id").on(table.goalId),
  ]
);

// -- Relations --

export const projectsRelations = relations(projects, ({ many }) => ({
  taggings: many(taggings),
  notes: many(notes),
  projectGoals: many(projectGoals),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  taggings: many(taggings),
}));

export const taggingsRelations = relations(taggings, ({ one }) => ({
  project: one(projects, {
    fields: [taggings.projectId],
    references: [projects.id],
  }),
  tag: one(tags, {
    fields: [taggings.tagId],
    references: [tags.id],
  }),
}));

export const notesRelations = relations(notes, ({ one }) => ({
  project: one(projects, {
    fields: [notes.projectId],
    references: [projects.id],
  }),
}));

export const goalsRelations = relations(goals, ({ many }) => ({
  projectGoals: many(projectGoals),
}));

export const projectGoalsRelations = relations(projectGoals, ({ one }) => ({
  project: one(projects, {
    fields: [projectGoals.projectId],
    references: [projects.id],
  }),
  goal: one(goals, {
    fields: [projectGoals.goalId],
    references: [goals.id],
  }),
}));
