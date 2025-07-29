#!/usr/bin/env node
import { fileURLToPath, pathToFileURL } from "url"; // Import pathToFileURL
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Construct the absolute path to the main compiled CLI entry point
const mainCliPath = join(__dirname, "../dist/cli.js");

// Convert the absolute file path to a file:// URL for dynamic import()
const mainCliUrl = pathToFileURL(mainCliPath);

// Import and run the CLI from the built dist
import(mainCliUrl)
  .then((module) => {
    // Use the URL here
    module.run();
  })
  .catch((err) => {
    console.error("Failed to load CLI:", err);
    process.exit(1);
  });
