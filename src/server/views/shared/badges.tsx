import type { FC } from "hono/jsx";
import type { Status } from "../../lib/helpers.ts";

interface StatusBadgeProps {
  status: Status;
}

export const StatusBadge: FC<StatusBadgeProps> = ({ status }) => {
  const styles: Record<Status, string> = {
    active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    recent:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
    paused: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
    wip: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
    deployed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
    unknown: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  };

  const dotColors: Record<Status, string> = {
    active: "bg-green-500",
    recent: "bg-emerald-500",
    paused: "bg-gray-500",
    wip: "bg-amber-500",
    deployed: "bg-blue-500",
    unknown: "bg-gray-500",
  };

  const labels: Record<Status, string> = {
    active: "Active",
    recent: "Recent",
    paused: "Paused",
    wip: "WIP",
    deployed: "Deployed",
    unknown: "Unknown",
  };

  return (
    <span
      class={`inline-flex items-center gap-x-1.5 rounded-full px-2 py-1 font-medium text-xs ${styles[status]}`}
    >
      <span class={`size-1.5 rounded-full ${dotColors[status]}`} />
      {labels[status]}
    </span>
  );
};

interface TechStackBadgeProps {
  tech: string;
}

const techEmojis: Record<string, string> = {
  typescript: "📘",
  javascript: "📒",
  python: "🐍",
  ruby: "💎",
  go: "🐹",
  rust: "⚙️",
  "c++": "🔧",
  c: "🔧",
  java: "☕",
  kotlin: "🎯",
  swift: "🦅",
  react: "⚛️",
  vue: "🟢",
  svelte: "🔥",
  tailwindcss: "💨",
  postgres: "🐘",
  mysql: "🐬",
  sqlite: "💾",
  mongodb: "🍃",
  redis: "🔴",
  docker: "🐳",
  kubernetes: "☸️",
  aws: "☁️",
  vercel: "▲",
  nextjs: "▲",
  rails: "🛤️",
  express: "🚂",
  fastapi: "🚀",
  flask: "🌶️",
  django: "🎸",
};

export const TechStackBadge: FC<TechStackBadgeProps> = ({ tech }) => {
  const emoji = techEmojis[tech.toLowerCase()] || "📦";
  return (
    <span class="inline-flex items-center gap-x-1 rounded-md bg-gray-100 px-2 py-1 text-gray-700 text-xs dark:bg-gray-800 dark:text-gray-300">
      <span>{emoji}</span>
      <span class="capitalize">{tech}</span>
    </span>
  );
};

interface ForkBadgeProps {
  isFork: boolean;
}

export const ForkBadge: FC<ForkBadgeProps> = ({ isFork }) => {
  if (!isFork) {
    return null;
  }
  return (
    <span class="ml-2 inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 font-medium text-purple-800 text-xs dark:bg-purple-900 dark:text-purple-300">
      Fork
    </span>
  );
};
