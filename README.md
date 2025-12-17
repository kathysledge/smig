<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://github.com/kathysledge/smig/raw/main/media/smig-logo-dark.svg">
  <img alt="smig 'S' logo" src="https://github.com/kathysledge/smig/raw/main/media/smig-logo-light.svg">
</picture>

### SurrealDB schema management with automatic migrations

[![npm version 1.0.0-alpha.1](https://badge.fury.io/js/smig.svg?version=1.0.0-alpha.1)](https://badge.fury.io/js/smig)
[![License: ISC](https://img.shields.io/badge/License-ISC-violet.svg)](https://opensource.org/license/isc-license-txt)

> [!NOTE]
> This is the README for the current `1.x` version of **smig** with SurrealDB 3 compatibility. For SurrealDB 2 compatibility, you need the `0.x` version ([view README](https://github.com/kathysledge/smig/raw/v0.x/README.md))

---

**smig** is the first library to provide **automatic migration generation** for SurrealDB. Stop writing migration scripts by hand: define your schema once, and let **smig** handle the rest.

Inspired by [Alembic](https://alembic.sqlalchemy.org/en/latest/) (Python) and mature migration tools from established ecosystems, **smig** brings production-grade schema management to SurrealDB.



---

## Why **smig**?

**The problem:** Database migrations are error-prone and time-consuming. You spend hours writing `DEFINE` and `REMOVE` statements by hand, tracking what's changed, and hoping you didn't miss anything. Schema drift between environments causes production incidents.

**The solution:** Define your desired schema state once using a type-safe API. **smig** automatically:
- Compares your schema with the current database state
- Generates precise forward and backward migrations
- Tracks migration history with checksums for integrity
- Recovers gracefully from partial failures

### Key features

- 🚀 **Automatic migration generation** - No more writing SurrealQL diffs by hand
- 🔄 **Bidirectional migrations** - Automatic rollback script generation
- 🛡️ **Type-safe schema definition** - Full TypeScript types and intelligent autocomplete
- 🎯 **Schema introspection** - Compares current database state with desired schema
- 📊 **Advanced field types** - Support for all SurrealDB data types and constraints
- 🔗 **Relation management** - First-class support for graph relations
- ⚡ **Event automation** - Define database events for business logic automation
- 🌍 **Multi-environment support** - Different configurations for dev/staging/prod
- 🔧 **CLI integration** - Powerful command-line tools for development workflows
- 📈 **Migration tracking** - Built-in migration history with checksums
- 🔐 **Authentication scopes** - Define custom auth with SIGNUP/SIGNIN logic
- 🔍 **Full-text search** - Analyzer configuration for advanced search
- ⚙️ **Custom functions** - Reusable database functions with type safety
- 🎨 **Mermaid ER diagrams** - Auto-generate visual diagrams from your schema

---

## Installation

```sh
bun install -D smig@next
```

## Quick start

### 1. Initialize your schema

```bash
bun smig init
```

This creates a `schema.js` file with a starter schema:

```javascript
import {
  string,
  datetime,
  bool,
  record,
  index,
  defineSchema,
  composeSchema,
  cf // Common fields
} from 'smig';

const userSchema = defineSchema({
  table: 'user',
  schemafull: true,
  fields: {
    name: string(),
    email: string(),
    isActive: bool().default(true),
    createdAt: cf.timestamp(),
  },
  indexes: {
    emailIndex: index(['email']).unique(),
  },
});

export default composeSchema({
  models: { user: userSchema }
});
```

### 2. Generate your first migration

```bash
bun smig generate
```

**smig** analyzes your schema and generates the precise SurrealQL diff:

```sql
-- Migration diff for 2025-01-15T10:30:00.000Z

DEFINE TABLE user SCHEMAFULL;
DEFINE FIELD name ON TABLE user TYPE string;
DEFINE FIELD email ON TABLE user TYPE string;
DEFINE FIELD isActive ON TABLE user TYPE bool DEFAULT true;
DEFINE FIELD createdAt ON TABLE user TYPE datetime VALUE time::now();
DEFINE INDEX emailIndex ON TABLE user COLUMNS email UNIQUE;
```

### 3. Apply the migration

```bash
bun smig migrate
```

Your database is now in sync with your schema! 🎉

**What just happened?**

1. **smig** connected to your database and read its current schema
2. Compared it with your `schema.js` definition
3. Generated and applied only the necessary changes
4. Recorded the migration in `_migrations` table with checksums for integrity

## **smig** vs. manual migrations

| | **Manual SQL Migrations** | **smig** |
|---|---|---|
| **Migration authoring** | Write every `DEFINE`/`REMOVE` by hand | Automatic generation from schema |
| **Schema drift detection** | Manual inspection | Automatic comparison |
| **Rollback scripts** | Write separately (often forgotten) | Auto-generated for every migration |
| **Type safety** | None | TypeScript types & autocomplete |
| **Multi-environment** | Copy-paste with find-replace | Built-in environment support |
| **Recovery from failures** | Manual cleanup required | Automatic smart recovery |
| **Migration integrity** | Hope for the best | Checksum verification |
| **Time to productivity** | Hours per migration | Seconds per migration |

## Configuration

### Environment variables

**smig** supports configuration through environment variables:

```bash
# .env
SMIG_URL=ws://localhost:8000
SMIG_USERNAME=root
SMIG_PASSWORD=root
SMIG_NAMESPACE=citadel
SMIG_DATABASE=main
SMIG_SCHEMA=./schema.js
```

### Configuration file

For more advanced setups, create a `smig.config.js` file:

```javascript
export default {
  // Default configuration
  url: process.env.SMIG_URL || 'ws://localhost:8000',
  username: 'root',
  password: 'root',
  namespace: 'citadel',
  database: 'main',
  schema: './schema.js',

  // Environment-specific overrides
  environments: {
    development: {
      database: 'dev',
      url: 'ws://localhost:8001'
    },
    staging: {
      database: 'staging',
      url: process.env.STAGING_DB_URL,
      username: process.env.STAGING_DB_USER,
      password: process.env.STAGING_DB_PASS,
    },
    production: {
      database: 'prod',
      url: process.env.PROD_DB_URL,
      username: process.env.PROD_DB_USER,
      password: process.env.PROD_DB_PASS,
      namespace: 'production'
    }
  }
};
```

### Using environments

```bash
# Use specific environment
bun smig migrate --env production

# View current configuration
bun smig config

# View configuration for specific environment
bun smig config --env staging
```

### Configuration precedence

1. **CLI arguments** (highest priority)
2. **smig.config.js** environment-specific settings
3. **Environment variables** (.env file)
4. **Default values** (lowest priority)

## Schema definition

### Basic field types

```javascript
import {
  string, int, float, bool, datetime,
  uuid, duration, decimal, object, geometry,
  array, record, option
} from 'smig';

const schema = defineSchema({
  table: 'example',
  schemafull: true,
  fields: {
    // Basic types
    name: string(),
    age: int(),
    height: float(),
    isActive: bool().default(true),
    createdAt: datetime().value('time::now()'),

    // Advanced types
    id_uuid: uuid().default('rand::uuid::v7()'),
    tags: array('string').default([]),
    metadata: object(),
    location: geometry(),

    // Nested fields (use quotation marks to define them)
    'emails.address': string(),
    'emails.primary': bool(),

    // Optional fields (can be null/NONE)
    bio: option('string'),
    avatar: option('string'),

    // References to other tables
    author: record('user'),
    categories: array('record<category>'),
  }
});
```

### Field validation & constraints

Build robust data validation with composable assertions. Multiple `.assert()` calls are automatically combined with AND operators, allowing you to build complex validation logic from simple, reusable conditions.

```javascript
fields: {
  email: string()
    .assert('$value ~ /^[^@]+@[^@]+\\.[^@]+$/'), // Regex validation

  age: int()
    .assert('$value >= 0')
    .assert('$value <= 150'), // Multiple asserts are combined with AND

  username: string()
    .assert('string::len($value) >= 3')
    .assert('string::len($value) <= 20'), // Composable validation logic

  price: decimal()
    .assert('$value > 0'), // Must be positive

  status: string()
    .assert('$value INSIDE ["active", "inactive", "pending"]'), // Enum-like
}
```

### Common Field Patterns

**smig** provides common field patterns through the `cf` (common fields) helper:

```javascript
import { cf } from 'smig';

fields: {
  // Timestamp that defaults to current time
  createdAt: cf.timestamp(),

  // Empty timestamp (no default)
  updatedAt: cf.emptyTimestamp(),

  // Foreign key reference
  owner: cf.owner('user'), // References user table
  manager: cf.owner('employee'), // References employee table

  // Optional metadata object
  metadata: cf.metadata(),

  // Optional string array for tags
  tags: cf.tags(),
}
```

## Indexes

### Basic indexes

```javascript
import { index, ci } from 'smig';

indexes: {
  // Simple index
  nameIndex: index(['name']),

  // Unique constraint
  emailIndex: index(['email']).unique(),

  // Composite index
  userPostIndex: index(['userId', 'createdAt']),

  // Search index (full-text search)
  contentSearch: index(['title', 'content']).search(),
}
```

### Common Index Patterns

```javascript
import { ci } from 'smig';

indexes: {
  // Common patterns using ci (common indexes)
  createdAtIndex: ci.createdAt('post'),
  updatedAtIndex: ci.updatedAt('post'),

  // Content search with analyzer
  contentSearch: ci.contentSearch('post'),
}
```

## Relations

Relations in SurrealDB represent graph edges between tables. **smig** makes it easy to define and manage these relationships:

```javascript
import { defineRelation } from 'smig';

// Simple relation
const followRelation = defineRelation({
  name: 'follow',
  from: 'user',
  to: 'user', // Self-referencing
  fields: {
    createdAt: cf.timestamp(),
    notificationsEnabled: bool().default(true),
  }
});

// Relation with additional data
const purchaseRelation = defineRelation({
  name: 'purchase',
  from: 'user',
  to: 'product',
  fields: {
    quantity: int().default(1),
    price: decimal(),
    purchasedAt: cf.timestamp(),
    deliveryAddress: string(),
  }
});

// Include in your schema
export default composeSchema({
  models: { user: userSchema, product: productSchema },
  relations: {
    follow: followRelation,
    purchase: purchaseRelation
  }
});
```

## Events

Events in SurrealDB allow you to define automated business logic that executes when data changes. **smig** provides a fluent API for defining events:

### Basic events

```javascript
import { event, ce } from 'smig';

events: {
  // Update counter when post is created
  incrementPostCount: event('post_count_increment')
    .onCreate()
    .thenDo('UPDATE $after.author SET postCount += 1'),

  // Track when user logs in
  trackLogin: event('user_login_tracker')
    .onUpdate()
    .when('$before.lastLoginAt != $after.lastLoginAt')
    .thenDo('UPDATE $after.id SET loginCount += 1'),

  // Audit trail for sensitive changes
  auditProfileUpdate: event('profile_audit')
    .onUpdate()
    .when('$before.email != $after.email')
    .thenDo(`
      CREATE audit_log SET
        table = "user",
        recordId = $after.id,
        action = "email_change",
        oldValue = $before.email,
        newValue = $after.email,
        timestamp = time::now()
    `),
}
```

### Event triggers

```javascript
events: {
  // Trigger on record creation
  onCreate: event('my_event').onCreate(),

  // Trigger on record update
  onUpdate: event('my_event').onUpdate(),

  // Trigger on record deletion
  onDelete: event('my_event').onDelete(),

  // Conditional triggers
  conditionalUpdate: event('conditional')
    .onUpdate()
    .when('$before.status != $after.status'),
}
```

### Common Event Patterns

```javascript
import { ce } from 'smig';

events: {
  // Auto-update timestamp on record changes
  updateTimestamp: ce.updateTimestamp('user', 'updatedAt'),

  // You can also define custom events for complex business logic
  complexBusinessLogic: event('complex_logic')
    .onCreate()
    .thenDo(`
      UPDATE $after.id SET
        calculatedField = $after.value1 * $after.value2,
        category = CASE
          WHEN $after.score > 80 THEN "premium"
          WHEN $after.score > 50 THEN "standard"
          ELSE "basic"
        END
    `),
}
```

**Multiple statements**: Events can contain multiple SurrealQL statements when wrapped in curly braces `{ ... }`. The statements should be separated by semicolons. **smig** automatically wraps multi-statement events in a block:

```javascript
events: {
  multiAction: event('multi_action')
    .onCreate()
    .thenDo(`{
      UPDATE $after.author SET postCount += 1;
      CREATE notification SET recipient = $after.author, message = "Post created";
    }`),
}
```

## Permissions

Implement fine-grained access control with SurrealDB's flexible permissions system. Define access rules at both table and field levels using SurrealQL conditions.

### Field-level permissions

```javascript
fields: {
  // Public field - anyone can read
  name: string()
    .permissions('FOR select WHERE true FOR create, update, delete WHERE $auth.id != NONE'),

  // Private field - only owner can access
  email: string()
    .permissions('FOR select, update WHERE $auth.id = $parent.id'),

  // Admin-only field
  role: string()
    .permissions('FOR select WHERE true FOR create, update, delete WHERE $auth.role = "admin"'),

  // Read-only after creation
  createdBy: record('user')
    .readonly()
    .permissions('FOR select WHERE true'),
}
```

### Common permission patterns

```javascript
// Public read, authenticated write
.permissions('FOR select WHERE true FOR create, update, delete WHERE $auth.id != NONE')

// Owner-only access
.permissions('FOR select, update, delete WHERE $auth.id = $parent.id')

// Admin-only
.permissions('FOR select, update, delete WHERE $auth.role = "admin"')

// Read-only for everyone
.permissions('FOR select WHERE true')

// Full access (default)
.permissions('FULL')
```

**Note:** By default, all fields have `FULL` permissions. You only need to specify permissions when you want to restrict access.

## Advanced schema patterns

### Polymorphic relations

```javascript
// Content that can be liked by users
const likeRelation = defineRelation({
  name: 'like',
  from: 'user',
  to: 'content', // Base table for posts, comments, etc.
  fields: {
    contentType: string(), // 'post', 'comment', etc.
    createdAt: cf.timestamp(),
  }
});
```

### Hierarchical data

```javascript
const categorySchema = defineSchema({
  table: 'category',
  schemafull: true,
  fields: {
    name: string(),
    parent: option('record<category>'), // Self-referencing for hierarchy
    level: int().default(0),
    path: string(), // e.g., "/electronics/computers/laptops"
    createdAt: cf.timestamp(),
  },
  indexes: {
    parentIndex: index(['parent']),
    pathIndex: index(['path']).unique(),
  }
});
```

### Audit trail pattern

```javascript
const auditLogSchema = defineSchema({
  table: 'audit_log',
  schemafull: true,
  fields: {
    table: string(),
    recordId: string(),
    action: string(), // 'create', 'update', 'delete'
    userId: option('record<user>'),
    changes: object(), // JSON diff of changes
    timestamp: cf.timestamp(),
  },
  indexes: {
    tableRecordIndex: index(['table', 'recordId']),
    userActionIndex: index(['userId', 'action']),
    timestampIndex: index(['timestamp']),
  }
});
```

## CLI commands

### Core commands

```bash
# Initialize new schema file
bun smig init [--output ./my-schema.js]

# Generate migration from schema changes
bun smig generate [--env production]

# Apply pending migrations
bun smig migrate [--env staging] [--message "Add user profiles"]

# Check migration status
bun smig status [--env production]

# Rollback last migration
bun smig rollback [--env staging]

# Rollback specific migration by ID
bun smig rollback --id migration_id [--env staging]

# Rollback all migrations up to and including a specific migration
bun smig rollback --to migration_id [--env staging]

# View current configuration
bun smig config [--env production] [--show-secrets]

# Test database connection
bun smig test [--env development]

# Generate Mermaid ER diagram
bun smig mermaid [--output ./my-diagram.mermaid]
```

### Global options

```sh
# Use specific environment
--env <environment>

# Enable debug logging
--debug

# Override database URL
--url ws://localhost:8001

# Override schema file
--schema ./custom-schema.js
```

## Diagram generation

**smig** includes a powerful visualization feature that generates Mermaid ER diagrams from your schema. This helps you understand your database structure at a glance and share schema designs with your team.

### Generate a diagram

```bash
# Interactive mode - prompts for detail level
bun smig mermaid

# Specify output file
bun smig mermaid --output docs/schema.mermaid

# With custom schema file
bun smig mermaid --schema ./custom-schema.js
```

### Diagram detail levels

When you run `smig mermaid`, you'll be prompted to choose between two detail levels:

**Minimal (executive summary)**
- Entity names and relationships
- Field names with basic types
- Key constraints (unique, primary key)
- Validation summaries (e.g., "3-20 chars", "0-150")

**Detailed (comprehensive view)**
- Everything from minimal mode, plus:
- Default values
- Computed field indicators
- Value expressions (e.g., `time::now()`)
- Readonly field markers
- Field comments and documentation

### Viewing diagrams

After generating your diagram, you can visualize it using:

- **[Mermaid Viewer](https://newmo-oss.github.io/mermaid-viewer/)** - Paste your diagram and see it rendered instantly
- **GitHub/GitLab** - Both platforms render Mermaid diagrams natively in markdown files
- **VS Code** - Use the Mermaid extension for inline previews
- **Documentation sites** - Most modern doc platforms support Mermaid (Docusaurus, VuePress, etc.)

### Example output

```bash
$ bun smig mermaid
✔ Select diagram detail level: › Minimal (executive summary)
✔ File 'schema-diagram.mermaid' already exists. Do you want to overwrite it? … yes
✓ Mermaid diagram generated successfully
📊 Diagram written to: schema-diagram.mermaid

You can visualize this diagram at https://newmo-oss.github.io/mermaid-viewer/
```

## Migration workflow

### Development workflow

1. **Modify your schema** in `schema.js`
2. **Generate migration**: `bun smig generate`
3. **Review the generated SurrealQL** to ensure it's correct
4. **Apply migration**: `bun smig migrate`
5. **Test your application** with the new schema
6. **Commit schema** to version control

### Production deployment

```sh
# 1. Deploy your application code
git pull origin main

# 2. Run migrations
bun smig migrate --env production

# 3. Verify migration status
bun smig status --env production
```

### Rollback strategy

```sh
# Rollback last migration if issues are found
bun smig rollback --env production

# Rollback a specific migration by ID
bun smig rollback --id _migrations:rcbtaxf976y7kg819qws --env production

# Rollback all migrations up to and including a specific point
bun smig rollback --to _migrations:abc123xyz --env production

# Check what was rolled back
bun smig status --env production
```

## Production readiness

**smig** is designed for enterprise use with production-critical features:

### Safety & reliability
- ✅ **Checksum verification** - Detects tampered migrations
- ✅ **Automatic rollback generation** - Every migration is reversible
- ✅ **Smart recovery** - Resumes failed migrations without re-applying succeeded changes
- ✅ **Schema introspection** - Compares against actual database state, not just migration history
- ✅ **Multi-environment support** - Separate configs for dev/staging/production

### Testing & quality
- ✅ **Comprehensive test suite** - Unit and integration tests included
- ✅ **Type-safe schema definitions** - Catch errors at compile time
- ✅ **Preview before apply** - Review generated SurrealQL with `smig generate`
- ✅ **Migration validation** - Syntax and semantic checks before execution

## Best practices

### Schema design

* **Use meaningful table names** - `user`, `post`, not `users`, `posts`
* **Always include timestamps** - Use `cf.timestamp()` for `createdAt`
* **Validate critical fields** - Add assertions for emails, IDs, etc.
* **Index for your queries** - Add indexes based on your query patterns
* **Use events for automation** - Automate counters, timestamps, audit trails
* **Make optional fields explicit** - Use `option()` type for nullable fields

### Migration management

* **Review generated migrations** before applying them
* **Test migrations on staging** before production
* **Backup production data** before major schema changes
* **Never edit applied migrations** - Always create new ones
* **Run migrations in your deployment pipeline** - Automate with CI/CD

### Environment management

* **Use environment-specific configs** for different deployment stages
* **Store secrets in environment variables**, not in config files
* **Use different namespaces** for complete isolation
* **Test configuration** with `smig config --env <env>`
* **Use `--debug` flag** for troubleshooting production issues

## Troubleshooting

### Common issues

**Migration fails with "table already exists":**
```sh
# Check current database schema
bun smig status

# Reset if database is out of sync
# (⚠️ This will drop all data!)
```

**Schema file not found:**
```sh
# Check file path
bun smig config

# Initialize new schema
bun smig init --output ./path/to/schema.js
```

**Connection refused:**
```bash
# Test connection
bun smig test

# Check configuration
bun smig config --show-secrets
```

**Environment not found:**
```bash
# List available environments
bun smig config

# Check your smig.config.js file
```

### Debug mode

Enable detailed logging for troubleshooting:

```bash
bun smig migrate --debug
```

This creates a debug log file with detailed information about the migration process.

## Advanced features

### Custom functions

Define reusable database functions with type-safe parameters:

```javascript
import { fn } from 'smig';

const daysSince = fn('fn::days_since')
  .param('time', 'datetime')
  .returns('float')
  .body('RETURN <float> (time::now() - $time) / 60 / 60 / 24;');

// Include in schema
export default composeSchema({
  models: { /* ... */ },
  functions: { daysSince }
});
```

**Use case**: Centralize calculations, reduce network round-trips, ensure consistent logic.

### Authentication scopes

Define custom authentication with SIGNUP/SIGNIN logic:

```javascript
import { scope } from 'smig';

const accountScope = scope('account')
  .session('7d')
  .signup(`
    CREATE user SET
      email = $email,
      password = crypto::argon2::generate($password),
      dateJoined = time::now()
  `)
  .signin(`
    SELECT * FROM user
    WHERE email = $email
    AND crypto::argon2::compare(password, $password)
  `);

// Include in schema
export default composeSchema({
  models: { /* ... */ },
  scopes: { account: accountScope }
});
```

**Use case**: Database-native auth, session management, Argon2 hashing, multi-tenant support.

### Full-text search analyzers

Configure text analysis for SEARCH indexes:

```javascript
import { analyzer } from 'smig';

const searchAnalyzer = analyzer('relevanceSearch')
  .tokenizers(['camel', 'class', 'blank'])
  .filters(['ascii', 'snowball(english)']);

// Include in schema
export default composeSchema({
  models: { /* ... */ },
  analyzers: { search: searchAnalyzer }
});

// Use in index
indexes: {
  content: index(['title', 'body'])
    .search()
    .analyzer('relevanceSearch')
}
```

**Use case**: Advanced search without Elasticsearch, language-specific stemming, autocomplete.

### Union type records

Reference multiple table types polymorphically:

```javascript
import { record } from 'smig';

fields: {
  // Can reference post OR comment OR user
  context: record(['post', 'comment', 'user']),
  
  // Generic record (any table)
  subject: record(),
  
  // Traditional single table
  author: record('user')
}
```

**Use case**: Notifications, activity feeds, polymorphic associations, flexible workflows.

### Computed fields

Define fields that calculate values dynamically:

```javascript
fields: {
  'votes.positive': array(record('user')).default([]),
  'votes.negative': array(record('user')).default([]),
  
  // Automatically calculated on read
  'votes.score': int().computed(`
    array::len(votes.positive) - array::len(votes.negative)
  `)
}
```

**Use case**: Eliminate stale data, reduce storage, automatic recalculation, no background jobs.

## API reference

### Field types

| Type | Description | Example |
|------|-------------|---------|
| `string()` | Text field | `name: string()` |
| `int()` | Integer number | `age: int()` |
| `float()` | Floating point number | `price: float()` |
| `bool()` | Boolean true/false | `isActive: bool()` |
| `datetime()` | Date and time | `createdAt: datetime()` |
| `uuid()` | UUID identifier | `id: uuid()` |
| `duration()` | Time duration | `timeout: duration()` |
| `decimal()` | Precise decimal | `money: decimal()` |
| `object()` | JSON object | `metadata: object()` |
| `geometry()` | Geometric data | `location: geometry()` |
| `array(type)` | Array of type | `tags: array('string')` |
| `record(table)` | Single table reference | `author: record('user')` |
| `record([tables])` | Union type (multiple tables) | `context: record(['post', 'comment'])` |
| `record()` | Generic record (any table) | `subject: record()` |
| `option(type)` | Optional field | `bio: option('string')` |

### Field methods

| Method | Description | Example |
|--------|-------------|---------|
| `.default(value)` | Set default value | `bool().default(true)` |
| `.value(expression)` | Set SurrealQL value | `datetime().value('time::now()')` |
| `.computed(expression)` | Set computed field with `<future>` | `int().computed('array::len(items)')` |
| `.assert(condition)` | Add validation | `string().assert('$value != ""')` |
| `.required()` | Require non-null value | `string().required()` |

### Schema element builders

| Builder | Description | Example |
|---------|-------------|---------|
| `fn(name)` | Custom function | `fn('fn::calc').param('x', 'int').body('...')` |
| `scope(name)` | Authentication scope | `scope('account').session('7d').signin('...')` |
| `analyzer(name)` | Text search analyzer | `analyzer('search').tokenizers([...]).filters([...])` |
| `event(name)` | Database event/trigger | `event('update').onUpdate().thenDo('...')` |
| `index(columns)` | Database index | `index(['email']).unique()` |

### Index methods

| Method | Description | Example |
|--------|-------------|---------|
| `.unique()` | Unique constraint | `index(['email']).unique()` |
| `.search()` | Full-text search | `index(['content']).search()` |
| `.btree()` | B-tree index (default) | `index(['createdAt']).btree()` |
| `.hash()` | Hash index | `index(['userId']).hash()` |
| `.mtree()` | Multi-dimensional index | `index(['location']).mtree()` |
| `.analyzer(name)` | Set search analyzer | `index(['content']).search().analyzer('english')` |
| `.highlights()` | Enable search highlights | `index(['content']).search().highlights()` |

### Common Field Patterns (`cf`)

| Pattern | Description | Example |
|---------|-------------|---------|
| `cf.timestamp()` | Auto-set timestamp | `createdAt: cf.timestamp()` |
| `cf.emptyTimestamp()` | Empty timestamp field | `updatedAt: cf.emptyTimestamp()` |
| `cf.owner(table)` | Foreign key reference | `author: cf.owner('user')` |
| `cf.metadata()` | Optional metadata object | `metadata: cf.metadata()` |
| `cf.tags()` | Optional string array | `tags: cf.tags()` |

### Common Index Patterns (`ci`)

| Pattern | Description | Example |
|---------|-------------|---------|
| `ci.primary(table)` | Unique ID index | `primary: ci.primary('user')` |
| `ci.createdAt(table)` | Created timestamp index | `createdAt: ci.createdAt('post')` |
| `ci.updatedAt(table)` | Updated timestamp index | `updatedAt: ci.updatedAt('post')` |
| `ci.contentSearch(table)` | Full-text search index | `search: ci.contentSearch('post')` |

### Common Event Patterns (`ce`)

| Pattern | Description | Example |
|---------|-------------|---------|
| `ce.updateTimestamp(table)` | Auto-update timestamp | `update: ce.updateTimestamp('user')` |
| `ce.cascadeDelete(table, related, fk)` | Cascade delete related records | `cascade: ce.cascadeDelete('user', 'post', 'authorId')` |

## Examples

Explore production-ready schemas in the [`examples/`](https://github.com/kathysledge/smig/raw/main/examples) directory:

- **[Minimal example](https://github.com/kathysledge/smig/raw/main/examples/minimal-example.js)** - The simplest possible schema to get started
- **[Blog schema](https://github.com/kathysledge/smig/raw/main/examples/simple-blog-schema.js)** - Realistic blog with users, posts, and graph relations
- **[Social network schema](https://github.com/kathysledge/smig/raw/main/examples/social-network-schema.js)** - Complex application demonstrating events, validation, indexes, and advanced patterns
- **[Social platform schema](https://github.com/kathysledge/smig/raw/main/examples/social-platform-schema.js)** - Full-featured social platform with topics, posts, threads, voting, authentication scopes, and full-text search

Each example includes detailed documentation and demonstrates best practices. Run them with:

```bash
npx smig migrate --schema examples/simple-blog-schema.js
```

## FAQ

### Does **smig** work with SurrealDB 3?

Not yet, but we're actively working on it! SurrealDB 3 requires a new JavaScript library for connectivity, and we're currently implementing support for it. Once that's complete, we'll also add support for the new `ALTER FIELD` syntax that SurrealDB 3 introduces, which will provide even more flexibility for schema changes.

For now, **smig** works with SurrealDB 2.x using the `DEFINE OVERWRITE` method for field modifications.

### Why don't my tables need an ID field?

Great question! SurrealDB is smart about IDs - it automatically generates an optimized record identifier for every record you create. These IDs are stored as efficient binary values that are lightning-fast to query and don't bloat your database.

That said, if you want custom IDs (like UUIDs for external API compatibility), you can absolutely define your own (although you can’t use default values if the field is named `id` due to the way SurrealDB applies default values to fields named `id`):

```javascript
fields: {
  id_uuid: uuid().default('rand::uuid::v7()'),
  // ... other fields
}
```

SurrealDB will use your custom ID instead of generating one automatically.

### What happens if a migration fails halfway through?

While SurrealDB's transaction support is still evolving, **smig** implements intelligent recovery mechanisms to ensure reliability:

**The smart recovery process:**

If a migration fails partway through, **smig** compares your schema against the *current* database state, not just the migration history. This means:

1. **Run the migration again** - Simply fix the issue (typo, syntax error, etc.) and re-run `smig migrate`
2. **smig picks up where it left off** - It won't re-apply changes that already succeeded
3. **Only missing changes are applied** - The diff is calculated fresh each time based on actual database state

**Example scenario:**
```bash
# Migration fails after creating 2 of 3 tables
smig migrate  # ❌ Error on table 3

# Fix the issue in your schema
# ... edit schema.js ...

# Run again - tables 1 & 2 are skipped, only table 3 is created
smig migrate  # ✅ Success
```

**Best practices to minimize issues:**

- **Test migrations on staging first** - Always run migrations in a non-production environment
- **Review generated SurrealQL** - Use `smig generate` to preview changes before applying
- **Backup before major changes** - Take a database snapshot before running significant migrations
- **Use rollback** - If something goes wrong, `smig rollback` can undo the last migration

We also track migration checksums to detect if a migration has been tampered with, adding an extra layer of integrity protection.

### Can I customize the generated migrations before applying them?

**smig** is optimized for automatic migration generation with this workflow:

1. Define your schema in TypeScript
2. Review generated migration with `smig generate`
3. Apply directly with `smig migrate`

For custom logic (data transformations, complex business rules), use one of these approaches:

**Option 1: Use events** - Define database events in your schema that handle complex business logic automatically:

```javascript
events: {
  migrateData: event('migrate_old_format')
    .onCreate()
    .thenDo('UPDATE $after SET newField = transform($after.oldField)')
}
```

**Option 2: Run custom SurrealQL separately** - For one-time data migrations, run custom SurrealQL scripts directly on your database before or after applying schema changes.

**Option 3: Manual migrations** - For complex scenarios, you can always write raw SurrealQL and track it in your version control, then apply it manually to your database.

### How does **smig** compare to writing raw SurrealQL?

Think of **smig** as your automation partner. Instead of manually writing `DEFINE TABLE`, `DEFINE FIELD`, and `REMOVE` statements for every change, you define your desired schema once, and **smig** figures out what needs to change.

**Traditional approach:**
```sql
-- You write this every time something changes:
DEFINE FIELD email ON TABLE user TYPE string;
-- Later: "Wait, what was already defined?"
```

**With smig:**
```javascript
// You write this once:
fields: {
  email: string(),
}

// smig generates the diff automatically
// smig tracks what's been applied
// smig knows what to rollback
```

**Benefits:**

- ✅ **Type-safe** - TypeScript catches errors before they hit your database
- ✅ **Version controlled** - Your schema is code, not scattered SQL files
- ✅ **Automatic diffing** - No more "what changed?" detective work
- ✅ **Rollback support** - Automatic down migrations for every change
- ✅ **Less human error** - Machines are better at remembering field definitions than we are

### Can I use **smig** with an existing SurrealDB database?

Yes! **smig** can work with existing databases. When you first run `smig status` on an existing database, it will read your current schema through SurrealDB's information schema.

**First-time setup with existing database:**

1. **Create a schema file** that matches your current database structure
2. **Run `smig status`** - This shows what **smig** thinks is different
3. **If there are differences**, either:
   - Adjust your schema file to match the database exactly, or
   - Generate a migration to bring the database in line with your schema

**Important note:** The very first migration on an existing database should be reviewed extra carefully to ensure **smig** correctly understands your current schema. After that first sync, subsequent migrations will be smooth sailing!

## Contributing

Contributions are welcome! **smig** is open source and community-driven. Whether you're fixing bugs, adding features, improving documentation, or providing feedback, your input helps make **smig** better for everyone.

### How to contribute

1. **Fork the repository** on GitHub
2. **Clone your fork** locally: `git clone https://github.com/your-username/smig.git`
3. **Create a branch** for your changes: `git checkout -b feature/my-improvement`
4. **Make your changes** and test thoroughly
5. **Commit your changes** with clear messages: `git commit -m "Add: Description of changes"`
6. **Push to your fork**: `git push origin feature/my-improvement`
7. **Open a pull request** on GitHub with a clear description of your changes

### Development setup

```bash
# Clone the repository
git clone git@github.com:kathysledge/smig.git
cd smig

# Install dependencies
bun install

# Run tests
bun run test

# Run integration tests
bun run test:integration

# Format and lint your changes (auto-fixes issues):
bun run format        # For src/ changes
bun run format:tests  # For test changes
bun run format:examples  # For example changes
```

### Guidelines

- **Code style**: Follow the existing code style and TypeScript best practices
- **Testing**: Add tests for new features and ensure existing tests pass
- **Formatting**: Always run the appropriate format command before committing - it checks and auto-fixes linting issues
- **Documentation**: Update documentation for any API changes
- **Commit messages**: Use clear, descriptive commit messages
- **Pull requests**: Keep PRs focused on a single feature or fix

### Reporting issues

Found a bug? Have a feature request? Please open an issue on GitHub with:

- Clear description of the problem or suggestion
- Steps to reproduce (for bugs)
- Expected vs actual behavior
- Your environment (OS, Node/Bun version, SurrealDB version)

## Security

**smig** follows security best practices:

- **No hardcoded credentials** - All sensitive data via environment variables
- **Checksum verification** - Prevents unauthorized migration tampering
- **Preview before apply** - Review all changes before execution
- **Audit trail** - Complete migration history with timestamps
- **Environment isolation** - Separate configs prevent accidental production changes

For security concerns or vulnerabilities, please email chris@chwd.ca (or open a private security advisory on GitHub).

## Changelog

See [CHANGELOG.md](https://github.com/kathysledge/smig/blob/main/CHANGELOG.md) for the complete version history.

## License

ISC © [Chris Harris](https://github.com/kathysledge)

---

Built with ❤️ for the SurrealDB community.

<a href="https://www.buymeacoffee.com/kathysledge">
  <img alt="Buy me a coffee" width="420" src="https://github.com/kathysledge/smig/raw/main/media/buy-me-a-coffee-button.avif">
</a>
