# Surreal client

Low-level database client for SurrealDB operations.

## Basic usage

Connect, query, and close:

```typescript
import { SurrealClient } from 'smig';

const client = new SurrealClient({
  url: 'ws://localhost:8000',
  namespace: 'test',
  database: 'test',
  username: 'root',
  password: 'root',
});

await client.connect();

const users = await client.query('SELECT * FROM user');
console.log(users);

await client.close();
```

## Constructor

Create a new client instance:

```typescript
new SurrealClient(config: DatabaseConfig)
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

### query()

Execute a SurrealQL query.

```typescript
async query<T = unknown>(
  sql: string,
  vars?: Record<string, unknown>
): Promise<T[]>
```

**Example:**

```typescript
// Simple query
const users = await client.query('SELECT * FROM user');

// With parameters
const user = await client.query(
  'SELECT * FROM user WHERE email = $email',
  { email: 'user@example.com' }
);

// Multiple statements
const result = await client.query(`
  LET $user = (SELECT * FROM user WHERE id = $id);
  SELECT * FROM post WHERE author = $user.id;
`, { id: 'user:1' });
```

### execute()

Execute multiple queries in a transaction.

```typescript
async execute(queries: string[]): Promise<void>
```

**Example:**

```typescript
await client.execute([
  'DEFINE TABLE user SCHEMAFULL;',
  'DEFINE FIELD email ON user TYPE string;',
  'DEFINE INDEX email ON user FIELDS email UNIQUE;',
]);
```

### info()

Get database information.

```typescript
async info(): Promise<DatabaseInfo>
```

**Returns:**

```typescript
interface DatabaseInfo {
  tables: TableInfo[];
  functions: FunctionInfo[];
  analyzers: AnalyzerInfo[];
  // ...
}
```

## Connection management

### Reconnection

The client automatically reconnects on connection loss:

```typescript
const client = new SurrealClient({
  ...config,
  reconnect: true,        // Enable auto-reconnect (default: true)
  reconnectInterval: 1000, // Retry interval in ms
  maxRetries: 10,         // Max reconnection attempts
});
```

### Connection state

Check if connected before querying:

```typescript
if (client.isConnected()) {
  await client.query('SELECT * FROM user');
}
```

## Error handling

Handle connection and query errors gracefully:

```typescript
import { SurrealClient, ConnectionError, QueryError } from 'smig';

try {
  await client.query('SELECT * FROM user');
} catch (error) {
  if (error instanceof ConnectionError) {
    console.error('Connection failed:', error.message);
  } else if (error instanceof QueryError) {
    console.error('Query failed:', error.message);
    console.error('Query:', error.query);
  } else {
    throw error;
  }
}
```

## See also

- [Migration manager](migration-manager.md) - High-level migration API
- [CLI commands](../guides/cli-commands.md) - Command-line interface

