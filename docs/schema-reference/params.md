# Params

Define global database parameters with `param()`.

---

## Basic usage

```javascript
import { param } from 'smig';

const appVersion = param('app_version')
  .value('"1.0.0"');

const maxPageSize = param('max_page_size')
  .value('100');
```

**Generated SurrealQL:**

```sql
DEFINE PARAM $app_version VALUE "1.0.0";
DEFINE PARAM $max_page_size VALUE 100;
```

---

## Options

| Method | Description | Required |
|--------|-------------|----------|
| `.value(expr)` | Parameter value | Yes |
| `.permissions(rule)` | Access control | No |
| `.comment(text)` | Documentation | No |

---

## Value types

### Strings

```javascript
param('environment').value('"production"')
param('api_url').value('"https://api.example.com"')
```

### Numbers

```javascript
param('max_retries').value('5')
param('timeout_seconds').value('30')
param('rate_limit').value('1000')
```

### Arrays

```javascript
param('allowed_roles').value('["admin", "moderator", "user"]')
param('feature_flags').value('["new_ui", "beta_features"]')
```

### Objects

```javascript
param('config').value(`{
  maxUploadSize: 10485760,
  allowedTypes: ["image/png", "image/jpeg"],
  compression: true
}`)
```

### Expressions

```javascript
param('start_of_day').value('time::floor(time::now(), 1d)')
param('random_seed').value('rand::uuid()')
```

---

## Permissions

Control who can access the parameter:

```javascript
param('secret_key')
  .value('"sk_live_..."')
  .permissions('$auth.role = "admin"')

param('public_config')
  .value('{ theme: "dark" }')
  .permissions('true')  // Anyone can read
```

---

## Using params

Reference parameters in queries with `$`:

```sql
-- In queries
SELECT * FROM post LIMIT $max_page_size;

-- In field definitions
DEFINE FIELD config ON settings VALUE $default_config;

-- In conditions
SELECT * FROM user WHERE role IN $allowed_roles;
```

---

## Common patterns

### Configuration

```javascript
const maxPageSize = param('max_page_size').value('50');
const defaultTimeout = param('default_timeout').value('30s');
const apiVersion = param('api_version').value('"v2"');
```

### Feature flags

```javascript
const features = param('features').value(`{
  darkMode: true,
  betaFeatures: false,
  newDashboard: true
}`);
```

### Environment-specific values

```javascript
// Set different values per environment via migrations or CLI
const environment = param('environment').value('"development"');
const apiEndpoint = param('api_endpoint').value('"http://localhost:3000"');
```

---

## Complete example

```javascript
import { param, composeSchema } from 'smig';

const appVersion = param('app_version')
  .value('"2.1.0"')
  .comment('Current application version');

const maxPageSize = param('max_page_size')
  .value('100')
  .comment('Maximum items per page for pagination');

const features = param('features')
  .value(`{
    darkMode: true,
    analytics: true,
    betaFeatures: false
  }`)
  .comment('Feature flag configuration');

const allowedOrigins = param('allowed_origins')
  .value('["https://app.example.com", "https://admin.example.com"]')
  .permissions('$auth.role = "admin"');

export default composeSchema({
  models: { /* ... */ },
  params: {
    appVersion,
    maxPageSize,
    features,
    allowedOrigins,
  },
});
```

---

## See also

- [Schema reference](index.md) - Full API overview
- [Config](config.md) - API and GraphQL configuration

