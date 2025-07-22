# @onboardjs/visualizer-cli

A Command-Line Interface (CLI) tool to serve the OnboardJS Visualizer in your web browser. This package simplifies the development and demonstration of OnboardJS flows by providing a local web server to interact with the visual editor.

This package is part of the [OnboardJS](https://onboardjs.com) monorepo.

## 🚀 Features

- **Local Web Server:** Serves the OnboardJS Visualizer React application.
- **Zero Configuration:** Runs with a default port (3000) and host (localhost).
- **Customizable:** Supports custom ports, hosts, and initial JSON file loading.
- **Auto-Opening:** Automatically opens the visualizer in your default browser.
- **Hot Module Reloading (HMR):** For client-side development when running in `dev` mode.
- **Easy Integration:** Designed to work seamlessly within the OnboardJS monorepo.

## 📦 Installation

Since this is a CLI tool developed within a monorepo, there are a few ways to use it:

### 1. Local Development (Recommended)

For active development of `@onboardjs/visualizer-cli` or when working on OnboardJS flows, `npm link` is the most convenient method.

1.  **Navigate to the `visualizer-cli` package:**

    ```bash
    cd packages/visualizer-cli
    ```

2.  **Build the CLI and its client application:**
    This step compiles the TypeScript code and bundles the React client.

    ```bash
    npm run build
    ```

3.  **Create a global symbolic link to your local package:**
    This makes the `onboardjs-visualizer` command available system-wide.

    ```bash
    npm link
    ```

    - **Permission Note:** If you encounter a "Permission denied" error when running the command after `npm link`, ensure the executable file has the necessary permissions:
      ```bash
      chmod +x bin/cli.js
      npm unlink # Unlink old link
      npm link   # Re-link with correct permissions
      ```

4.  **You can now run the CLI from any directory:**
    ```bash
    onboardjs-visualizer
    # Or using npx, which will resolve the linked package:
    npx onboardjs-visualizer
    ```

### 2. Global Installation (After Publishing)

Once `@onboardjs/visualizer-cli` is published to the npm registry, users can install it globally:

```bash
npm install -g @onboardjs/visualizer-cli
```

### 3. Running Directly with `npx` (After Publishing)

Users can also run it directly without global installation if it's published:

```bash
npx @onboardjs/visualizer-cli
```

## 🚀 Usage

The CLI offers several options to customize its behavior.

```bash
onboardjs-visualizer --help
```

```
Usage: onboardjs-visualizer [options]

Start OnboardJS Visualizer web interface

Options:
  -p, --port <number>    port to run the server on (default: "3000")
  -h, --host <string>    host to bind the server to (default: "localhost")
  --no-open              don't open browser automatically
  -f, --file <path>      JSON file to load initially
  -V, --version          output the version number
  -h, --help             display help for command
```

### Examples

#### Basic Usage (Default Port 3000, Auto-Open Browser)

```bash
onboardjs-visualizer
```

#### Run on a Specific Port (e.g., 8080)

```bash
onboardjs-visualizer --port 8080
```

#### Run on a Specific Host and Port (e.g., 0.0.0.0:5000)

```bash
onboardjs-visualizer --host 0.0.0.0 --port 5000
```

#### Prevent Auto-Opening the Browser

```bash
onboardjs-visualizer --no-open
```

#### Load an Initial JSON Flow from a File

You can provide a path to a JSON file containing OnboardJS steps. The server will attempt to load these steps when the visualizer loads in the browser.

```bash
onboardjs-visualizer --file ./path/to/your-flow.json
```

_(Note: The file path should be accessible by the server process.)_

## 🛠️ Development

This section outlines how to work on the `@onboardjs/visualizer-cli` package itself.

### Prerequisites

- Node.js (LTS recommended)
- npm (or Yarn/pnpm)
- Access to the OnboardJS monorepo root.

### Project Structure

```
packages/visualizer-cli/
├── bin/
│   └── cli.js            # Executable wrapper for the compiled CLI
├── src/
│   ├── cli.ts            # Main CLI logic (commander setup)
│   ├── server.ts         # Express server setup
│   └── client/           # React client application source
│       ├── index.html
│       ├── main.tsx
│       └── App.tsx
├── public/
│   └── favicon.ico       # Client-side favicon
├── package.json
├── tsconfig.json         # TypeScript configuration
└── vite.config.ts        # Vite build configuration (for client)
```

### Build Process

The `build` script handles both the server-side TypeScript compilation and the client-side React application bundling.

```bash
# From packages/visualizer-cli directory
npm run build
# This runs: tsc (for server/CLI) && vite build --mode client (for React app)
```

The output of the build process will be in the `dist/` directory:

- `dist/cli.js`: Compiled CLI entry.
- `dist/server.js`: Compiled Express server.
- `dist/client/`: Contains the bundled React application (HTML, JS, CSS).

### Running in Development Mode

For client-side development with hot module reloading:

```bash
# From packages/visualizer-cli directory
npm run dev
```

This will start the Vite development server for the React client on port 3000 (by default). Note that changes to `cli.ts` or `server.ts` will require a `npm run build` and a restart of the `onboardjs-visualizer` command to take effect.

### Type Checking

To perform a type check without building:

```bash
# From packages/visualizer-cli directory
npm run typecheck
```

## 🤝 Monorepo Integration

This package is part of the OnboardJS monorepo. It leverages other internal packages:

- **`@onboardjs/core`**: For core OnboardingStep definitions and parsing utilities.
- **`@onboardjs/visualizer`**: The React component library that provides the visual editor itself.

The `tsconfig.json` in this package uses TypeScript `references` to connect to these internal packages, enabling better type checking and faster incremental builds across the monorepo.

**Crucially, `@onboardjs/visualizer-cli` expects `@onboardjs/visualizer` to have its Tailwind CSS bundled into its `dist/index.css` file.** This means the `visualizer-cli` only needs to import `index.css` from the `@onboardjs/visualizer` package, simplifying its own CSS pipeline and providing a cleaner experience for the end-user.

---
