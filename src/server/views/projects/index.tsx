import type { FC } from "hono/jsx";
import type { projects } from "../../db/schema.ts";
import type { FilterParams } from "../../lib/filters.ts";
import { computeStatus, githubUrl, relativeDate } from "../../lib/helpers.ts";
import { ForkBadge, StatusBadge, TechStackBadge } from "../shared/badges.tsx";

type ProjectSelect = typeof projects.$inferSelect;

interface ProjectsIndexProps {
  results: ProjectSelect[];
  totalCount: number;
  page: number;
  perPage: number;
  quickResume: ProjectSelect[];
  params: FilterParams;
  techStacks: string[];
  projectTypes: string[];
}

// Filter pills component
const FilterPills: FC<{
  params: FilterParams;
}> = ({ params }) => {
  const filters: { key: string; label: string; value: string }[] = [];

  if (params.search) {
    filters.push({ key: "search", label: "Search", value: params.search });
  }
  if (params.ownership) {
    filters.push({
      key: "ownership",
      label: "Ownership",
      value: params.ownership === "own" ? "My Projects" : "Forks",
    });
  }
  if (params.status) {
    filters.push({
      key: "status",
      label: "Status",
      value: params.status.replace(/_/g, " "),
    });
  }
  if (params.techStack) {
    filters.push({
      key: "techStack",
      label: "Tech",
      value: params.techStack,
    });
  }
  if (params.type) {
    filters.push({ key: "type", label: "Type", value: params.type });
  }

  if (filters.length === 0) {
    return null;
  }

  const buildUrlWithout = (key: string) => {
    const url = new URLSearchParams();
    if (params.sort) {
      url.set("sort", params.sort);
    }
    if (params.direction) {
      url.set("direction", params.direction);
    }
    for (const f of filters) {
      if (f.key !== key && f.key !== "search") {
        url.set(f.key, params[f.key as keyof FilterParams] as string);
      }
    }
    return `/projects?${url.toString()}`;
  };

  return (
    <div class="mb-4 flex flex-wrap items-center gap-2">
      {filters.map((f) => (
        <span
          class="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-indigo-800 text-sm dark:bg-indigo-900 dark:text-indigo-300"
          key={f.key}
        >
          <span class="font-medium">{f.label}:</span>
          <span>{f.value}</span>
          <a
            class="ml-1 rounded-full p-0.5 hover:bg-indigo-200 dark:hover:bg-indigo-800"
            href={buildUrlWithout(f.key)}
          >
            ×
          </a>
        </span>
      ))}
      <a
        class="text-gray-600 text-sm hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
        href="/projects"
      >
        Clear all
      </a>
    </div>
  );
};

// Pagination component
const Pagination: FC<{
  totalCount: number;
  page: number;
  perPage: number;
  params: FilterParams;
}> = ({ totalCount, page, perPage, params }) => {
  const totalPages = Math.ceil(totalCount / perPage);
  const start = (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, totalCount);

  const buildUrl = (p: number) => {
    const url = new URLSearchParams();
    if (params.search) {
      url.set("search", params.search);
    }
    if (params.ownership) {
      url.set("ownership", params.ownership);
    }
    if (params.status) {
      url.set("status", params.status);
    }
    if (params.techStack) {
      url.set("techStack", params.techStack);
    }
    if (params.type) {
      url.set("type", params.type);
    }
    if (params.sort) {
      url.set("sort", params.sort);
    }
    if (params.direction) {
      url.set("direction", params.direction);
    }
    url.set("page", p.toString());
    return `/projects?${url.toString()}`;
  };

  const pages: number[] = [];
  const window = 2;
  for (
    let i = Math.max(1, page - window);
    i <= Math.min(totalPages, page + window);
    i++
  ) {
    pages.push(i);
  }

  return (
    <div class="flex items-center justify-between border-gray-200 border-t px-4 py-3 sm:px-6 dark:border-gray-700">
      <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <p class="text-gray-700 text-sm dark:text-gray-300">
          Showing <span class="font-medium">{start}</span> to{" "}
          <span class="font-medium">{end}</span> of{" "}
          <span class="font-medium">{totalCount}</span> projects
        </p>
        <nav class="isolate inline-flex -space-x-px rounded-md shadow-xs">
          <a
            class={`relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-gray-300 ring-inset hover:bg-gray-50 dark:ring-gray-600 dark:hover:bg-gray-700 ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
            href={page > 1 ? buildUrl(page - 1) : "#"}
          >
            Previous
          </a>
          {pages.map((p) => (
            <a
              class={`relative inline-flex items-center px-4 py-2 font-semibold text-sm ${
                p === page
                  ? "z-10 bg-indigo-600 text-white focus-visible:outline-2 focus-visible:outline-indigo-600 focus-visible:outline-offset-2"
                  : "text-gray-900 ring-1 ring-gray-300 ring-inset hover:bg-gray-50 dark:text-gray-300 dark:ring-gray-600 dark:hover:bg-gray-700"
              }`}
              href={buildUrl(p)}
              key={p}
            >
              {p}
            </a>
          ))}
          <a
            class={`relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-gray-300 ring-inset hover:bg-gray-50 dark:ring-gray-600 dark:hover:bg-gray-700 ${page >= totalPages ? "pointer-events-none opacity-50" : ""}`}
            href={page < totalPages ? buildUrl(page + 1) : "#"}
          >
            Next
          </a>
        </nav>
      </div>
    </div>
  );
};

// Results table component
const ResultsTable: FC<{
  results: ProjectSelect[];
  params: FilterParams;
}> = ({ results, params }) => {
  const setParamIfPresent = (url: URLSearchParams, key: keyof FilterParams) => {
    const value = params[key];
    if (typeof value === "string" && value.length > 0) {
      url.set(key, value);
    }
  };

  const getNextDirection = (
    sort: string,
    currentSort: string,
    currentDir: string
  ) => {
    if (sort === currentSort) {
      return currentDir === "asc" ? "desc" : "asc";
    }
    return sort === "name" ? "asc" : "desc";
  };

  const buildSortUrl = (sort: string) => {
    const url = new URLSearchParams();
    const filterKeys: (keyof FilterParams)[] = [
      "search",
      "ownership",
      "status",
      "techStack",
      "type",
    ];

    for (const key of filterKeys) {
      setParamIfPresent(url, key);
    }

    const currentSort = params.sort ?? "last_commit_date";
    const currentDir = params.direction ?? "desc";

    url.set("sort", sort);
    url.set("direction", getNextDirection(sort, currentSort, currentDir));

    return `/projects?${url.toString()}`;
  };

  const getAriaSort = (sort: string): string => {
    if (params.sort !== sort) {
      return "none";
    }
    return params.direction === "asc" ? "ascending" : "descending";
  };

  if (results.length === 0) {
    return (
      <div class="py-12 text-center">
        <p class="text-gray-500 dark:text-gray-400">
          No projects found. Try adjusting your filters.
        </p>
      </div>
    );
  }

  return (
    <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
      <caption class="sr-only">Projects list</caption>
      <thead class="bg-gray-50 dark:bg-gray-800">
        <tr>
          <th
            aria-sort={getAriaSort("name")}
            class="px-6 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
            scope="col"
          >
            <a
              class="group inline-flex items-center"
              href={buildSortUrl("name")}
            >
              Project
              <span class="ml-1 text-gray-400">
                {params.sort === "name" &&
                  (params.direction === "asc" ? "↑" : "↓")}
              </span>
            </a>
          </th>
          <th
            class="px-6 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
            scope="col"
          >
            Status
          </th>
          <th
            aria-sort={getAriaSort("last_commit_date")}
            class="hidden px-6 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider sm:table-cell dark:text-gray-400"
            scope="col"
          >
            <a
              class="group inline-flex items-center"
              href={buildSortUrl("last_commit_date")}
            >
              Last Activity
              <span class="ml-1 text-gray-400">
                {params.sort === "last_commit_date" &&
                  (params.direction === "asc" ? "↑" : "↓")}
              </span>
            </a>
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
        {results.map((project) => (
          <tr
            class="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
            data-href={`/projects/${project.id}`}
            key={project.id}
          >
            <td class="whitespace-nowrap px-6 py-4">
              <div class="flex items-center">
                <div>
                  <div class="font-medium text-gray-900 text-sm dark:text-white">
                    {project.name}
                    <ForkBadge isFork={project.isFork} />
                  </div>
                  <div class="text-gray-500 text-sm dark:text-gray-400">
                    {project.metadata?.techStack
                      ?.slice(0, 3)
                      .map((tech: string) => (
                        <span
                          class="mr-1 inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-gray-600 text-xs dark:bg-gray-800 dark:text-gray-400"
                          key={tech}
                        >
                          {tech}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            </td>
            <td class="whitespace-nowrap px-6 py-4">
              <StatusBadge status={computeStatus(project)} />
            </td>
            <td class="hidden whitespace-nowrap px-6 py-4 sm:table-cell">
              <span class="text-gray-500 text-sm dark:text-gray-400">
                {relativeDate(project.lastCommitDate)}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// Quick Resume card component
const QuickResumeCard: FC<{ project: ProjectSelect }> = ({ project }) => {
  const ghUrl = githubUrl(project.metadata);

  return (
    <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-xs transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
      <div class="mb-2 flex items-start justify-between">
        <a
          class="truncate font-semibold text-gray-900 hover:text-indigo-600 dark:text-white dark:hover:text-indigo-400"
          href={`/projects/${project.id}`}
        >
          {project.name}
        </a>
        {ghUrl && (
          <a
            class="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            href={ghUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <title>GitHub icon</title>
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
          </a>
        )}
      </div>
      <div class="mb-2 flex items-center gap-2">
        <StatusBadge status={computeStatus(project)} />
        <ForkBadge isFork={project.isFork} />
      </div>
      <p class="mb-2 line-clamp-2 text-gray-600 text-sm dark:text-gray-400">
        {project.lastCommitMessage ?? "No recent commits"}
      </p>
      <div class="flex items-center justify-between">
        <span class="text-gray-500 text-xs dark:text-gray-500">
          {relativeDate(project.lastCommitDate)}
        </span>
        <div class="flex gap-1">
          {project.metadata?.techStack?.slice(0, 4).map((tech: string) => (
            <TechStackBadge key={tech} tech={tech} />
          ))}
        </div>
      </div>
    </div>
  );
};

// Filter form component
const FilterForm: FC<{
  params: FilterParams;
  techStacks: string[];
  projectTypes: string[];
}> = ({ params, techStacks, projectTypes }) => {
  return (
    <form
      class="mb-6 space-y-4"
      hx-get="/projects"
      hx-push-url="true"
      hx-swap="innerHTML"
      hx-target="#results"
      hx-trigger="submit"
    >
      <div class="flex flex-wrap items-end gap-4">
        <div class="min-w-[200px] flex-1">
          <label
            class="mb-1 block font-medium text-gray-700 text-sm dark:text-gray-300"
            htmlFor="search"
          >
            Search
          </label>
          <input
            class="block w-full rounded-md border-gray-300 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            defaultValue={params.search ?? ""}
            hx-get="/projects"
            hx-include="closest form"
            hx-push-url="true"
            hx-swap="innerHTML"
            hx-target="#results"
            hx-trigger="input changed delay:300ms"
            id="search"
            name="search"
            placeholder="Search projects..."
            type="text"
          />
        </div>

        <div>
          <label
            class="mb-1 block font-medium text-gray-700 text-sm dark:text-gray-300"
            htmlFor="ownership"
          >
            Ownership
          </label>
          <select
            class="block w-full rounded-md border-gray-300 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            hx-get="/projects"
            hx-include="closest form"
            hx-push-url="true"
            hx-swap="innerHTML"
            hx-target="#results"
            id="ownership"
            name="ownership"
          >
            <option value="">All</option>
            <option selected={params.ownership === "own"} value="own">
              My Projects
            </option>
            <option selected={params.ownership === "forks"} value="forks">
              Forks
            </option>
          </select>
        </div>

        <div>
          <label
            class="mb-1 block font-medium text-gray-700 text-sm dark:text-gray-300"
            htmlFor="status"
          >
            Status
          </label>
          <select
            class="block w-full rounded-md border-gray-300 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            hx-get="/projects"
            hx-include="closest form"
            hx-push-url="true"
            hx-swap="innerHTML"
            hx-target="#results"
            id="status"
            name="status"
          >
            <option value="">All</option>
            <option selected={params.status === "active"} value="active">
              Active
            </option>
            <option selected={params.status === "recent"} value="recent">
              Recent
            </option>
            <option selected={params.status === "paused"} value="paused">
              Paused
            </option>
            <option selected={params.status === "wip"} value="wip">
              WIP
            </option>
            <option selected={params.status === "deployed"} value="deployed">
              Deployed
            </option>
          </select>
        </div>

        <div>
          <label
            class="mb-1 block font-medium text-gray-700 text-sm dark:text-gray-300"
            htmlFor="techStack"
          >
            Tech Stack
          </label>
          <select
            class="block w-full rounded-md border-gray-300 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            hx-get="/projects"
            hx-include="closest form"
            hx-push-url="true"
            hx-swap="innerHTML"
            hx-target="#results"
            id="techStack"
            name="techStack"
          >
            <option value="">All</option>
            {techStacks.map((tech) => (
              <option
                key={tech}
                selected={params.techStack === tech}
                value={tech}
              >
                {tech}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            class="mb-1 block font-medium text-gray-700 text-sm dark:text-gray-300"
            htmlFor="type"
          >
            Type
          </label>
          <select
            class="block w-full rounded-md border-gray-300 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            hx-get="/projects"
            hx-include="closest form"
            hx-push-url="true"
            hx-swap="innerHTML"
            hx-target="#results"
            id="type"
            name="type"
          >
            <option value="">All</option>
            {projectTypes.map((type) => (
              <option key={type} selected={params.type === type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
      </div>
    </form>
  );
};

// Results partial - for htmx swaps
interface ResultsPartialProps {
  results: ProjectSelect[];
  totalCount: number;
  page: number;
  perPage: number;
  params: FilterParams;
}

export const ResultsPartial: FC<ResultsPartialProps> = ({
  results,
  totalCount,
  page,
  perPage,
  params,
}) => {
  return (
    <>
      <FilterPills params={params} />
      <div class="overflow-hidden rounded-lg border border-gray-200 shadow-xs dark:border-gray-700">
        <ResultsTable params={params} results={results} />
      </div>
      <Pagination
        page={page}
        params={params}
        perPage={perPage}
        totalCount={totalCount}
      />
    </>
  );
};

// Main component
export const ProjectsIndex: FC<ProjectsIndexProps> = ({
  results,
  totalCount,
  page,
  perPage,
  quickResume,
  params,
  techStacks,
  projectTypes,
}) => {
  const hasFilters =
    params.search ||
    params.ownership ||
    params.status ||
    params.techStack ||
    params.type;
  const showQuickResume = !hasFilters && page === 1;

  return (
    <div>
      <div class="mb-6 flex items-center justify-between">
        <h1 class="font-bold text-2xl text-gray-900 dark:text-white">
          Projects
        </h1>
        <span class="text-gray-500 dark:text-gray-400">
          {totalCount} total
          {hasFilters && " (filtered)"}
        </span>
      </div>

      {showQuickResume && quickResume.length > 0 && (
        <div class="mb-8">
          <h2 class="mb-4 font-semibold text-gray-900 text-lg dark:text-white">
            Quick Resume
          </h2>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {quickResume.map((project) => (
              <QuickResumeCard key={project.id} project={project} />
            ))}
          </div>
        </div>
      )}

      <FilterForm
        params={params}
        projectTypes={projectTypes}
        techStacks={techStacks}
      />

      <div id="results">
        <ResultsPartial
          page={page}
          params={params}
          perPage={perPage}
          results={results}
          totalCount={totalCount}
        />
      </div>
    </div>
  );
};
