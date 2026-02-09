import { program } from "commander";
import { scan } from "../src/scanner/scanner.ts";
import { scanOptionsSchema } from "../src/server/db/validators.ts";

program
  .name("project-dashboard")
  .description("Discover and track local git repositories")
  .command("scan")
  .description("Scan for git repositories and update database")
  .option("--root <path>", "Root directory to scan", "~/Code")
  .option("--cutoff-days <days>", "Skip repos with no commits in N days", "240")
  .option("--dry-run", "Scan without saving to database", false)
  .option(
    "--github-user <user>",
    "GitHub username for fork detection (or set GITHUB_USER env var)"
  )
  .action(async (rawOptions) => {
    const result = scanOptionsSchema.safeParse({
      ...rawOptions,
      githubUser: rawOptions.githubUser ?? process.env.GITHUB_USER,
    });
    if (!result.success) {
      console.error("Invalid options:");
      for (const issue of result.error.issues) {
        console.error(`  ${issue.path.join(".")}: ${issue.message}`);
      }
      process.exit(1);
    }
    await scan(result.data);
  });

program.parse();
