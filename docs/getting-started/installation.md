# Installation

**smig** can be installed using any Node.js package manager.

---

## Package managers

### Bun (recommended)

```bash
bun add -D smig
```

### npm

```bash
npm install -D smig
```

### pnpm

```bash
pnpm add -D smig
```

### Yarn

```bash
yarn add -D smig
```

---

## Global installation

For system-wide CLI access:

```bash
# Bun
bun add -g smig

# npm
npm install -g smig

# pnpm
pnpm add -g smig
```

Then run commands directly:

```bash
smig init
smig diff
smig push
```

---

## Local installation (recommended)

For project-specific installation, add to your `package.json` scripts:

```json
{
  "scripts": {
    "db:init": "smig init",
    "db:diff": "smig diff",
    "db:push": "smig push",
    "db:status": "smig status",
    "db:rollback": "smig rollback"
  }
}
```

Then run with your package manager:

```bash
bun run db:diff --message "Add new table"
bun run db:push
```

---

## Requirements

### Runtime

- **Node.js 18+** or **Bun 1.0+**
- ES Modules support (smig uses ESM)

### SurrealDB

- **SurrealDB 3.0+** (v3.0.0-beta.1 or later)
- Running instance accessible via WebSocket or HTTP

### Optional

- **TypeScript 5.0+** for type checking (optional but recommended)

---

## Verify installation

```bash
# Check smig version
smig --version

# Check SurrealDB connection
smig status
```

---

## Next steps

- [Quick start](index.md) - Get running in 5 minutes
- [Your first migration](first-migration.md) - Create your first schema

