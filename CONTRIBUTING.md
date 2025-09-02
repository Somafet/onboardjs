# Contributing to OnboardJS

First off, thank you for considering contributing to OnboardJS!  
Your help is what makes this project—and the open-source community—amazing.

We welcome all contributions: code, documentation, bug reports, feature requests, and community support.

---

## Table of Contents

- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Code Style & Standards](#code-style--standards)
- [Pull Request Process](#pull-request-process)
- [Community Standards](#community-standards)
- [Questions & Support](#questions--support)

---

## How Can I Contribute?

**There are many ways to help:**

- **Report Bugs:**  
  Open an issue with clear steps to reproduce.

- **Suggest Features:**  
  Open an issue with your idea and use case.

- **Improve Documentation:**  
  Fix typos, clarify explanations, or add new guides.

- **Submit Code:**  
  Fix bugs, add features, improve tests, or refactor code.

- **Share Examples:**  
  Show how you use OnboardJS in your projects.

---

## Development Setup

1. **Fork the repository** and clone your fork:

    ```bash
    git clone https://github.com/Somafet/onboardjs.git
    cd onboardjs
    ```

2. **Install dependencies** (we recommend [pnpm](https://pnpm.io/)):

    ```bash
    pnpm install
    ```

    This will also set up git hooks automatically via husky.

3. **Build all packages:**

    ```bash
    pnpm build
    ```

4. **Run tests:**

    ```bash
    pnpm test
    ```

---

## Code Style & Standards

- **TypeScript:** All code should be written in TypeScript.
- **Linting:** Run `pnpm lint` before submitting.
- **Formatting:** Use Prettier (`pnpm format`) for consistent code style.
- **Tests:** Add or update tests for your changes.
- **Commit Messages:** Follow [Conventional Commits](https://www.conventionalcommits.org/) format:
    - `feat: add new feature`
    - `fix: resolve bug`
    - `docs: update documentation`
    - `style: code formatting changes`
    - `refactor: code refactoring`
    - `test: add or update tests`
    - `chore: maintenance tasks`
- **Git Hooks:** Husky is configured to automatically validate commit messages using commitlint.

---

## Pull Request Process

1. **Create a branch** for your change:

    ```bash
    git checkout -b (feature or bug)/your-feature-name
    ```

2. **Make your changes** and commit them using conventional commit format.

3. **Push to your fork** and open a pull request (PR) against the `main` branch.

4. **Describe your changes** in the PR template.  
   Link related issues if applicable.

5. **Participate in the review process:**  
   Be responsive to feedback and ready to make adjustments.

6. **Once approved,** your PR will be merged!

---

## Community Standards

- **Be respectful and inclusive.**
- **Follow our [Code of Conduct](./CODE_OF_CONDUCT.md).**
- **Help others and ask for help when needed.**

---

## Questions & Support

- **GitHub Discussions:** For questions, ideas, and sharing.
- **GitHub Issues:** For bugs and feature requests.
- **Discord:** (Coming soon) for real-time chat.

---

Thank you for helping make OnboardJS better!  
We’re excited to have you as part of the community 🚀
