# Migration manager

Programmatic API for migration operations.

## Basic usage

Create a manager, connect, and perform operations:

```typescript
import { MigrationManager } from 'smig';

const config = {
  url: 'ws://localhost:8000',
  namespace: 'test',
  database: 'test',
  username: 'root',
  password: 'root',
};

const manager = new MigrationManager(config);

await manager.connect();

// Generate migration
const diff = await manager.generateMigration(schema, 'Add user table');

// Apply migrations
await manager.applyMigrations();

// Check status
const status = await manager.getStatus();

await manager.close();
```

## Constructor

Create a new migration manager instance:

```typescript
new MigrationManager(config: DatabaseConfig)
```

### DatabaseConfig

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `url` | `string` | Yes | SurrealDB connection URL |
| `namespace` | `string` | Yes | Database namespace |
| `database` | `string` | Yes | Database name |
| `username` | `string` | Yes | Auth username |
| `password` | `string` | Yes | Auth password |

## Methods

### connect()

Establish database connection.

```typescript
async connect(): Promise<void>
```

### close()

Close database connection.

```typescript
async close(): Promise<void>
```

### generateMigration()

Generate migration from schema differences.

```typescript
async generateMigration(
  schema: DatabaseSchema,
  message?: string
): Promise<MigrationDiff>
```

**Returns:**

```typescript
interface MigrationDiff {
  hasChanges: boolean;
  up: string;      // Forward migration SQL
  down: string;    // Rollback migration SQL
  changes: Change[];
}
```

### applyMigrations()

Apply all pending migrations.

```typescript
async applyMigrations(): Promise<ApplyResult>
```

**Returns:**

```typescript
interface ApplyResult {
  applied: number;
  migrations: Migration[];
}
```

### rollback()

Rollback the most recent migration.

```typescript
async rollback(steps?: number): Promise<RollbackResult>
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `steps` | `number` | `1` | Number of migrations to rollback |

### getStatus()

Get current migration status.

```typescript
async getStatus(): Promise<MigrationStatus>
```

**Returns:**

```typescript
interface MigrationStatus {
  applied: boolean;
  migrations: Migration[];
  pendingChanges: boolean;
}
```

### getMigrations()

Get all applied migrations.

```typescript
async getMigrations(): Promise<Migration[]>
```

**Returns:**

```typescript
interface Migration {
  id: string;
  appliedAt: Date;
  up: string;
  down: string;
  message?: string;
  checksum: string;
  downChecksum: string;
}
```

### introspectSchema()

Get current database schema.

```typescript
async introspectSchema(): Promise<DatabaseSchema>
```

## Events

The migration manager emits events during operations:

```typescript
manager.on('migration:start', (migration) => {
  console.log('Applying:', migration.message);
});

manager.on('migration:complete', (migration) => {
  console.log('Applied:', migration.id);
});

manager.on('migration:error', (error, migration) => {
  console.error('Failed:', error.message);
});
```

## Example: CI/CD integration

A complete deployment script:

```typescript
import { MigrationManager, loadConfig, loadSchema } from 'smig';

async function deploy() {
  const config = await loadConfig('./smig.config.ts');
  const schema = await loadSchema(config.schema);
  
  const manager = new MigrationManager(config);
  
  try {
    await manager.connect();
    
    // Check current status
    const status = await manager.getStatus();
    console.log(`Currently ${status.migrations.length} migrations applied`);
    
    // Generate and apply any pending changes
    const diff = await manager.generateMigration(schema, 'Deploy');
    
    if (diff.hasChanges) {
      console.log('Applying changes...');
      const result = await manager.applyMigrations();
      console.log(`Applied ${result.applied} migrations`);
    } else {
      console.log('No changes to apply');
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await manager.close();
  }
}

deploy();
```

## See also

- [CLI commands](../guides/cli-commands.md) - Command-line interface
- [Surreal client](surreal-client.md) - Low-level database client

