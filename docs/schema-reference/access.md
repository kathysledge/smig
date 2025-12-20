# Access

Define authentication methods with `access()`.

---

## Basic usage

```javascript
import { access } from 'smig';

const accountAccess = access('account')
  .record()
  .signup(`
    CREATE user SET
      email = $email,
      password = crypto::argon2::generate($password),
      createdAt = time::now()
  `)
  .signin(`
    SELECT * FROM user
    WHERE email = $email
    AND crypto::argon2::compare(password, $password)
  `)
  .session('7d');
```

**Generated SurrealQL:**

```sql
DEFINE ACCESS account ON DATABASE TYPE RECORD
  SIGNUP (
    CREATE user SET
      email = $email,
      password = crypto::argon2::generate($password),
      createdAt = time::now()
  )
  SIGNIN (
    SELECT * FROM user
    WHERE email = $email
    AND crypto::argon2::compare(password, $password)
  )
  DURATION FOR SESSION 7d;
```

---

## Access types

| Type | Description | Use case |
|------|-------------|----------|
| Record | User authentication | App users |
| JWT | Token-based auth | API clients |
| Bearer | API key auth | Service-to-service |

---

## Record access

For user signup/signin flows:

```javascript
access('account')
  .record()
  .signup('/* create user query */')
  .signin('/* verify user query */')
  .session('7d')
```

### Options

| Method | Description | Required |
|--------|-------------|----------|
| `.record()` | Set type to record | Yes |
| `.signup(query)` | User creation query | No |
| `.signin(query)` | User verification query | Yes |
| `.session(duration)` | Session length | No |
| `.token(duration)` | Token TTL | No |
| `.authenticate(expr)` | Additional auth check | No |

### Signup query

Available variables:
- `$email`, `$password`, `$username`, etc. - Client-provided fields

```javascript
.signup(`
  CREATE user SET
    email = $email,
    username = $username,
    password = crypto::argon2::generate($password),
    createdAt = time::now()
`)
```

### Signin query

Must return exactly one record to succeed:

```javascript
.signin(`
  SELECT * FROM user
  WHERE email = $email
  AND crypto::argon2::compare(password, $password)
`)
```

---

## JWT access

For external token verification:

```javascript
access('api')
  .jwt()
  .algorithm('HS256')
  .key('your-secret-key')
  .session('1h')
```

### JWT with JWKS

Verify tokens from external providers:

```javascript
access('oauth')
  .jwt()
  .jwks('https://auth.example.com/.well-known/jwks.json')
  .session('24h')
```

### JWT algorithms

| Algorithm | Type |
|-----------|------|
| `HS256`, `HS384`, `HS512` | HMAC |
| `RS256`, `RS384`, `RS512` | RSA |
| `ES256`, `ES384`, `ES512` | ECDSA |
| `PS256`, `PS384`, `PS512` | RSA-PSS |

---

## Bearer access

For API key authentication:

```javascript
access('api_key')
  .bearer()
  .forUser()  // or .forRecord()
  .session('30d')
```

---

## Duration options

```javascript
access('account')
  .record()
  .signin('/* ... */')
  .session('7d')    // Session expires after 7 days
  .token('1h')      // JWT tokens expire after 1 hour
  .grant('30d')     // Refresh tokens expire after 30 days
```

Duration formats: `1h`, `30m`, `7d`, `1w`, `30s`

---

## Authenticate clause

Additional verification on each request:

```javascript
access('account')
  .record()
  .signin('/* ... */')
  .authenticate('$auth.isActive = true')  // Check on every request
```

---

## Common patterns

### Email/password authentication

```javascript
const accountAccess = access('account')
  .record()
  .signup(`
    CREATE user SET
      email = $email,
      password = crypto::argon2::generate($password),
      role = "user",
      createdAt = time::now()
  `)
  .signin(`
    SELECT * FROM user
    WHERE email = $email
    AND crypto::argon2::compare(password, $password)
  `)
  .session('7d')
  .token('1h');
```

### Username or email signin

```javascript
const accountAccess = access('account')
  .record()
  .signin(`
    SELECT * FROM user
    WHERE (email = $identifier OR username = $identifier)
    AND crypto::argon2::compare(password, $password)
  `)
  .session('7d');
```

### OAuth/SSO integration

```javascript
const oauthAccess = access('oauth')
  .jwt()
  .jwks('https://accounts.google.com/.well-known/jwks.json')
  .authenticate(`
    LET $user = SELECT * FROM user WHERE oauthId = $token.sub;
    IF $user = NONE {
      CREATE user SET
        oauthId = $token.sub,
        email = $token.email,
        name = $token.name
    };
    RETURN $user
  `)
  .session('24h');
```

### API key access

```javascript
const apiAccess = access('api')
  .bearer()
  .forUser()
  .session('365d');
```

---

## Using access in queries

```sql
-- Signup
SIGNUP [ account ] {
  email: "user@example.com",
  password: "secure123",
  username: "johndoe"
};

-- Signin  
SIGNIN [ account ] {
  email: "user@example.com",
  password: "secure123"
};
```

In your application:

```javascript
// Using surrealdb.js
await db.signup({
  access: 'account',
  variables: {
    email: 'user@example.com',
    password: 'secure123',
  },
});

await db.signin({
  access: 'account',
  variables: {
    email: 'user@example.com',
    password: 'secure123',
  },
});
```

---

## Complete example

```javascript
import { access, composeSchema } from 'smig';

const accountAccess = access('account')
  .record()
  .signup(`
    CREATE user SET
      email = $email,
      username = $username,
      password = crypto::argon2::generate($password),
      role = "user",
      isActive = true,
      createdAt = time::now()
  `)
  .signin(`
    SELECT * FROM user
    WHERE (email = $identifier OR username = $identifier)
    AND crypto::argon2::compare(password, $password)
    AND isActive = true
  `)
  .authenticate('$auth.isActive = true')
  .session('7d')
  .token('1h');

const apiAccess = access('api')
  .bearer()
  .forUser()
  .session('365d');

export default composeSchema({
  models: { /* ... */ },
  access: {
    account: accountAccess,
    api: apiAccess,
  },
});
```

---

## See also

- [Tables](tables.md) - Table permissions
- [Best practices](../guides/best-practices.md) - Security patterns

