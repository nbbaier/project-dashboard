import { readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import fg from "fast-glob";
import simpleGit from "simple-git";
import type {
  ProjectMetadata,
  ScannedProject,
} from "../server/db/validators.ts";

const MAX_FILE_SIZE = 500_000;
const MAX_DESCRIPTION_LENGTH = 500;

const GITHUB_REMOTE_RE = /github\.com[:/]([^/]+)\//;
const DESCRIPTION_SECTION_RE =
  /##\s*(Description|Overview|About|Summary)\s*\n+(.+?)(?=\n##|$)/s;
const H1_CONTENT_RE = /^#[^#].+?\n+(.+?)(?=\n##|$)/s;
const GEMSPEC_SUMMARY_RE = /\.summary\s*=\s*["']([^"']+)["']/;
const WIP_RE = /WIP|TODO|FIXME|in progress/i;
const DONE_RE = /done|complete|finish|ship/i;
const DEPLOY_RE = /deploy|production|live|hosting/i;
const HEADING_OR_BLANK_RE = /^(#|\s*$)/;
const OPEN_TASK_RE = /- \[ \]/g;
const CLOSED_TASK_RE = /- \[x\]/gi;
const NESTED_GIT_RE = /\/?\.git$/;

async function fileExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isFile();
  } catch {
    return false;
  }
}

async function dirExists(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function readFileSafely(
  filePath: string,
  maxLines = 1000
): Promise<string | null> {
  try {
    if (!(await fileExists(filePath))) {
      return null;
    }
    const s = await stat(filePath);
    if (s.size > MAX_FILE_SIZE) {
      return null;
    }
    const content = await readFile(filePath, "utf-8");
    const lines = content.split("\n");
    return lines.slice(0, maxLines).join("\n");
  } catch {
    return null;
  }
}

function detectIsFork(remoteUrl: string | null, githubUser?: string): boolean {
  if (!(remoteUrl && githubUser)) {
    return false;
  }
  const match = remoteUrl.match(GITHUB_REMOTE_RE);
  if (!match) {
    return false;
  }
  return match[1].toLowerCase() !== githubUser.toLowerCase();
}

function extractDescriptionFromFile(content: string): string | null {
  const sectionMatch = content.match(DESCRIPTION_SECTION_RE);
  if (sectionMatch) {
    return sectionMatch[2]
      .trim()
      .replace(/\n+/g, " ")
      .slice(0, MAX_DESCRIPTION_LENGTH);
  }

  const lines = content
    .split("\n")
    .filter((l) => l.trim() !== "" && !l.startsWith("#"));
  const firstPara = lines.slice(0, 3).join(" ").trim();
  if (firstPara.length > 20) {
    return firstPara.slice(0, MAX_DESCRIPTION_LENGTH);
  }

  const h1Match = content.match(H1_CONTENT_RE);
  if (h1Match) {
    return h1Match[1]
      .trim()
      .replace(/\n+/g, " ")
      .slice(0, MAX_DESCRIPTION_LENGTH);
  }

  return null;
}

async function inferDescription(
  repoPath: string,
  name: string
): Promise<string> {
  const candidates = [
    join(repoPath, ".ai/PROJECT_STATUS.md"),
    join(repoPath, ".ai/README.md"),
    join(repoPath, ".cursor/PROJECT_STATUS.md"),
    join(repoPath, ".cursor/README.md"),
    join(repoPath, "CLAUDE.md"),
    join(repoPath, "AGENT.md"),
    join(repoPath, "README.md"),
  ];

  for (const filePath of candidates) {
    const content = await readFileSafely(filePath, 100);
    if (!content) {
      continue;
    }
    const desc = extractDescriptionFromFile(content);
    if (desc) {
      return desc;
    }
  }

  const pkgContent = await readFileSafely(join(repoPath, "package.json"));
  if (pkgContent) {
    try {
      const pkg = JSON.parse(pkgContent);
      if (pkg.description) {
        return pkg.description;
      }
    } catch {
      // ignore parse errors
    }
  }

  const gemspecs = await fg("*.gemspec", { cwd: repoPath, absolute: true });
  for (const gemspec of gemspecs) {
    const content = await readFileSafely(gemspec);
    if (content) {
      const match = content.match(GEMSPEC_SUMMARY_RE);
      if (match) {
        return match[1];
      }
    }
  }

  return name
    .replace(/[-_]/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

interface TechStackCheck {
  files: string[];
  stack: string;
  contentCheck?: { file: string; pattern: string; stack: string }[];
}

const TECH_STACK_CHECKS: TechStackCheck[] = [
  {
    files: ["Gemfile"],
    stack: "ruby",
    contentCheck: [{ file: "Gemfile", pattern: "rails", stack: "rails" }],
  },
  { files: ["go.mod"], stack: "go" },
  { files: ["Cargo.toml"], stack: "rust" },
  { files: ["mix.exs"], stack: "elixir" },
  { files: ["requirements.txt", "pyproject.toml"], stack: "python" },
  { files: ["pom.xml", "build.gradle"], stack: "java" },
  { files: ["CMakeLists.txt", "Makefile"], stack: "c-cpp" },
  { files: ["config/routes.rb"], stack: "rails-app" },
];

async function checkAnyFileExists(
  repoPath: string,
  files: string[]
): Promise<boolean> {
  for (const file of files) {
    if (await fileExists(join(repoPath, file))) {
      return true;
    }
  }
  return false;
}

async function applyContentChecks(
  repoPath: string,
  checks: { file: string; pattern: string; stack: string }[],
  stack: string[]
): Promise<void> {
  for (const cc of checks) {
    const content = await readFileSafely(join(repoPath, cc.file));
    if (content?.includes(cc.pattern)) {
      stack.push(cc.stack);
    }
  }
}

const NODE_DEPS: [string, string][] = [
  ['"next"', "nextjs"],
  ['"react"', "react"],
  ['"vue"', "vue"],
];

async function detectNodeFrameworks(
  repoPath: string,
  stack: string[]
): Promise<void> {
  if (!(await fileExists(join(repoPath, "package.json")))) {
    return;
  }
  stack.push("node");
  const pkg = await readFileSafely(join(repoPath, "package.json"));
  if (!pkg) {
    return;
  }
  for (const [dep, name] of NODE_DEPS) {
    if (pkg.includes(dep)) {
      stack.push(name);
    }
  }
}

async function detectTechStack(repoPath: string): Promise<string[]> {
  const stack: string[] = [];

  for (const check of TECH_STACK_CHECKS) {
    if (await checkAnyFileExists(repoPath, check.files)) {
      stack.push(check.stack);
      if (check.contentCheck) {
        await applyContentChecks(repoPath, check.contentCheck, stack);
      }
    }
  }

  await detectNodeFrameworks(repoPath, stack);

  return [...new Set(stack)];
}

const TYPE_PRIORITY: [string, string][] = [
  ["rails", "rails-app"],
  ["rails-app", "rails-app"],
  ["ruby", "ruby-app"],
  ["rust", "rust-app"],
  ["go", "go-app"],
  ["elixir", "elixir-app"],
  ["java", "java-app"],
  ["python", "python-app"],
  ["node", "node-app"],
  ["c-cpp", "c-cpp-app"],
];

function inferProjectType(techStack: string[]): string {
  for (const [stackKey, projectType] of TYPE_PRIORITY) {
    if (techStack.includes(stackKey)) {
      return projectType;
    }
  }
  return "unknown";
}

async function parseTodoState(repoPath: string): Promise<string[]> {
  const parts: string[] = [];
  const todoPaths = [
    join(repoPath, ".ai/TODO.md"),
    join(repoPath, ".cursor/TODO.md"),
    join(repoPath, "TODO.md"),
  ];

  for (const todoPath of todoPaths) {
    const content = await readFileSafely(todoPath);
    if (!content) {
      continue;
    }

    const openTasks = (content.match(OPEN_TASK_RE) || []).length;
    const closedTasks = (content.match(CLOSED_TASK_RE) || []).length;

    if (openTasks > 0) {
      parts.push(`${openTasks} open task${openTasks > 1 ? "s" : ""}`);
    }
    if (closedTasks > 0) {
      parts.push(`${closedTasks} completed task${closedTasks > 1 ? "s" : ""}`);
    }
    if (parts.length > 0) {
      break;
    }
  }
  return parts;
}

function commitRecencyLabel(lastCommitDate: string): string {
  const commitDate = new Date(lastCommitDate);
  const now = new Date();
  const daysAgo = Math.floor(
    (now.getTime() - commitDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysAgo < 7) {
    return `active (committed ${daysAgo} day${daysAgo !== 1 ? "s" : ""} ago)`;
  }
  if (daysAgo < 30) {
    return `recently active (committed ${daysAgo} days ago)`;
  }
  return `paused (last commit ${daysAgo} days ago)`;
}

async function inferCurrentState(
  repoPath: string,
  lastCommitDate: string | null,
  lastCommitMessage: string | null
): Promise<string> {
  const parts = await parseTodoState(repoPath);

  if (lastCommitMessage) {
    if (WIP_RE.test(lastCommitMessage)) {
      parts.push("work in progress");
    } else if (DONE_RE.test(lastCommitMessage)) {
      parts.push("recently completed");
    }
  }

  if (lastCommitDate) {
    parts.push(commitRecencyLabel(lastCommitDate));
  }

  return parts.join(", ") || "unknown";
}

async function inferDeploymentStatus(repoPath: string): Promise<string> {
  const indicators: string[] = [];

  if (await fileExists(join(repoPath, "bin/deploy"))) {
    indicators.push("has deploy script");
  }

  const pkgContent = await readFileSafely(join(repoPath, "package.json"));
  if (pkgContent) {
    if (pkgContent.includes('"deploy"')) {
      indicators.push("has deploy npm script");
    }
    if (pkgContent.includes('"build"')) {
      indicators.push("has build script");
    }
  }

  const readmeContent = await readFileSafely(join(repoPath, "README.md"), 50);
  if (readmeContent && DEPLOY_RE.test(readmeContent)) {
    indicators.push("deployment documented");
  }

  if (await fileExists(join(repoPath, "Dockerfile"))) {
    indicators.push("has Dockerfile");
  }
  if (await fileExists(join(repoPath, "docker-compose.yml"))) {
    indicators.push("has docker-compose");
  }
  if (await fileExists(join(repoPath, "Procfile"))) {
    indicators.push("has Procfile");
  }

  if (indicators.length > 0) {
    return `likely deployed (${indicators.join(", ")})`;
  }
  return "deployment status unknown";
}

async function findReferenceFiles(
  repoPath: string
): Promise<Record<string, string[]>> {
  const files: Record<string, string[]> = {};

  const rootFiles = ["README.md", "CLAUDE.md", "AGENT.md", "CHANGELOG.md"];
  const foundRoot: string[] = [];
  for (const filename of rootFiles) {
    if (await fileExists(join(repoPath, filename))) {
      foundRoot.push(filename);
    }
  }
  if (foundRoot.length > 0) {
    files.root = foundRoot;
  }

  const dirChecks: [string, string, string][] = [
    [".ai", "**/*.md", "ai"],
    [".cursor", "**/*.md", "cursor"],
    ["tasks", "*.md", "tasks"],
    ["docs", "*.md", "docs"],
  ];

  for (const [dir, pattern, key] of dirChecks) {
    const dirPath = join(repoPath, dir);
    if (await dirExists(dirPath)) {
      const found = await fg(pattern, { cwd: dirPath });
      if (found.length > 0) {
        files[key] = found;
      }
    }
  }

  return files;
}

async function checkNestedRepos(repoPath: string): Promise<string[]> {
  const nested = await fg("**/.git", {
    cwd: repoPath,
    onlyDirectories: true,
    ignore: [".git", "**/node_modules/**", "**/vendor/**"],
    deep: 5,
    followSymbolicLinks: false,
  });

  return nested.map((p) => p.replace(NESTED_GIT_RE, ""));
}

async function countMarkdownFiles(
  repoPath: string,
  dir: string
): Promise<number> {
  const dirPath = join(repoPath, dir);
  if (!(await dirExists(dirPath))) {
    return 0;
  }

  const files = await fg("*.md", {
    cwd: dirPath,
    ignore: ["archive/**"],
  });
  return files.length;
}

async function extractClaudeDescription(
  repoPath: string
): Promise<string | null> {
  const claudePath = join(repoPath, "CLAUDE.md");
  const content = await readFileSafely(claudePath, 100);
  if (!content) {
    return null;
  }

  const lines = content.split("\n");
  let i = 0;

  // Skip YAML frontmatter if present
  if (lines[0]?.trim() === "---") {
    i++;
    while (i < lines.length && lines[i]?.trim() !== "---") {
      i++;
    }
    if (i < lines.length) {
      i++;
    }
  }

  // Skip headings and blank lines
  while (i < lines.length && HEADING_OR_BLANK_RE.test(lines[i] ?? "")) {
    i++;
  }

  // Collect first paragraph
  const paragraph: string[] = [];
  while (i < lines.length) {
    const line = lines[i]?.trim() ?? "";
    if (line === "" && paragraph.length > 0) {
      break;
    }
    if (line !== "") {
      paragraph.push(line);
    }
    i++;
  }

  if (paragraph.length === 0) {
    return null;
  }

  const text = paragraph.join(" ");
  return text.length > MAX_DESCRIPTION_LENGTH
    ? `${text.slice(0, MAX_DESCRIPTION_LENGTH)}...`
    : text;
}

function errorMsg(prefix: string, e: unknown): string {
  return `${prefix}: ${e instanceof Error ? e.message : String(e)}`;
}

async function extractGitData(git: ReturnType<typeof simpleGit>) {
  const log = await git.log({ maxCount: 10 });
  if (!log.latest) {
    return null;
  }

  const authorSet = new Set(log.all.map((entry) => entry.author_name));

  return {
    lastCommitDate: log.latest.date,
    lastCommitMessage: log.latest.message,
    lastCommitAuthor: log.latest.author_name,
    recentCommits: log.all.map((entry) => ({
      date: entry.date,
      message: entry.message,
    })),
    contributors: [...authorSet],
  };
}

async function extractMetadata(
  repoPath: string,
  name: string,
  gitData: NonNullable<Awaited<ReturnType<typeof extractGitData>>>,
  gitRemote: string | undefined,
  errors: string[]
): Promise<ProjectMetadata> {
  let referenceFiles: Record<string, string[]> = {};
  try {
    referenceFiles = await findReferenceFiles(repoPath);
  } catch (e) {
    errors.push(errorMsg("Reference files error", e));
  }

  let description = name;
  try {
    description = await inferDescription(repoPath, name);
  } catch (e) {
    errors.push(errorMsg("Description error", e));
  }

  let techStack: string[] = [];
  try {
    techStack = await detectTechStack(repoPath);
  } catch (e) {
    errors.push(errorMsg("Tech stack error", e));
  }

  const inferredType = inferProjectType(techStack);

  let currentState = "unknown";
  try {
    currentState = await inferCurrentState(
      repoPath,
      gitData.lastCommitDate,
      gitData.lastCommitMessage
    );
  } catch (e) {
    errors.push(errorMsg("State error", e));
  }

  let deploymentStatus: string | undefined;
  try {
    deploymentStatus = await inferDeploymentStatus(repoPath);
  } catch (e) {
    errors.push(errorMsg("Deployment error", e));
  }

  let nestedRepos: string[] = [];
  try {
    nestedRepos = await checkNestedRepos(repoPath);
  } catch (e) {
    errors.push(errorMsg("Nested repos error", e));
  }

  let plansCount = 0;
  try {
    plansCount = await countMarkdownFiles(repoPath, "plans");
  } catch (e) {
    errors.push(errorMsg("Plans count error", e));
  }

  let aiDocsCount = 0;
  try {
    aiDocsCount = await countMarkdownFiles(repoPath, ".ai");
  } catch (e) {
    errors.push(errorMsg("AI docs count error", e));
  }

  let claudeDescription: string | null = null;
  try {
    claudeDescription = await extractClaudeDescription(repoPath);
  } catch (e) {
    errors.push(errorMsg("Claude description error", e));
  }

  return {
    lastCommitAuthor: gitData.lastCommitAuthor,
    recentCommits: gitData.recentCommits,
    commitCount8m: 0, // filled by caller
    contributors: gitData.contributors,
    gitRemote,
    referenceFiles:
      Object.keys(referenceFiles).length > 0 ? referenceFiles : undefined,
    description,
    currentState,
    techStack,
    inferredType,
    deploymentStatus,
    nestedRepos: nestedRepos.length > 0 ? nestedRepos : undefined,
    plansCount,
    aiDocsCount,
    claudeDescription,
    errors: errors.length > 0 ? errors : undefined,
  };
}

export async function extractProjectData(
  repoPath: string,
  githubUser?: string
): Promise<ScannedProject | null> {
  const errors: string[] = [];
  const name = basename(repoPath);

  if (!(await dirExists(join(repoPath, ".git")))) {
    return null;
  }

  const git = simpleGit(repoPath);

  // Extract git data
  let gitData: Awaited<ReturnType<typeof extractGitData>>;
  try {
    gitData = await extractGitData(git);
  } catch (e) {
    errors.push(errorMsg("Git log error", e));
    return null;
  }
  if (!gitData) {
    return null;
  }

  // Commit count in last 8 months (fixes hardcoded cutoff bug)
  let commitCount8m = 0;
  try {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 8);
    const sinceDate = cutoffDate.toISOString().split("T")[0];
    const countLog = await git.log({
      from: "",
      to: "HEAD",
      "--since": sinceDate,
    });
    commitCount8m = countLog.total;
  } catch (e) {
    errors.push(errorMsg("Commit count error", e));
  }

  // Git remote
  let gitRemote: string | undefined;
  try {
    const remotes = await git.getRemotes(true);
    const origin = remotes.find((r) => r.name === "origin");
    if (origin?.refs?.fetch) {
      gitRemote = origin.refs.fetch;
    }
  } catch (e) {
    errors.push(errorMsg("Remote error", e));
  }

  const isFork = detectIsFork(gitRemote ?? null, githubUser);

  const metadata = await extractMetadata(
    repoPath,
    name,
    gitData,
    gitRemote,
    errors
  );
  metadata.commitCount8m = commitCount8m;

  return {
    path: repoPath,
    name,
    lastCommitDate: gitData.lastCommitDate,
    lastCommitMessage: gitData.lastCommitMessage,
    isFork,
    metadata,
  };
}
