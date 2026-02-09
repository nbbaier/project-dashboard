import { homedir } from "node:os";
import { z } from "zod/v4";
import { PROJECT_GOAL_STATUSES } from "./schema.ts";

export const projectGoalStatusEnum = z.enum(PROJECT_GOAL_STATUSES);

export const insertProjectSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1),
  lastCommitDate: z.iso.datetime(),
  lastCommitMessage: z.string().optional(),
  isFork: z.boolean().optional(),
  pinned: z.boolean().optional(),
});

const referenceFilesSchema = z.object({
  root: z.array(z.string()).optional(),
  ai: z.array(z.string()).optional(),
  cursor: z.array(z.string()).optional(),
  tasks: z.array(z.string()).optional(),
  docs: z.array(z.string()).optional(),
});

export const projectMetadataSchema = z
  .object({
    lastCommitAuthor: z.string(),
    recentCommits: z.array(z.object({ date: z.string(), message: z.string() })),
    commitCount8m: z.number(),
    contributors: z.array(z.string()),
    gitRemote: z.string().optional(),
    referenceFiles: referenceFilesSchema.optional(),
    description: z.string().optional(),
    currentState: z.string().optional(),
    techStack: z.array(z.string()),
    inferredType: z.string(),
    deploymentStatus: z.string().optional(),
    nestedRepos: z.array(z.string()).optional(),
    plansCount: z.number().optional(),
    aiDocsCount: z.number().optional(),
    claudeDescription: z.string().nullable().optional(),
    errors: z.array(z.string()).optional(),
  })
  .passthrough();

export type ProjectMetadata = z.infer<typeof projectMetadataSchema>;

export const scannedProjectSchema = insertProjectSchema.extend({
  metadata: projectMetadataSchema,
  isFork: z.boolean(),
  lastCommitMessage: z.string().nullable(),
});

export type ScannedProject = z.infer<typeof scannedProjectSchema>;

const TILDE_RE = /^~/;

export const scanOptionsSchema = z.object({
  root: z
    .string()
    .min(1)
    .transform((p) => p.replace(TILDE_RE, homedir())),
  cutoffDays: z.coerce.number().int().positive().default(240),
  dryRun: z.boolean().default(false),
  githubUser: z.string().optional(),
});
