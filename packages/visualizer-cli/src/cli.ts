import { Command } from "commander";
import { startServer } from "./server.js";
import open from "open";

const program = new Command();

program
  .name("onboardjs-visualizer")
  .description("Start OnboardJS Visualizer web interface")
  .version("0.1.0")
  .option("-p, --port <number>", "port to run the server on", "3000")
  .option("-h, --host <string>", "host to bind the server to", "localhost")
  .option("--no-open", "don't open browser automatically")
  .option("-f, --file <path>", "JSON file to load initially")
  .action(async (options) => {
    const port = parseInt(options.port);
    const host = options.host;

    console.log(`🚀 Starting OnboardJS Visualizer...`);

    try {
      const server = await startServer({
        port,
        host,
        initialFile: options.file,
      });

      const url = `http://${host}:${port}`;
      console.log(`✅ Server running at ${url}`);

      if (options.open) {
        try {
          await open(url);
          console.log(`🌐 Opened ${url} in your default browser`);
        } catch (error) {
          console.log(
            `❌ Could not open browser automatically. Please navigate to ${url}`,
          );
        }
      }

      // Handle graceful shutdown
      process.on("SIGINT", () => {
        console.log("\n🛑 Shutting down server...");
        server.close(() => {
          console.log("✅ Server closed");
          process.exit(0);
        });
      });
    } catch (error) {
      console.error("❌ Failed to start server:", error);
      process.exit(1);
    }
  });

export function run() {
  program.parse();
}

// If this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}
