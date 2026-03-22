# Contributing to SidClaw SDK

Thank you for your interest in contributing! This document provides guidelines.

## Development Setup

1. Clone the repo: `git clone https://github.com/sidclawhq/platform.git`
2. Install dependencies: `npm install`
3. Start the development stack: `docker compose up db -d && cd apps/api && npm run dev`
4. Run tests: `turbo test`

## Making Changes

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests: `turbo test`
5. Run lint: `turbo lint`
6. Commit with a descriptive message
7. Push and create a Pull Request

## Code Style

- TypeScript with strict mode
- Files: `kebab-case.ts`
- Classes/interfaces: `PascalCase`
- Functions/variables: `camelCase`
- No `any` in public API surfaces

## SDK Changes

The SDK (`packages/sdk/`) is the open-source component (Apache 2.0).
Changes to the SDK should:
- Include unit tests
- Not break existing public API (semver)
- Update README if adding new exports
- Include JSDoc on public functions

## Reporting Issues

Use [GitHub Issues](https://github.com/sidclawhq/platform/issues) with the provided templates.

## License

By contributing, you agree that your contributions will be licensed under the Apache 2.0 License.
