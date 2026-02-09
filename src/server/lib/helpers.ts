import type { projects } from "../db/schema.ts";
import type { ProjectMetadata } from "../db/validators.ts";

// Regex patterns at top level for performance
const WIP_PATTERN = /\b(wip|todo|fixme|in progress)\b/i;
const SSH_GIT_PATTERN = /git@github\.com:([^/]+)\/(.+?)\.git$/;
const HTTPS_GIT_PATTERN = /https:\/\/github\.com\/([^/]+)\/(.+?)(\.git)?$/;

type ProjectSelect = typeof projects.$inferSelect;

export type Status =
  | "active"
  | "recent"
  | "paused"
  | "wip"
  | "deployed"
  | "unknown";

/**
 * Compute project status based on commit message, deployment status, and recency.
 * Port of Project#status from Rails.
 */
export function computeStatus(project: ProjectSelect): Status {
  const lastCommitMsg = project.lastCommitMessage?.toLowerCase() ?? "";
  const metadata = project.metadata;

  // Check WIP/TODO/FIXME/in progress in commit message
  if (
    WIP_PATTERN.test(lastCommitMsg) ||
    metadata?.currentState?.toLowerCase().includes("work in progress")
  ) {
    return "wip";
  }

  // Check deployment status
  if (metadata?.deploymentStatus?.toLowerCase().includes("likely deployed")) {
    return "deployed";
  }

  // Fall back to commit recency
  const lastCommitDate = new Date(project.lastCommitDate);
  const now = new Date();
  const daysSinceCommit =
    (now.getTime() - lastCommitDate.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceCommit < 7) {
    return "active";
  }
  if (daysSinceCommit < 30) {
    return "recent";
  }
  return "paused";
}

/**
 * Return relative date string like "today", "yesterday", "3 days ago", etc.
 * Port of Project#relative_last_commit_date from Rails.
 */
export function relativeDate(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 1) {
    return "today";
  }
  if (diffDays === 1) {
    return "yesterday";
  }
  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months > 1 ? "s" : ""} ago`;
  }
  const years = Math.floor(diffDays / 365);
  return `${years} year${years > 1 ? "s" : ""} ago`;
}

/**
 * Convert SSH git remote to HTTPS GitHub URL.
 * Returns null if not a GitHub remote.
 * Port of Project#github_url from Rails.
 */
export function githubUrl(metadata: ProjectMetadata | null): string | null {
  const remote = metadata?.gitRemote;
  if (!remote) {
    return null;
  }

  // SSH format: git@github.com:user/repo.git
  const sshMatch = remote.match(SSH_GIT_PATTERN);
  if (sshMatch) {
    const [, user, repo] = sshMatch;
    return `https://github.com/${user}/${repo}`;
  }

  // HTTPS format: https://github.com/user/repo.git
  const httpsMatch = remote.match(HTTPS_GIT_PATTERN);
  if (httpsMatch) {
    const [, user, repo] = httpsMatch;
    return `https://github.com/${user}/${repo}`;
  }

  return null;
}
