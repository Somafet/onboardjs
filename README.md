# OnboardJS - Build Amazing User Onboarding, Effortlessly ✨

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
<!-- Add other relevant global badges: overall build status for the monorepo, main docs link, Discord -->
<!-- [![Build Status](https://github.com/your-username/onboardjs/actions/workflows/ci.yml/badge.svg)](https://github.com/your-username/onboardjs/actions/workflows/ci.yml) -->
<!-- [![Documentation](https://img.shields.io/badge/docs-onboardjs.dev-blue)](https://onboardjs.dev) -->
<!-- [![Discord](https://img.shields.io/discord/your-discord-invite-code?label=discord&logo=discord)](https://discord.gg/your-discord-invite-code) -->

**OnboardJS is an open-source ecosystem designed to help developers quickly and easily build highly customizable, dynamic, and effective user onboarding flows for modern web applications, with a strong focus on the React and Next.js ecosystems.**

The project consists of a powerful headless core engine, dedicated React bindings for seamless UI integration, and a future visual Builder application to streamline flow creation and management.

---

## The Vision 🚀

User onboarding is one of the most critical parts of any application. A great onboarding experience can significantly improve user activation, feature adoption, and long-term retention. However, building flexible, context-aware, and engaging onboarding flows can be complex and time-consuming.

**OnboardJS aims to solve this by providing:**

*   **A Headless Core Engine:** A robust, framework-agnostic foundation for defining and managing onboarding logic.
*   **Seamless UI Integration:** First-class support for React & Next.js, allowing you to build any UI you can imagine.
*   **Maximum Customizability:** Control every aspect of your onboarding flow's appearance and behavior.
*   **Developer-Friendly Experience:** Built with TypeScript, well-tested, and thoroughly documented.
*   **A Vibrant Community:** A place to share best practices, plugins, templates, and get support.

Whether you want to code your entire onboarding experience from scratch with full control or eventually use a visual builder for speed, OnboardJS provides the tools you need.

---

## Packages in this Monorepo

This repository is a [Turborepo](https://turborepo.org/) (or your chosen monorepo tool) monorepo containing the following key packages:

*   **`packages/core` (`@onboardjs/core`)**:
    *   The headless, framework-agnostic engine. It manages flow definitions, step transitions, conditional logic, data collection (`OnboardingContext`), persistence hooks, and lifecycle events.
    *   [➡️ Go to @onboardjs/core README](./packages/core/README.md)

*   **`packages/react` (`@onboardjs/react`)**:
    *   React bindings for the core engine. Provides an `OnboardingProvider` and the `useOnboarding` hook to easily integrate onboarding logic into your React and Next.js applications, allowing you to build fully custom UIs.
    *   [➡️ Go to @onboardjs/react README](./packages/react/README.md)

*   **`apps/docs` (Future - `docs.onboardjs.com`)**:
    *   The official documentation website for OnboardJS. (Placeholder for now)
    *   [➡️ Visit Documentation](#) (Link to be updated)

*   **`apps/storybook` (Development & Showcase)**:
    *   A Storybook instance for developing and showcasing React components from `@onboardjs/react` and example step components.
    *   Helps in visual testing and component documentation.

*   **`packages/eslint-config-custom` / `packages/tsconfig` (Internal)**:
    *   Shared ESLint and TypeScript configurations for consistent development across the monorepo.

---

## Getting Started

### For Users of the Libraries

If you want to use OnboardJS in your project:

1.  **For the headless logic:**
    ```bash
    npm install @onboardjs/core
    # or yarn add @onboardjs/core / pnpm add @onboardjs/core
    ```
    Then, refer to the [**@onboardjs/core README**](./packages/core/README.md) for usage instructions.

2.  **For React/Next.js integration (Recommended):**
    ```bash
    npm install @onboardjs/core @onboardjs/react
    # or yarn add @onboardjs/core @onboardjs/react / pnpm add @onboardjs/core @onboardjs/react
    ```
    Then, refer to the [**@onboardjs/react README**](./packages/react/README.md) for detailed guides on using the `OnboardingProvider` and `useOnboarding` hook.

### For Contributors & Local Development

We welcome contributions! To get started with developing OnboardJS locally:

1.  **Prerequisites:**
    *   Node.js (LTS version recommended - e.g., v18 or v20)
    *   [pnpm](https://pnpm.io/installation) (Recommended package manager for this monorepo)
        *   If you don't have pnpm: `npm install -g pnpm`

2.  **Clone the Repository:**
    ```bash
    git clone https://github.com/your-username/onboardjs.git
    cd onboardjs
    ```

3.  **Install Dependencies:**
    ```bash
    pnpm install
    ```

4.  **Build All Packages:**
    Turborepo will build all packages in the correct order.
    ```bash
    pnpm build
    # or turbo run build
    ```

5.  **Running Development Servers:**
    *   **To run Storybook (for `@onboardjs/react` components):**
        ```bash
        pnpm --filter storybook storybook
        # or turbo run storybook --filter=storybook
        ```
    *   **To work on the Docs site (once set up):**
        ```bash
        pnpm --filter docs dev
        # or turbo run dev --filter=docs
        ```

6.  **Running Tests:**
    ```bash
    pnpm test
    # or turbo run test
    # To run tests for a specific package:
    # pnpm --filter @onboardjs/core test
    ```

7.  **Linting & Formatting:**
    ```bash
    pnpm lint
    # or turbo run lint
    pnpm format # (If you set up a format script with Prettier)
    ```

Please refer to our [**Contributing Guidelines (CONTRIBUTING.md)**](./CONTRIBUTING.md) for more detailed information on our development workflow, coding standards, and how to submit pull requests.

---

## Documentation

Comprehensive documentation is crucial for OnboardJS. We are actively working on it!

*   **[Main Documentation Site](#)** (Coming Soon! - Link to `onboardjs.dev` or your chosen docs platform)
*   For now, please refer to the README files within each package:
    *   [**@onboardjs/core README**](./packages/core/README.md)
    *   [**@onboardjs/react README**](./packages/react/README.md)

---

## Community & Support

Join the OnboardJS community to ask questions, share your projects, suggest features, and connect with other developers!

*   💬 **[GitHub Discussions](#)** - For Q&A, ideas, and showcasing.
*   🐛 **[GitHub Issues](#)** - For bug reports and feature requests for specific packages.
*   🗣️ **[Discord Server](#)** - Join our community for real-time chat! (Coming Soon)
*   🐦 **Follow me on [BlueSky @somafet.bsky.social](https://bsky.app/profile/somafet.bsky.social)** for updates.

---

## Roadmap Highlights

We have an exciting vision for OnboardJS! Some key areas on our roadmap include:

*   **v1.0 Releases:** Stable and well-documented releases for `@onboardjs/core` and `@onboardjs/react`.
*   **Next.js Starter Templates:** Beautiful, animated, and production-ready templates.
*   **Helper Packages:** For common integrations (e.g., Supabase persistence).
*   **Builder App MVP:** Initial version of the visual drag-and-drop onboarding flow builder.
    *   JSON Export
    *   Basic Flow Design
*   **Premium Builder Features:** Code export, hosted flows, advanced analytics, and more integrations.
*   **Growing the Community:** More tutorials, examples, and active support.

For a more detailed view, check our [Project Boards/Issues with a 'roadmap' label](#).

---

## Contributing

OnboardJS is an open-source project, and we welcome contributions of all kinds! From bug fixes and documentation improvements to new features and plugins, your help is invaluable.

(Coming soon)

Please see our [**Contributing Guidelines (CONTRIBUTING.md)**](./CONTRIBUTING.md) to learn how you can get involved.

Don't forget to also read our [**Code of Conduct (CODE_OF_CONDUCT.md)**](./CODE_OF_CONDUCT.md).

---

## License

This monorepo and its packages (unless specified otherwise in individual package licenses) are licensed under the [MIT License](./LICENSE).

---

We're thrilled to have you Onboard 😉. Let's make building amazing onboarding experiences easier for everyone!
