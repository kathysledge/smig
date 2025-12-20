# Config

Configure GraphQL and API behavior with `config()`.

---

## GraphQL configuration

```javascript
import { config } from 'smig';

const graphqlConfig = config()
  .graphql()
  .tables('include', ['user', 'post', 'comment'])
  .functions('include', ['get_user_stats']);
```

**Generated SurrealQL:**

```sql
DEFINE CONFIG GRAPHQL 
  TABLES INCLUDE user, post, comment
  FUNCTIONS INCLUDE fn::get_user_stats;
```

---

## GraphQL options

### Table exposure

Control which tables are exposed:

```javascript
// Include specific tables
config().graphql().tables('include', ['user', 'post'])

// Include all tables
config().graphql().tables('auto')

// Exclude specific tables
config().graphql().tables('exclude', ['_migrations', 'internal'])

// No tables
config().graphql().tables('none')
```

### Function exposure

Control which functions are exposed:

```javascript
// Include specific functions
config().graphql().functions('include', ['get_stats', 'search'])

// Include all functions
config().graphql().functions('auto')

// No functions
config().graphql().functions('none')
```

---

## API configuration

Configure default API behavior:

```javascript
const apiConfig = config()
  .api()
  .cors(['https://app.example.com'])
  .maxRequestSize('10mb')
  .timeout('30s');
```

---

## Complete example

```javascript
import { config, composeSchema } from 'smig';

const graphqlConfig = config()
  .graphql()
  .tables('include', ['user', 'post', 'comment'])
  .functions('include', ['get_user_stats', 'search_posts']);

const apiConfig = config()
  .api()
  .cors(['https://app.example.com', 'https://admin.example.com'])
  .maxRequestSize('10mb');

export default composeSchema({
  models: { /* ... */ },
  config: {
    graphql: graphqlConfig,
    api: apiConfig,
  },
});
```

---

## See also

- [Schema reference](index.md) - Full API overview
- [Access](access.md) - Authentication configuration

