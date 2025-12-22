# Contributing to smig

Thanks for your interest in contributing to **smig**! This document covers the essentials.

## Before You Start

1. **Read [AGENTS.md](https://github.com/kathysledge/smig/blob/main/AGENTS.md)** — Contains full project context, architecture, and conventions
2. **Check existing issues** — Someone may already be working on it
3. **Open an issue first** for significant changes to discuss the approach

## Development Setup

```bash
# Clone and install
git clone git@github.com:kathysledge/smig.git
cd smig
bun install

# Build
bun run build

# Run tests
bun run test                # Unit tests
bun run test:integration    # Integration tests (requires SurrealDB)

# Lint
bun run format              # Check formatting
bun run format --unsafe     # Auto-fix issues
```

## Pull Request Process

1. **Fork** the repository and create a feature branch
2. **Make your changes** following the existing code style
3. **Run the linter** before submitting: `bun run format`
4. **Run tests** to ensure nothing breaks: `bun test`
5. **Write clear commit messages** describing what and why
6. **Open a PR** with a description of the changes

## Code Style

- TypeScript with strict mode
- Biome for linting and formatting
- Use curly quotes (" " ' ') in documentation prose
- Write "**smig**" (bold, lowercase) in Markdown

## What We're Looking For

- Bug fixes with tests
- Documentation improvements
- New field types or generators
- Performance improvements
- Better error messages

## Code of Conduct

Please read and follow our [Code of Conduct](https://github.com/kathysledge/smig/blob/main/CODE_OF_CONDUCT.md).

## Questions?

Open a discussion on GitHub or reach out to chris@chwd.ca.
