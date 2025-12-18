# Changelog for the `main` branch (SurrealDB 3 compatible)

All notable changes to **smig** will be documented in this file.

## [1.0.0-alpha.1] - 2025-12-18

### 🚀 SurrealDB 3 compatibility

This is the first release of **smig** with full SurrealDB 3 support. This is a major update that includes breaking changes from the v0.x branch.

### ✨ New features

- **SurrealDB 3 SDK**: Updated to use the new `surrealdb` v2 JavaScript SDK for connecting to SurrealDB 3 servers
- **Simplified schema definition**: The `schemafull` property has been replaced with `schemaless` - tables are now schemafull by default, so you only need to specify `schemaless: true` for flexible tables
- **Multiple event statements**: Events can now contain multiple SurrealQL statements wrapped in curly braces `{ stmt1; stmt2; }`
- **Comprehensive integration tests**: Added thorough testing for all example schemas and a comprehensive schema covering every entity type

### 💥 Breaking changes

#### Schema definition API

**`schemafull` renamed to `schemaless`**

The property has been inverted for a better developer experience - most tables are schemafull, so you no longer need to specify it:

```javascript
// v0.x (old)
const userSchema = defineSchema({
  table: 'user',
  schemafull: true,  // Had to specify this
  fields: { ... }
});

// v1.x (new) - schemafull by default
const userSchema = defineSchema({
  table: 'user',
  fields: { ... }
});

// For schemaless tables:
const flexibleSchema = defineSchema({
  table: 'logs',
  schemaless: true,  // Only specify when you want schemaless
  fields: { ... }
});
```

#### SurrealQL syntax changes

**Regex validation**

```javascript
// v0.x (old) - tilde operator
email: string().assert('$value ~ /^[^@]+@[^@]+\\.[^@]+$/')

// v1.x (new) - string::matches function
email: string().assert('string::matches($value, /^[^@]+@[^@]+\\.[^@]+$/)')

// Or use the built-in validator:
email: string().assert('string::is_email($value)')
```

**Function naming**

```javascript
// v0.x (old) - double colons
.assert('string::is::email($value)')
.assert('string::is::alphanum($value)')

// v1.x (new) - underscores
.assert('string::is_email($value)')
.assert('string::is_alphanum($value)')
```

**Computed fields**

```javascript
// v0.x (old) - <future> syntax
'votes.score': int().computed('array::len(votes.positive) - array::len(votes.negative)')
// Generated: VALUE <future> { ... }

// v1.x (new) - direct brace syntax
'votes.score': int().computed('array::len(votes.positive) - array::len(votes.negative)')
// Generated: VALUE { ... }
```

**Field permissions**

```javascript
// v0.x (old) - DELETE allowed on fields
.permissions('FOR select WHERE true FOR create, update, delete WHERE $auth.id = id')

// v1.x (new) - DELETE only allowed on tables, not fields
.permissions('FOR select WHERE true FOR create, update WHERE $auth.id = id')
```

### 🔧 Internal improvements

- **Enhanced normalization**: Improved comparison logic for schema diffs to handle SurrealDB 3's output formatting:
  - Type normalization: `none | string` ↔ `option<string>`
  - Assert parentheses normalization for complex conditions
  - Duration normalization: `1w` ↔ `7d`
  - Quote normalization in array literals
  - Function body comparison with arithmetic expression handling
- **Array element field handling**: Auto-generated `field.*` entries are now correctly ignored during comparison
- **Permissions normalization**: Handles `PERMISSIONS FULL` default and `DELETE` deprecation on fields

### 📦 Dependencies

- Updated `surrealdb` package to v2 SDK for SurrealDB 3 connectivity
- All existing dependencies remain compatible

### 🧪 Testing

- 215 unit tests passing
- 30 integration tests passing (requires SurrealDB 3.x)
- Added `example-schemas.test.ts` for testing all example schema migrations
- Added `comprehensive-schema.test.ts` for full entity coverage testing

### 🔮 Coming in v1.0.0 final

- **ALTER statement support**: SurrealDB 3 introduces `ALTER TABLE` and `ALTER FIELD` statements for more efficient schema modifications.
- **Field and table renaming**: Support for renaming fields and tables without data loss using SurrealDB 3's new rename capabilities.

---

## Upgrade guide from v0.x to v1.x

### Step 1: Update your dependencies

```bash
bun install -D smig@next
```

### Step 2: Update schema definitions

1. **Remove `schemafull: true`** - it's now the default:
   ```javascript
   // Before
   defineSchema({ table: 'user', schemafull: true, fields: { ... } })
   
   // After
   defineSchema({ table: 'user', fields: { ... } })
   ```

2. **Replace `schemafull: false` with `schemaless: true`**:
   ```javascript
   // Before
   defineSchema({ table: 'logs', schemafull: false, fields: { ... } })
   
   // After
   defineSchema({ table: 'logs', schemaless: true, fields: { ... } })
   ```

### Step 3: Update regex validations

Replace tilde operators with `string::matches()`:

```javascript
// Before
.assert('$value ~ /^[a-zA-Z0-9_]{3,20}$/')

// After
.assert('string::matches($value, /^[a-zA-Z0-9_]{3,20}$/)')
```

### Step 4: Update function names

Replace double colons with underscores in function paths:

| v0.x (old) | v1.x (new) |
|------------|------------|
| `string::is::email` | `string::is_email` |
| `string::is::alphanum` | `string::is_alphanum` |
| `string::is::numeric` | `string::is_numeric` |
| `string::is::alpha` | `string::is_alpha` |
| `string::is::ascii` | `string::is_ascii` |
| `string::is::datetime` | `string::is_datetime` |
| `string::is::domain` | `string::is_domain` |
| `string::is::ip` | `string::is_ip` |
| `string::is::url` | `string::is_url` |
| `string::is::uuid` | `string::is_uuid` |

### Step 5: Update field permissions

Remove `delete` from field-level permissions (it's only valid on tables):

```javascript
// Before
.permissions('FOR select, create, update, delete WHERE $auth.id = id')

// After
.permissions('FOR select, create, update WHERE $auth.id = id')
```

### Step 6: Test your migrations

```bash
# Generate a diff to see what changes would be made
bun smig generate

# Apply the migration
bun smig migrate
```

### Need help?

If you encounter issues during the upgrade, please:
1. Check the [FAQ](https://github.com/kathysledge/smig#faq) in the README
2. Open an [issue](https://github.com/kathysledge/smig/issues) on GitHub
