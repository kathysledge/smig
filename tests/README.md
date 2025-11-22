# 🧪 **smig** testing strategy

This document outlines the comprehensive testing approach for **smig** (SurrealDB Migration Tool).

## Overview

The testing strategy is designed to ensure reliability, correctness, and robustness across all aspects of **smig**:

- **Unit Tests**: Test individual components in isolation
- **Integration Tests**: Test CLI commands with real databases  
- **Configuration Tests**: Test multi-environment configuration loading
- **End-to-End Tests**: Test complete migration workflows

## Test Structure

```
tests/
├── README.md                 # This file
├── setup.ts                  # Unit test setup (Vitest)
├── *.test.ts                 # Unit tests
├── integration/              # Integration tests (separate suite)
│   ├── setup.ts             # Integration test setup
│   ├── cli.test.ts          # CLI command testing
│   ├── config.test.ts       # Configuration system testing
│   └── fixtures/            # Test schemas and data
└── coverage/                # Test coverage reports
```

## Running Tests

### Unit Tests (Main Suite)
```bash
# Run all unit tests
bun run test

# Run in watch mode
bun run test --watch
```

### Integration Tests (Requires SurrealDB)
```bash
# Run integration tests
bun run test:integration

# Run in watch mode
bun run test:integration --watch
```

## Unit Tests

### Coverage Areas

#### ✅ **Schema Building** (`concise-schema.test.ts`)
- Field type creation and validation
- Schema composition and inheritance
- Index and event definitions
- Relation definitions with auto-generated `in`/`out` fields
- Common field, index, and event patterns

#### ✅ **Relation Fields** (`relation-fields.test.ts`) 
- Automatic `in`/`out` field generation
- Field ordering and inheritance
- Custom field preservation

#### ✅ **Field Defaults** (`field-defaults.test.ts`)
- Default value handling for all field types
- Complex default expressions (functions, calculations)
- Array and object defaults
- Optional field defaults

#### ✅ **Event Validation** (`event-validation-examples.test.ts`)
- Event creation patterns (onCreate, onUpdate, onDelete)
- Conditional event execution with `when()`
- Event action validation
- Multi-line event bodies

#### ✅ **Events** (`events.test.ts`)
- Event builder API
- Event timing (onCreate, onUpdate, onDelete)
- Conditional execution
- Event composition and validation
- Event generation in migrations

#### ✅ **New Features** (`new-features.test.ts`)
- Custom functions with `fn()` builder
- Authentication scopes with `scope()` builder
- Full-text search analyzers with `analyzer()` builder
- Union type records (`record(['table1', 'table2'])`)
- Generic records (`record()`)
- Computed fields with `.computed()` method
- Function/scope/analyzer introspection
- Real-world social media schema example

#### ✅ **Migration Manager** (`migration-manager.test.ts`)
- Schema change detection (tables, fields, indexes, events, functions, scopes, analyzers)
- Relation property change detection (`from`/`to` changes)
- Migration diff generation (DEFINE, REMOVE statements)
- Checksum calculation and verification (SHA-256 with algorithm prefix)
- Migration recording with messages and timestamps
- Rollback migration generation
- Error handling for no-changes scenarios
- Field property comparison and normalization

#### ✅ **SurrealClient** (`surreal-client.test.ts`)
- Database connection management
- Query execution and error handling
- SDK method wrappers (`create`, `select`, `delete`)
- Record ID parsing and validation
- Schema information retrieval
- Migration application and rollback

#### ✅ **Configuration Loader** (`config-loader.test.ts`)
- Environment variable loading (`.env` support)
- Config file loading (`smig.config.js`) with ES modules
- Multi-environment configuration support
- Configuration precedence (CLI > config file > env vars > defaults)
- Environment validation and error handling
- `process.env` variable expansion in config files

### Mocking Strategy

Unit tests use **Vitest** with comprehensive mocking:

- **External Dependencies**: `surrealdb`, `fs/promises`, `dotenv`
- **File System**: Mock file operations for config and schema loading
- **Database Connections**: Mock SurrealDB client interactions
- **Time**: Control timestamps for consistent testing

## Integration Tests

### Requirements

Integration tests require **real SurrealDB instances** and are designed to run against:

1. **Local Development**: Automatically starts/stops SurrealDB processes
2. **CI Environment**: Uses externally provided database instances

### Database Setup

The integration test setup automatically manages SurrealDB instances:

```typescript
// Two test databases on different ports
const TEST_DATABASES = {
  db1: { url: 'ws://localhost:8001', database: 'test1' },
  db2: { url: 'ws://localhost:8002', database: 'test2' }
};
```

### Coverage Areas

#### ✅ **CLI Commands** (`integration/cli.test.ts`)
- `smig config` - Configuration display and validation
- `smig generate` - Migration generation from schema files
- `smig migrate` - Migration application with tracking
- `smig status` - Migration status reporting
- `smig rollback` - Migration rollback with confirmation
- Debug logging with `--debug` flag
- Multi-environment support with `--env` flag

#### ✅ **Configuration System** (`integration/config.test.ts`)
- Multi-environment configuration loading
- `process.env` variable expansion in config files
- Configuration precedence testing
- Environment detection and validation
- Real database connectivity validation

### Test Isolation

Each integration test:
- Creates temporary config files
- Uses isolated database instances
- Cleans up files and data after execution
- Tests against real SurrealDB connections

## Configuration Testing

### Multi-Environment Support

Tests validate the complete configuration system:

```javascript
// smig.config.js example
export default {
  default: {
    url: 'ws://localhost:8000',
    username: 'root',
    password: 'root',
    namespace: 'app',
    database: 'main',
    schema: './schema.js'
  },
  development: {
    database: 'dev',
    url: process.env.DEV_DB_URL || 'ws://localhost:8001'
  },
  production: {
    database: 'prod',
    url: process.env.PROD_DB_URL,
    username: process.env.PROD_USER,
    password: process.env.PROD_PASSWORD
  }
};
```

### Environment Variables

Tests cover all supported environment variables:
- `SMIG_URL` - Database connection URL
- `SMIG_USERNAME` / `SMIG_PASSWORD` - Authentication
- `SMIG_NAMESPACE` / `SMIG_DATABASE` - Database targeting
- `SMIG_SCHEMA` - Schema file path

## Test Data and Fixtures

### Schema Fixtures

Integration tests use realistic schema fixtures that demonstrate:

```typescript
// Example: Blog platform schema
export default composeSchema({
  models: {
    user: defineSchema({
      table: 'user',
      fields: {
        name: string().required(),
        email: string().unique(),
        preferences: option('object')
      },
      indexes: {
        email: index(['email']).unique()
      }
    }),
    post: defineSchema({
      table: 'post', 
      fields: {
        title: string().required(),
        author: record('user')
      }
    })
  },
  relations: {
    like: defineRelation({
      name: 'like',
      from: 'user',
      to: 'post'
    })
  }
});
```

## Continuous Integration

### GitHub Actions Setup

```yaml
# .github/workflows/test.yml
- name: Start SurrealDB for integration tests
  run: |
    docker run -d --name surrealdb1 -p 8001:8000 surrealdb/surrealdb:latest start --user root --pass root memory
    docker run -d --name surrealdb2 -p 8002:8000 surrealdb/surrealdb:latest start --user root --pass root memory

- name: Run tests
  run: |
    bun run test
    CI=true bun run test:integration
```

### Coverage Requirements

- **Unit Tests**: ≥90% line coverage
- **Integration Tests**: All CLI commands and config scenarios
- **Critical Paths**: 100% coverage for migration logic and data integrity

## Testing Best Practices

### Unit Tests
✅ **Fast and Isolated**: No external dependencies  
✅ **Comprehensive Mocking**: Mock all I/O operations  
✅ **Edge Case Coverage**: Test error conditions and boundary cases  
✅ **Deterministic**: Consistent results across environments  

### Integration Tests  
✅ **Real Environment**: Use actual SurrealDB instances  
✅ **End-to-End Workflows**: Test complete user scenarios  
✅ **Data Cleanup**: Isolate tests with proper setup/teardown  
✅ **CI-Friendly**: Graceful handling of different environments  

### Configuration Tests
✅ **Multi-Environment**: Test all supported environments  
✅ **Precedence Rules**: Validate configuration merging  
✅ **Error Scenarios**: Test invalid configurations  
✅ **Real Connectivity**: Validate actual database connections  

## Debugging Tests

### Debug Output
```bash
# Run specific test file
bun run test tests/migration-manager.test.ts

# Run integration tests with verbose output  
bun run test:integration --reporter=verbose

# Run with debug logging (for CLI commands)
smig generate --debug
smig migrate --debug
```

### Test Isolation Issues
- Check for shared state between tests
- Verify mock cleanup in `afterEach` hooks
- Ensure database cleanup in integration tests

## Future Enhancements

### Performance Tests
- Migration performance with large schemas
- Concurrent migration handling
- Database connection pooling

### Security Tests  
- Configuration validation and sanitization
- SQL injection prevention in generated queries
- Authentication and authorization testing

### Compatibility Tests
- Multiple SurrealDB versions
- Different Node.js versions  
- Cross-platform testing (Windows, macOS, Linux)

---

This comprehensive testing strategy ensures **smig** is reliable, robust, and production-ready for managing SurrealDB schema migrations across different environments and use cases.
