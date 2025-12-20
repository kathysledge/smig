# Params

Params are global configuration values stored in the database. Think of them as database-level constants or settings.

## What are params for?

Params let you:

- **Store configuration** — API keys, feature flags, version numbers
- **Share values across queries** — Constants used in multiple places
- **Change behavior without code** — Update a param, affect all queries

## Creating a param

Use the `param()` function to define a global parameter:

```typescript
import { param } from 'smig';

const appVersion = param('app_version')
  .value("'2.0.0'");
```

This generates:

```surql
DEFINE PARAM $app_version VALUE '2.0.0';
```

Access it in queries:

```surql
SELECT * FROM logs WHERE version = $app_version;
```

## Param values

### Strings

Note: String values need inner quotes:

```typescript
param('greeting').value("'Hello, World!'")
param('mode').value("'production'")
```

### Numbers

Numeric values don't need quotes:

```typescript
param('max_retries').value('3')
param('timeout_seconds').value('30')
param('pi').value('3.14159')
```

### Booleans

True/false values:

```typescript
param('feature_enabled').value('true')
param('maintenance_mode').value('false')
```

### Objects

Complex configuration as structured data:

```typescript
param('config').value(`{
  debug: false,
  maxConnections: 100,
  timeout: '30s'
}`)
```

### Arrays

Lists of values:

```typescript
param('allowed_origins').value(`[
  'https://app.example.com',
  'https://admin.example.com'
]`)
```

### Expressions

Params can be expressions, not just static values:

```typescript
// Current time when queried
param('current_year').value('time::year(time::now())')

// Computed from other params
param('full_config').value(`{
  version: $app_version,
  env: $environment
}`)
```

## Using params

### In queries

Reference params in your SQL:

```surql
SELECT * FROM user WHERE role IN $allowed_roles;
SELECT * FROM post LIMIT $default_page_size;
```

### In field defaults

Use params as default values:

```typescript
role: string().default('$default_role')
```

### In assertions

Validate against param values:

```typescript
retries: int().assert('$value <= $max_retries')
```

### In functions

Access params in function logic:

```typescript
fn('fn::is_maintenance')
  .params({})
  .returns('bool')
  .body('RETURN $maintenance_mode;')
```

## Common patterns

### Feature flags

Toggle features without code changes:

```typescript
const features = param('features').value(`{
  darkMode: true,
  betaFeatures: false,
  maxFileUploadMb: 100
}`);

// In queries
// SELECT * FROM feature WHERE $features.darkMode = true
```

### Environment config

Store environment-specific settings:

```typescript
const environment = param('environment').value("'production'");
const debugMode = param('debug_mode').value('false');
const apiUrl = param('api_url').value("'https://api.example.com'");
```

### Rate limits

Configure throttling without code changes:

```typescript
const rateLimit = param('rate_limit').value(`{
  requests: 100,
  window: '1m',
  burstMultiplier: 2
}`);
```

### Application constants

Centralize magic numbers and strings:

```typescript
const constants = param('constants').value(`{
  maxUsernameLength: 30,
  minPasswordLength: 8,
  sessionTimeout: '7d',
  supportEmail: 'support@example.com'
}`);
```

## Updating params

Params can be updated with SurrealQL:

```surql
-- Update from application code
UPDATE $maintenance_mode SET value = true;

-- Or redefine
DEFINE PARAM $maintenance_mode VALUE true;
```

This makes them useful for runtime configuration that doesn't require code deploys.

## Param comments

Document your params:

```typescript
const maxRetries = param('max_retries')
  .value('3')
  .comment('Maximum retry attempts for failed operations');
```

## Complete example

A full set of application configuration parameters:

```typescript
import { param, defineSchema, string, int, composeSchema } from 'smig';

// Application configuration
const appVersion = param('app_version')
  .value("'2.5.0'")
  .comment('Current application version');

const environment = param('environment')
  .value("'production'");

// Feature flags
const features = param('features')
  .value(`{
    darkMode: true,
    advancedSearch: true,
    betaFeatures: false
  }`)
  .comment('Feature toggle configuration');

// Rate limiting
const rateLimits = param('rate_limits')
  .value(`{
    api: { requests: 100, window: '1m' },
    auth: { requests: 5, window: '15m' }
  }`);

// Business rules
const businessRules = param('business_rules')
  .value(`{
    maxOrderItems: 50,
    minOrderValue: 10.00,
    freeShippingThreshold: 75.00
  }`);

// Use in schema
const orders = defineSchema({
  table: 'order',
  fields: {
    items: array('object')
      .assert('array::len($value) <= $business_rules.maxOrderItems'),
    total: decimal()
      .assert('$value >= $business_rules.minOrderValue'),
    // ...
  },
});

export default composeSchema({
  models: { order: orders },
  params: [appVersion, environment, features, rateLimits, businessRules],
});
```

## Related

- [Fields](/schema-reference/fields) — Use params in defaults and assertions
- [Functions](/schema-reference/functions) — Use params in function logic
- [Access](/schema-reference/access) — Use params for auth configuration
