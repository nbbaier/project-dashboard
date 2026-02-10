import type { FC } from "hono/jsx";
import type {
  goals,
  notes,
  projectGoals,
  projects,
  taggings,
  tags,
} from "../../db/schema.ts";
import { computeStatus, githubUrl, relativeDate } from "../../lib/helpers.ts";
import { ForkBadge, StatusBadge, TechStackBadge } from "../shared/badges.tsx";

type ProjectSelect = typeof projects.$inferSelect;
type NoteSelect = typeof notes.$inferSelect;
type TagSelect = typeof tags.$inferSelect;
type TaggingSelect = typeof taggings.$inferSelect;
type GoalSelect = typeof goals.$inferSelect;
type ProjectGoalSelect = typeof projectGoals.$inferSelect;

interface ProjectShowProps {
  project: ProjectSelect & {
    taggings: (TaggingSelect & { tag: TagSelect })[];
    notes: NoteSelect[];
    projectGoals: (ProjectGoalSelect & { goal: GoalSelect })[];
  };
  prev: ProjectSelect | null;
  next: ProjectSelect | null;
}

const GoalStatusBadge: FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    not_started:
      "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
    in_progress:
      "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    completed:
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  };

  const labels: Record<string, string> = {
    not_started: "Not Started",
    in_progress: "In Progress",
    completed: "Completed",
  };

  return (
    <span
      class={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${styles[status] ?? styles.not_started}`}
    >
      {labels[status] ?? status}
    </span>
  );
};

export const ProjectShow: FC<ProjectShowProps> = ({ project, prev, next }) => {
  const ghUrl = githubUrl(project.metadata);
  const status = computeStatus(project);

  return (
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-4">
      {/* Main content */}
      <div class="lg:col-span-3">
        {/* Header */}
        <div class="mb-6 flex items-start justify-between">
          <div>
            <div class="flex items-center gap-3">
              <h1 class="font-bold text-3xl text-gray-900 dark:text-white">
                {project.name}
              </h1>
              <ForkBadge isFork={project.isFork} />
            </div>
            <div class="mt-2 flex items-center gap-2">
              <StatusBadge status={status} />
              {project.metadata?.deploymentStatus && (
                <span class="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-800 text-xs dark:bg-blue-900 dark:text-blue-300">
                  {project.metadata.deploymentStatus}
                </span>
              )}
            </div>
          </div>
          <form action={`/projects/${project.id}/pin`} method="post">
            <button
              class={`rounded-full p-2 ${project.pinned ? "bg-yellow-100 text-yellow-600" : "bg-gray-100 text-gray-400 hover:text-gray-600"} dark:bg-gray-800`}
              type="submit"
            >
              <svg
                class="h-5 w-5"
                fill={project.pinned ? "currentColor" : "none"}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <title>Bookmark icon</title>
                <path
                  d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
            </button>
          </form>
        </div>

        {/* Overview */}
        {project.metadata?.description && (
          <div class="mb-6 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h2 class="mb-2 font-semibold text-gray-900 dark:text-white">
              Overview
            </h2>
            <p class="text-gray-600 dark:text-gray-400">
              {project.metadata.description}
            </p>
          </div>
        )}

        {/* Tech Stack */}
        {project.metadata?.techStack &&
          project.metadata.techStack.length > 0 && (
            <div class="mb-6">
              <h2 class="mb-2 font-semibold text-gray-900 dark:text-white">
                Tech Stack
              </h2>
              <div class="flex flex-wrap gap-2">
                {project.metadata.techStack.map((tech: string) => (
                  <TechStackBadge key={tech} tech={tech} />
                ))}
              </div>
            </div>
          )}

        {/* Recent Activity */}
        {project.metadata?.recentCommits &&
          project.metadata.recentCommits.length > 0 && (
            <div class="mb-6">
              <h2 class="mb-2 font-semibold text-gray-900 dark:text-white">
                Recent Activity
              </h2>
              <div class="space-y-2">
                {project.metadata.recentCommits.map(
                  (
                    commit: { date: string; message: string },
                    index: number
                  ) => (
                    <div
                      class="flex items-start gap-3 border-gray-100 border-l-2 pl-3 dark:border-gray-700"
                      key={index}
                    >
                      <div class="min-w-0 flex-1">
                        <p class="truncate text-gray-900 text-sm dark:text-white">
                          {commit.message}
                        </p>
                        <p class="text-gray-500 text-xs dark:text-gray-400">
                          {relativeDate(commit.date)}
                        </p>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

        {/* Contributors */}
        {project.metadata?.contributors &&
          project.metadata.contributors.length > 0 && (
            <div class="mb-6">
              <h2 class="mb-2 font-semibold text-gray-900 dark:text-white">
                Contributors
              </h2>
              <div class="flex flex-wrap gap-2">
                {project.metadata.contributors.map((contributor: string) => (
                  <span
                    class="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-gray-700 text-sm dark:bg-gray-800 dark:text-gray-300"
                    key={contributor}
                  >
                    {contributor}
                  </span>
                ))}
              </div>
            </div>
          )}

        {/* Reference Files - Accordion */}
        {project.metadata?.referenceFiles &&
          Object.keys(project.metadata.referenceFiles).length > 0 && (
            <div class="mb-6" data-accordion>
              <button
                class="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white p-4 text-left dark:border-gray-700 dark:bg-gray-800"
                data-accordion-trigger
                type="button"
              >
                <h2 class="font-semibold text-gray-900 dark:text-white">
                  Reference Files
                </h2>
                <svg
                  class="h-5 w-5 transform text-gray-500 transition-transform"
                  data-accordion-icon
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <title>Toggle section</title>
                  <path
                    d="M19 9l-7 7-7-7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
              </button>
              <div
                class="hidden rounded-b-lg border border-gray-200 border-t-0 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
                data-accordion-content
              >
                {Object.entries(project.metadata.referenceFiles).map(
                  ([category, files]) =>
                    files &&
                    files.length > 0 && (
                      <div class="mb-3" key={category}>
                        <h3 class="mb-1 font-medium text-gray-700 text-sm capitalize dark:text-gray-300">
                          {category}
                        </h3>
                        <ul class="list-inside list-disc space-y-1">
                          {files.map((file: string) => (
                            <li
                              class="text-gray-600 text-sm dark:text-gray-400"
                              key={file}
                            >
                              {file}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                )}
              </div>
            </div>
          )}
      </div>

      {/* Sidebar */}
      <div class="space-y-6">
        {/* Quick Actions */}
        <div class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h3 class="mb-3 font-semibold text-gray-900 dark:text-white">
            Quick Actions
          </h3>
          <div class="space-y-2">
            <a
              class="flex items-center gap-2 rounded-md px-3 py-2 text-gray-700 text-sm hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              href={`vscode://file/${project.path}`}
            >
              <svg
                class="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <title>Open in VS Code</title>
                <path
                  d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
              Open in VS Code
            </a>
            {ghUrl && (
              <a
                class="flex items-center gap-2 rounded-md px-3 py-2 text-gray-700 text-sm hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                href={ghUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <title>GitHub icon</title>
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                Open on GitHub
              </a>
            )}
            <button
              class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-gray-700 text-sm hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              data-copy={project.path}
              type="button"
            >
              <svg
                class="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <title>Copy path</title>
                <path
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
              Copy Path
            </button>
          </div>
        </div>

        {/* Details */}
        <div class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <h3 class="mb-3 font-semibold text-gray-900 dark:text-white">
            Details
          </h3>
          <dl class="space-y-2">
            <div>
              <dt class="text-gray-500 text-xs dark:text-gray-400">Path</dt>
              <dd class="truncate font-mono text-gray-900 text-sm dark:text-white">
                {project.path}
              </dd>
            </div>
            {project.metadata?.inferredType && (
              <div>
                <dt class="text-gray-500 text-xs dark:text-gray-400">Type</dt>
                <dd>
                  <span class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-gray-700 text-xs dark:bg-gray-800 dark:text-gray-300">
                    {project.metadata.inferredType}
                  </span>
                </dd>
              </div>
            )}
            {project.metadata?.commitCount8m !== undefined && (
              <div>
                <dt class="text-gray-500 text-xs dark:text-gray-400">
                  Commits (8m)
                </dt>
                <dd class="text-gray-900 text-sm dark:text-white">
                  {project.metadata.commitCount8m}
                </dd>
              </div>
            )}
            <div>
              <dt class="text-gray-500 text-xs dark:text-gray-400">
                Last Commit
              </dt>
              <dd class="text-gray-900 text-sm dark:text-white">
                {relativeDate(project.lastCommitDate)}
              </dd>
            </div>
          </dl>
        </div>

        {/* Tags */}
        {project.taggings.length > 0 && (
          <div
            class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
            id="project-tags"
          >
            <h3 class="mb-3 font-semibold text-gray-900 dark:text-white">
              Tags
            </h3>
            <div class="flex flex-wrap gap-2">
              {project.taggings.map((tagging) => (
                <span
                  class="inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-indigo-800 text-sm dark:bg-indigo-900 dark:text-indigo-300"
                  key={tagging.tag.id}
                >
                  {tagging.tag.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {project.notes.length > 0 && (
          <div
            class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
            id="project-notes"
          >
            <h3 class="mb-3 font-semibold text-gray-900 dark:text-white">
              Notes
            </h3>
            <div class="space-y-3">
              {project.notes.map((note) => (
                <div
                  class="border-gray-100 border-b pb-2 last:border-0 last:pb-0 dark:border-gray-700"
                  key={note.id}
                >
                  <p class="text-gray-700 text-sm dark:text-gray-300">
                    {note.content}
                  </p>
                  <p class="mt-1 text-gray-400 text-xs dark:text-gray-500">
                    {new Date(note.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Goals */}
        {project.projectGoals.length > 0 && (
          <div
            class="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
            id="project-goals"
          >
            <h3 class="mb-3 font-semibold text-gray-900 dark:text-white">
              Goals
            </h3>
            <div class="space-y-2">
              {project.projectGoals.map((pg) => (
                <div class="flex items-center justify-between" key={pg.id}>
                  <span class="text-gray-700 text-sm dark:text-gray-300">
                    {pg.goal.name}
                  </span>
                  <GoalStatusBadge status={pg.status} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Prev/Next Navigation */}
        <div class="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          {prev ? (
            <a
              class="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
              href={`/projects/${prev.id}`}
            >
              <svg
                class="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <title>Previous icon</title>
                <path
                  d="M15 19l-7-7 7-7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
              Previous: {prev.name}
            </a>
          ) : (
            <span />
          )}
          {next ? (
            <a
              class="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
              href={`/projects/${next.id}`}
            >
              Next: {next.name}
              <svg
                class="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <title>Next icon</title>
                <path
                  d="M9 5l7 7-7 7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                />
              </svg>
            </a>
          ) : (
            <span />
          )}
        </div>
      </div>
    </div>
  );
};
