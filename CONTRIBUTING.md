# Contributing

Thanks for your interest in contributing. A few quick notes to help you get started:

- **Pre-Commit Gate**: Run `make hooks-install` upon setting up your local repository to activate the automated `.githooks/pre-commit` validation gate. Run `make pre-commit` to manually test the full validation pipeline.
- **Branching Policy**: Follow the branch naming structure `<github-username>/<parent-branch>/<change>` and hierarchy described in [BRANCHING.md](BRANCHING.md).
- **Engineering Workflow**: Follow the complete development lifecycle and human-review push boundary described in [WORKFLOW.md](WORKFLOW.md).
- **Code Style & Formatting**: Follow existing conventions. Auto-format your code using `make format` (`gofmt` for Go, `biome format` for TypeScript/React).
- **Static Analysis & Linting**: Run `make lint` and `make typecheck` before submitting pull requests.
- **Tests**: Write and run unit/integration tests for your changes. Validate your test suites with `make test` (or `make test-agents` for AI agent flows).
- **Branches & PRs**: Create a feature branch and open a PR against `main` or active epic using the [PR template](.github/PULL_REQUEST_TEMPLATE.md).
- **Secrets**: Do not commit tokens or credentials. Use `.env` or environment variables locally.
- **Issues**: Please use the [issue template](.github/ISSUE_TEMPLATE.md) when reporting bugs or suggesting features.
- **Changelog**: Update [CHANGELOG.md](CHANGELOG.md) under the `[Unreleased]` section with your changes.
- **Code of Conduct**: All contributors must follow our [Code of Conduct](CODE_OF_CONDUCT.md).
- **Security**: If you find a security vulnerability, see [SECURITY.md](SECURITY.md) for disclosure instructions.
- **Licensing**: By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
Please keep PRs focused and small — one feature or fix per PR is preferred.

