# Access (authentication)

Access definitions control how users authenticate with your database. You can define signup flows, login logic, and session management directly in your schema.

## What is an access definition?

In SurrealDB, authentication is handled through ACCESS definitions. These specify:

- **How users sign up** — What record gets created
- **How users sign in** — How credentials are verified
- **Session duration** — How long a login lasts

With **smig**, you define these in code alongside your schema.

## Access types

SurrealDB 3 supports three authentication types:

| Type | When to use it |
|------|----------------|
| `RECORD` | User accounts stored in a table (most common) |
| `JWT` | External identity providers (OAuth, SSO) |
| `BEARER` | API keys and service accounts |

## RECORD authentication

The most common pattern — users sign up and sign in with credentials stored in your database:

```typescript
import { access } from 'smig';

const userAuth = access('user')
  .type('RECORD')
  .signup(`
    CREATE user SET
      email = $email,
      password = crypto::argon2::generate($password),
      createdAt = time::now()
  `)
  .signin(`
    SELECT * FROM user WHERE
      email = $email AND
      crypto::argon2::compare(password, $password)
  `)
  .session('7d');
```

This generates:

```sql
DEFINE ACCESS user ON DATABASE TYPE RECORD
  SIGNUP (
    CREATE user SET
      email = $email,
      password = crypto::argon2::generate($password),
      createdAt = time::now()
  )
  SIGNIN (
    SELECT * FROM user WHERE
      email = $email AND
      crypto::argon2::compare(password, $password)
  )
  DURATION FOR SESSION 7d;
```

### How it works

1. **Signup**: Client sends `{ email, password }`, SurrealDB runs your SIGNUP query
2. **Signin**: Client sends credentials, SurrealDB runs your SIGNIN query
3. **Session**: If SIGNIN returns a record, the user gets a session token

### Password hashing

Always hash passwords with Argon2:

```typescript
// In signup
password = crypto::argon2::generate($password)

// In signin
crypto::argon2::compare(password, $password)
```

Never store or compare plain text passwords.

## JWT authentication

For external identity providers (Auth0, Clerk, Firebase Auth):

```typescript
const externalAuth = access('external')
  .type('JWT')
  .algorithm('RS256')
  .key(`-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...
-----END PUBLIC KEY-----`);
```

The database verifies tokens signed by your identity provider.

### JWT with user lookup

Combine JWT with a user record:

```typescript
const oauthAuth = access('oauth')
  .type('JWT')
  .algorithm('RS256')
  .key(process.env.JWT_PUBLIC_KEY)
  .authenticate(`
    SELECT * FROM user WHERE externalId = $token.sub
  `);
```

The `$token` variable contains the decoded JWT claims.

## BEARER authentication

For API keys and service accounts:

```typescript
const apiAccess = access('api')
  .type('BEARER')
  .session('365d');
```

Clients authenticate with a bearer token instead of credentials.

## Session configuration

### Duration

How long sessions last:

```typescript
.session('7d')    // 7 days
.session('24h')   // 24 hours
.session('30m')   // 30 minutes
```

### Token vs session

You can set different durations for tokens and sessions:

```typescript
.session('7d')     // Session (stored on server)
.token('1h')       // Token (in JWT, for stateless verification)
```

## Additional authentication

Run extra checks after signin:

```typescript
const strictAuth = access('user')
  .type('RECORD')
  .signup('...')
  .signin('...')
  .authenticate(`
    SELECT * FROM $auth WHERE
      isActive = true AND
      isBanned = false AND
      emailVerified = true
  `)
  .session('7d');
```

If the AUTHENTICATE query returns nothing, login fails even if SIGNIN succeeded.

## Complete examples

### User account system

A complete signup/signin system:

```typescript
import { access } from 'smig';

const userAuth = access('account')
  .type('RECORD')
  .signup(`
    CREATE user SET
      email = $email,
      password = crypto::argon2::generate($password),
      name = $name,
      role = 'user',
      isActive = true,
      createdAt = time::now()
  `)
  .signin(`
    SELECT * FROM user WHERE
      email = $email AND
      crypto::argon2::compare(password, $password)
  `)
  .authenticate(`
    SELECT * FROM $auth WHERE isActive = true
  `)
  .session('7d');
```

### Admin access

Separate access method for administrators:

```typescript
const adminAuth = access('admin')
  .type('RECORD')
  .signin(`
    SELECT * FROM user WHERE
      email = $email AND
      crypto::argon2::compare(password, $password) AND
      role = 'admin'
  `)
  .session('1h')
  .comment('Admin access with shorter session');
```

### API key access

Machine-to-machine authentication with bearer tokens:

```typescript
const apiAuth = access('api_key')
  .type('BEARER')
  .session('365d')
  .comment('Long-lived API keys for integrations');
```

## Using access in your app

### Signup

Register new users through RECORD access:

```typescript
// JavaScript SDK
await db.signup({
  access: 'account',
  variables: {
    email: 'user@example.com',
    password: 'secretpassword',
    name: 'John Doe',
  },
});
```

### Signin

Authenticate existing users:

```typescript
await db.signin({
  access: 'account',
  variables: {
    email: 'user@example.com',
    password: 'secretpassword',
  },
});
```

### The $auth variable

After signin, queries can access `$auth` — the authenticated user's record:

```sql
-- Only return the current user's posts
SELECT * FROM post WHERE author = $auth.id;

-- In permissions
FOR select WHERE owner = $auth.id
```

## Permissions with access

Access works with table and field permissions:

```typescript
const posts = defineSchema({
  table: 'post',
  permissions: `
    FOR select WHERE isPublished = true OR author = $auth.id
    FOR create WHERE $auth.id != NONE
    FOR update WHERE author = $auth.id
    FOR delete WHERE author = $auth.id
  `,
  fields: {
    title: string().required(),
    author: record('user').default('$auth.id'),
    // ...
  },
});
```

## Rename tracking

When renaming an access definition:

```typescript
const customerAuth = access('customer')
  .was('user_auth')  // Previously named 'user_auth'
  .type('RECORD')
  // ...
```

## Related

- [Tables](/schema-reference/tables) — Set table-level permissions
- [Fields](/schema-reference/fields) — Set field-level permissions
- [Params](/schema-reference/params) — Store configuration like JWT keys
