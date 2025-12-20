# API reference

Programmatic API for **smig**.

---

## Modules

| Module | Description | Link |
|--------|-------------|------|
| Concise Schema | Fluent builder API | [concise-schema](concise-schema.md) |
| Migration Manager | Migration operations | [migration-manager](migration-manager.md) |
| Surreal Client | Database connection | [surreal-client](surreal-client.md) |

---

## Quick reference

### Schema builders

```javascript
import {
  // Tables
  defineSchema,
  defineRelation,
  composeSchema,
  
  // Field types
  string, int, float, decimal, bool,
  datetime, duration, uuid,
  array, object, record, option,
  geometry, any,
  
  // Schema elements
  index, event, fn, analyzer, access,
  param, sequence, config,
  
  // Common patterns
  commonFields, commonIndexes, commonEvents,
  cf, ci, ce,  // Aliases
} from 'smig';
```

### Migration operations

```javascript
import { MigrationManager } from 'smig';

const manager = new MigrationManager(config);
await manager.connect();
await manager.generateMigration(schema, 'Message');
await manager.applyMigrations();
await manager.rollback();
await manager.getStatus();
await manager.close();
```

### Database client

```javascript
import { SurrealClient } from 'smig';

const client = new SurrealClient(config);
await client.connect();
await client.query('SELECT * FROM user');
await client.close();
```

