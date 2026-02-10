import type { FC } from "hono/jsx";
import type { projects } from "../db/schema.ts";

type ProjectSelect = typeof projects.$inferSelect;

interface SidebarProps {
  data: {
    pinnedProjects: ProjectSelect[];
    recentlyViewed: ProjectSelect[];
    activeThisWeekCount: number;
    stalledCount: number;
  };
}

export const Sidebar: FC<SidebarProps> = ({ data }) => {
  const { pinnedProjects, recentlyViewed, activeThisWeekCount, stalledCount } =
    data;

  return (
    <aside class="hidden w-64 overflow-y-auto border-gray-200 border-r bg-white lg:block dark:border-gray-700 dark:bg-gray-800">
      <div class="p-4">
        <div class="mb-6">
          <a
            class="flex items-center gap-2 font-semibold text-gray-900 text-lg hover:text-indigo-600 dark:text-white dark:hover:text-indigo-400"
            href="/projects"
          >
            <svg
              class="h-6 w-6"
              fill="none"
              role="img"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <title>Project Dashboard icon</title>
              <path
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
            Project Dashboard
          </a>
        </div>

        {pinnedProjects.length > 0 && (
          <div class="mb-6">
            <h3 class="mb-3 font-semibold text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
              Pinned
            </h3>
            <ul class="space-y-1">
              {pinnedProjects.map((project) => (
                <li key={project.id}>
                  <a
                    class="flex items-center gap-2 rounded-md px-2 py-1.5 text-gray-700 text-sm hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                    href={`/projects/${project.id}`}
                  >
                    <svg
                      class="h-4 w-4 text-yellow-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <title>Pinned icon</title>
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span class="truncate">{project.name}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {recentlyViewed.length > 0 && (
          <div class="mb-6">
            <h3 class="mb-3 font-semibold text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
              Recently Viewed
            </h3>
            <ul class="space-y-1">
              {recentlyViewed.map((project) => (
                <li key={project.id}>
                  <a
                    class="flex items-center gap-2 rounded-md px-2 py-1.5 text-gray-700 text-sm hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                    href={`/projects/${project.id}`}
                  >
                    <svg
                      class="h-4 w-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <title>Recently Viewed icon</title>
                      <path
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                      />
                    </svg>
                    <span class="truncate">{project.name}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div class="mb-6">
          <h3 class="mb-3 font-semibold text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
            Smart Groups
          </h3>
          <ul class="space-y-1">
            <li>
              <a
                class="flex items-center justify-between rounded-md px-2 py-1.5 text-gray-700 text-sm hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                href="/projects?status=active_this_week"
              >
                <span class="flex items-center gap-2">
                  <svg
                    class="h-4 w-4 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <title>Active This Week icon</title>
                    <path
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  </svg>
                  Active This Week
                </span>
                <span class="text-gray-500 text-xs dark:text-gray-400">
                  {activeThisWeekCount}
                </span>
              </a>
            </li>
            <li>
              <a
                class="flex items-center justify-between rounded-md px-2 py-1.5 text-gray-700 text-sm hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                href="/projects?status=stalled"
              >
                <span class="flex items-center gap-2">
                  <svg
                    aria-hidden="true"
                    class="h-4 w-4 text-amber-500"
                    fill="none"
                    role="img"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <title>Stalled icon</title>
                    <path
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  </svg>
                  Stalled
                </span>
                <span class="text-gray-500 text-xs dark:text-gray-400">
                  {stalledCount}
                </span>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </aside>
  );
};
