import { dirname } from "node:path";
import fg from "fast-glob";
import { db } from "../server/db/client.ts";
import { projects } from "../server/db/schema.ts";
import type { ScannedProject, ScanOptions } from "../server/db/validators.ts";
import { extractProjectData } from "./project-data.ts";

interface ScanResult {
  saved: number;
  skipped: number;
  errored: number;
  total: number;
}

async function discoverRepos(root: string): Promise<string[]> {
  const gitDirs = await fg("**/.git", {
    cwd: root,
    onlyDirectories: true,
    ignore: ["**/node_modules/**", "**/vendor/**"],
    deep: 10,
    followSymbolicLinks: false,
    absolute: true,
  });

  return gitDirs.map((p) => dirname(p)).sort();
}

async function processRepos(
  repoPaths: string[],
  cutoffDate: Date,
  githubUser: string | undefined,
  result: ScanResult
): Promise<ScannedProject[]> {
  const scannedProjects: ScannedProject[] = [];

  for (const [i, repoPath] of repoPaths.entries()) {
    const name = repoPath.split("/").pop() ?? "unknown";
    const prefix = `  [${i + 1}/${repoPaths.length}] ${name.padEnd(40)} `;

    let project: ScannedProject | null;
    try {
      project = await extractProjectData(repoPath, githubUser);
    } catch (e) {
      result.errored++;
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`${prefix}\u2717 error: ${msg.slice(0, 40)}`);
      continue;
    }

    if (!project) {
      result.skipped++;
      console.log(`${prefix}\u2299 invalid/no commits`);
      continue;
    }

    const commitDate = new Date(project.lastCommitDate);
    if (commitDate < cutoffDate) {
      result.skipped++;
      console.log(
        `${prefix}\u2299 too old (${commitDate.toISOString().split("T")[0]})`
      );
      continue;
    }

    const forkStatus = project.isFork ? "[Fork]" : "[Own]";
    const typeBadge = project.metadata.inferredType;
    const dateStr = commitDate.toISOString().split("T")[0];
    console.log(
      `${prefix}\u2713 ${forkStatus.padEnd(7)} ${typeBadge.padEnd(12)} (${dateStr})`
    );

    scannedProjects.push(project);
  }

  return scannedProjects;
}

async function persistProjects(
  scannedProjects: ScannedProject[],
  result: ScanResult
): Promise<void> {
  console.log();
  console.log("Saving to database...");

  for (const [i, project] of scannedProjects.entries()) {
    const projectName = project.name.padEnd(40);
    const forkStatus = project.isFork ? "[Fork]" : "[Own]";
    process.stdout.write(
      `  [${i + 1}/${scannedProjects.length}] ${projectName} ${forkStatus}... `
    );

    try {
      const values = {
        path: project.path,
        name: project.name,
        lastCommitDate: project.lastCommitDate,
        lastCommitMessage: project.lastCommitMessage,
        metadata: project.metadata,
        isFork: project.isFork,
      };

      await db
        .insert(projects)
        .values(values)
        .onConflictDoUpdate({
          target: projects.path,
          set: {
            name: values.name,
            lastCommitDate: values.lastCommitDate,
            lastCommitMessage: values.lastCommitMessage,
            metadata: values.metadata,
            isFork: values.isFork,
            updatedAt: new Date(),
          },
        });

      result.saved++;
      console.log("\u2713");
    } catch (e) {
      result.errored++;
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`\u2717 ${msg.slice(0, 50)}`);
    }
  }

  console.log();
  console.log(`Saved ${result.saved} projects to database`);
}

function printSummary(
  scannedProjects: ScannedProject[],
  result: ScanResult
): void {
  console.log();
  console.log("=".repeat(80));
  console.log("SCAN SUMMARY");
  console.log("=".repeat(80));
  console.log();
  console.log(`Total repos found: ${result.total}`);
  console.log(`Projects processed: ${scannedProjects.length}`);
  console.log(`Skipped: ${result.skipped}`);
  console.log(`Errored: ${result.errored}`);

  if (scannedProjects.length === 0) {
    console.log();
    console.log("=".repeat(80));
    return;
  }

  const ownProjects = scannedProjects.filter((p) => !p.isFork).length;
  const forkedProjects = scannedProjects.filter((p) => p.isFork).length;

  console.log();
  console.log("Ownership breakdown:");
  console.log(`  Your projects: ${ownProjects}`);
  console.log(`  Forked projects: ${forkedProjects}`);

  const typeCounts = new Map<string, number>();
  for (const p of scannedProjects) {
    const type = p.metadata.inferredType;
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
  }

  console.log();
  console.log("Projects by type:");
  for (const [type, count] of [...typeCounts.entries()].sort(
    (a, b) => b[1] - a[1]
  )) {
    console.log(`  ${type}: ${count}`);
  }

  console.log();
  console.log("Most recent projects:");
  const sorted = [...scannedProjects]
    .sort(
      (a, b) =>
        new Date(b.lastCommitDate).getTime() -
        new Date(a.lastCommitDate).getTime()
    )
    .slice(0, 10);

  for (const project of sorted) {
    const forkBadge = project.isFork ? "[Fork]" : "[Own]";
    const dateStr = new Date(project.lastCommitDate)
      .toISOString()
      .split("T")[0];
    console.log(
      `  \u2022 ${forkBadge} ${project.name.padEnd(30)} (${dateStr})`
    );
  }

  console.log();
  console.log("=".repeat(80));
}

export async function scan(options: ScanOptions): Promise<ScanResult> {
  const { root, cutoffDays, dryRun, githubUser } = options;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - cutoffDays);

  console.log(`Scanning for git repositories in ${root}...`);
  console.log(
    `Looking for projects with commits since ${cutoffDate.toISOString().split("T")[0]}...`
  );
  if (dryRun) {
    console.log("DRY RUN — no database changes will be made");
  }
  console.log();

  const repoPaths = await discoverRepos(root);
  console.log(`Found ${repoPaths.length} git repositories`);
  console.log();

  const result: ScanResult = {
    saved: 0,
    skipped: 0,
    errored: 0,
    total: repoPaths.length,
  };

  console.log("Processing projects...");
  const scannedProjects = await processRepos(
    repoPaths,
    cutoffDate,
    githubUser,
    result
  );

  console.log();
  console.log(
    `Processed ${scannedProjects.length} projects, skipped ${result.skipped}`
  );

  if (!dryRun && scannedProjects.length > 0) {
    await persistProjects(scannedProjects, result);
  }

  printSummary(scannedProjects, result);

  return result;
}
