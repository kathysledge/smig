# Installation

This guide covers installing **smig** and setting up your project.

## Prerequisites

Before installing **smig**, you need:

- **Bun 1.0+** (recommended) or **Node.js 18+**
- **SurrealDB 3.0+**

### Installing SurrealDB

If you don’t have SurrealDB:

```zsh
# macOS
brew install surrealdb/tap/surreal

# Linux (curl)
curl -sSf https://install.surrealdb.com | sh

# Windows (PowerShell)
iwr https://install.surrealdb.com -useb | iex
```

See [surrealdb.com/install](https://surrealdb.com/install) for more options.

## Installing smig

Choose your package manager:

::: code-group

```zsh [bun]
bun add -D smig
```

```zsh [npm]
npm install --save-dev smig
```

```zsh [pnpm]
pnpm add -D smig
```

```zsh [yarn]
yarn add -D smig
```

:::

We recommend Bun — it’s faster and **smig** is tested primarily with Bun.

## Project setup

### Quick setup

Run the init command:

```zsh
bun smig init
```

This creates:

- `schema.ts` — Your schema definition
- `smig.config.ts` — Database connection settings

### Manual setup

If you prefer to set things up yourself:

**1. Create `smig.config.ts`:**

```typescript
export default {
  // Where your schema is defined
  schema: './schema.ts',
  
  // Database connection
  url: 'ws://localhost:8000',
  namespace: 'test',
  database: 'myapp',
  username: 'root',
  password: 'root',
};
```

**2. Create `schema.ts`:**

```typescript
import { defineSchema, string, datetime, composeSchema } from 'smig';

const users = defineSchema({
  table: 'user',
  fields: {
    email: string().required(),
    name: string(),
    createdAt: datetime().default('time::now()'),
  },
});

export default composeSchema({
  models: { user: users },
});
```

## Verifying the installation

### Check smig is installed

Verify the installation worked:

```zsh
bun smig --version
```

### Check database connection

Start SurrealDB:

```zsh
surreal start --user root --pass root memory
```

In another terminal:

```zsh
bun smig test
```

You should see:

```
✅ Database connection successful
```

## Configuration options

### Basic config

A minimal configuration for local development:

```typescript
// smig.config.ts
export default {
  schema: './schema.ts',
  url: 'ws://localhost:8000',
  namespace: 'test',
  database: 'myapp',
  username: 'root',
  password: 'root',
};
```

### With environments

Use environment variables for secure configuration:

```typescript
export default {
  schema: './schema.ts',
  url: 'ws://localhost:8000',
  namespace: 'dev',
  database: 'myapp',
  username: 'root',
  password: 'root',
  
  environments: {
    staging: {
      url: process.env.STAGING_DB_URL,
      namespace: 'staging',
      database: 'myapp',
      username: process.env.STAGING_DB_USER,
      password: process.env.STAGING_DB_PASS,
    },
    production: {
      url: process.env.PROD_DB_URL,
      namespace: 'prod',
      database: 'myapp',
      username: process.env.PROD_DB_USER,
      password: process.env.PROD_DB_PASS,
    },
  },
};
```

Use with `--env`:

```zsh
bun smig migrate --env production
```

### Using environment variables

**smig** automatically reads `.env` files:

```zsh
# .env
SMIG_URL=ws://localhost:8000
SMIG_NAMESPACE=test
SMIG_DATABASE=myapp
SMIG_USERNAME=root
SMIG_PASSWORD=root
```

## TypeScript support

**smig** natively supports TypeScript schema files with zero configuration. No build step required — just use `.ts` extension:

```typescript
// schema.ts
import type { SurrealDBSchema } from 'smig';
import { defineSchema, string, datetime, composeSchema } from 'smig';

const users = defineSchema({
  table: 'user',
  fields: {
    email: string().required(),
    name: string(),
    createdAt: datetime().default('time::now()'),
  },
});

const schema: SurrealDBSchema = composeSchema({
  models: { user: users },
});

export default schema;
```

Update your config to point to the TypeScript file:

```typescript
// smig.config.ts
export default {
  schema: './schema.ts',
  // ...
};
```

### Supported file extensions

**smig** natively supports TypeScript with zero configuration:

| Extension | Description |
|-----------|-------------|
| `.ts` | TypeScript (recommended) |
| `.mts` | TypeScript (ES modules) |
| `.cts` | TypeScript (CommonJS) |

::: tip How it works
**smig** uses [jiti](https://github.com/unjs/jiti) to compile TypeScript on-the-fly. You don’t need `ts-node`, `tsx`, or any other runtime — it just works.
:::

## Project structure

A typical project structure:

```
myapp/
├── schema.ts           # Your schema definition
├── smig.config.ts      # Connection settings
├── package.json
└── src/
    └── ...             # Your application code
```

For larger projects:

```
myapp/
├── db/
│   ├── schema/
│   │   ├── index.ts    # Main schema (composeSchema)
│   │   ├── user.ts     # User table
│   │   ├── post.ts     # Post table
│   │   └── relations/
│   │       ├── follows.ts
│   │       └── likes.ts
│   ├── functions/
│   │   └── utils.ts    # Database functions
│   └── analyzers/
│       └── search.ts   # Full-text search config
├── smig.config.ts
└── src/
    └── ...
```

## Troubleshooting

### “Connection refused”

SurrealDB isn’t running. Start it:

```zsh
surreal start --user root --pass root memory
```

### “Invalid credentials”

Check username/password in your config matches SurrealDB’s startup flags.

### “Module not found: smig”

Make sure **smig** is in `devDependencies`:

```zsh
bun add -D smig
```

### ESM import errors

**smig** uses ES modules. Ensure your `package.json` has:

```typescript
{
  "type": "module"
}
```

## Next steps

Ready to create your first migration?

[Your first migration ›](/getting-started/first-migration)
