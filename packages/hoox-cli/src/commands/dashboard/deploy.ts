import * as p from "@clack/prompts";
import type { Command, CommandContext } from "../../core/types.js";

export class DashboardDeployCommand implements Command {
  name = "dashboard:deploy";
  description = "Deploy dashboard to Cloudflare Workers";

  async execute(ctx: CommandContext): Promise<void> {
    ctx.observer.emit("command:start", {
      cmd: this.name,
    });

    const confirmed = await p.confirm({
      message: "Deploy dashboard to Cloudflare Workers?",
      initialValue: false,
    });

    if (p.isCancel(confirmed)) {
      p.cancel("Deployment cancelled.");
      return;
    }

    if (!confirmed) return;

    const spinner = p.spinner();
    spinner.start("Building dashboard with OpenNext...");

    try {
      // Build the dashboard using opennextjs-cloudflare
      const buildProc = Bun.spawn(["bunx", "opennextjs-cloudflare", "build"], {
        cwd: `${ctx.cwd}/pages/dashboard`,
        stdout: "pipe",
        stderr: "pipe",
      });

      const buildExitCode = await buildProc.exited;

      if (buildExitCode !== 0) {
        const buildStderr = await new Response(buildProc.stderr).text();
        throw new Error(
          buildStderr || `Build failed with exit code ${buildExitCode}`
        );
      }

      spinner.message("Deploying dashboard to Cloudflare Workers...");

      // Deploy using wrangler
      const deployProc = Bun.spawn(["bunx", "wrangler", "deploy"], {
        cwd: `${ctx.cwd}/pages/dashboard`,
        stdout: "pipe",
        stderr: "pipe",
      });

      const deployExitCode = await deployProc.exited;

      if (deployExitCode !== 0) {
        const deployStderr = await new Response(deployProc.stderr).text();
        throw new Error(
          deployStderr || `Deploy failed with exit code ${deployExitCode}`
        );
      }

      spinner.stop("Dashboard deployed successfully! 🚀");
      p.outro("Dashboard is live on Cloudflare Workers!");

      ctx.observer.setState({ commandStatus: "success" });
    } catch (error) {
      spinner.stop("Deployment failed.");
      p.log.error(error instanceof Error ? error.message : String(error));
      ctx.observer.setState({
        commandStatus: "error",
        lastError: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }
}
