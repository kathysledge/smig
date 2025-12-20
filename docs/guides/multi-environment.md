# Multi-environment workflows

Configure **smig** for development, staging, and production environments.

## Configuration files

Create separate config files for each environment:

```
project/
├── smig.config.ts          # Development (default)
├── smig.staging.config.ts  # Staging
├── smig.production.config.ts # Production
└── schema.ts               # Shared schema
```

### Development config

Local development with sensible defaults:

```typescript
// smig.config.ts
export default {
  url: 'ws://localhost:8000',
  namespace: 'dev',
  database: 'myapp',
  username: 'root',
  password: 'root',
  schema: './schema.ts',
};
```

### Staging config

A copy of production for testing:

```typescript
// smig.staging.config.ts
export default {
  url: 'wss://staging.surrealdb.example.com',
  namespace: 'staging',
  database: 'myapp',
  username: process.env.SURREAL_USER,
  password: process.env.SURREAL_PASS,
  schema: './schema.ts',
};
```

### Production config

Your live environment with environment variables:

```typescript
// smig.production.config.ts
export default {
  url: 'wss://prod.surrealdb.example.com',
  namespace: 'production',
  database: 'myapp',
  username: process.env.SURREAL_USER,
  password: process.env.SURREAL_PASS,
  schema: './schema.ts',
};
```

## Using environment-specific configs

Specify the config file when running commands:

```bash
# Development (default)
bun smig diff
bun smig migrate

# Staging
bun smig migrate --config smig.staging.config.ts

# Production
bun smig migrate --config smig.production.config.ts
```

## Environment variables

For CI/CD pipelines, use environment variables:

```bash
# Set via environment
export SMIG_URL="wss://prod.surrealdb.example.com"
export SMIG_NAMESPACE="production"
export SMIG_DATABASE="myapp"
export SMIG_USERNAME="deploy"
export SMIG_PASSWORD="$DEPLOY_PASSWORD"

# Run without config file
bun smig migrate
```

### Variable precedence

1. Command-line arguments (highest)
2. Environment variables
3. Config file
4. Defaults (lowest)

## Package.json scripts

Create shortcuts for common operations:

```typescript
{
  "scripts": {
    "db:diff": "bun smig diff",
    "db:push": "bun smig migrate",
    "db:push:staging": "bun smig migrate --config smig.staging.config.ts",
    "db:push:prod": "bun smig migrate --config smig.production.config.ts",
    "db:status": "bun smig status",
    "db:status:staging": "bun smig status --config smig.staging.config.ts",
    "db:status:prod": "bun smig status --config smig.production.config.ts"
  }
}
```

## CI/CD integration

### GitHub Actions

Automated migrations on merge to main:

```yaml
# .github/workflows/deploy.yml
name: Deploy Database

on:
  push:
    branches: [main]

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: oven-sh/setup-bun@v1
      
      - run: bun install
      
      - name: Apply migrations
        env:
          SMIG_URL: ${{ secrets.SURREAL_URL }}
          SMIG_NAMESPACE: production
          SMIG_DATABASE: myapp
          SMIG_USERNAME: ${{ secrets.SURREAL_USER }}
          SMIG_PASSWORD: ${{ secrets.SURREAL_PASS }}
        run: |
          bun smig status
          bun smig migrate --force
```

### GitLab CI

Equivalent configuration for GitLab:

```yaml
# .gitlab-ci.yml
migrate:
  stage: deploy
  script:
    - bun install
    - bun smig migrate --force
  variables:
    SMIG_URL: $SURREAL_URL
    SMIG_NAMESPACE: production
    SMIG_DATABASE: myapp
    SMIG_USERNAME: $SURREAL_USER
    SMIG_PASSWORD: $SURREAL_PASS
  only:
    - main
```

## Workflow patterns

### Development → Staging → Production

The standard workflow for schema changes:

```mermaid
flowchart LR
    Dev[Development] --> |"bun smig diff"| Schema[schema.ts]
    Schema --> |"bun smig migrate"| DevDB[(Dev DB)]
    Schema --> |"bun smig migrate --config staging"| StagingDB[(Staging DB)]
    Schema --> |"bun smig migrate --config prod"| ProdDB[(Prod DB)]
```

1. Develop and test schema changes locally
2. Push to staging for QA
3. After approval, push to production

### Feature branch workflow

Isolate schema changes per feature:

```bash
# On feature branch
bun smig diff
bun smig migrate  # To dev database

# After merge to main
bun smig migrate --config smig.staging.config.ts
bun smig migrate --config smig.production.config.ts
```

## See also

- [CLI commands](cli-commands.md)
- [Best practices](best-practices.md)

