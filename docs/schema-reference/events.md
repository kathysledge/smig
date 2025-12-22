# Events

Events are triggers that run when data changes. They let you automate business logic directly in the database.

## What are events for?

Events move business logic into the database layer, ensuring it runs consistently regardless of which application or query modifies the data. Instead of handling every side effect in your application code, events let you:

- **Audit changes** — Log who changed what and when
- **Sync data** — Update related records automatically
- **Send notifications** — Trigger webhooks or create notification records
- **Validate complex rules** — Reject changes that don’t meet business requirements

## Creating an event

An event has three parts: when it triggers (create, update, delete), an optional condition, and the action to perform. Use the `event()` builder function:

```typescript
import { defineSchema, event } from 'smig';

const posts = defineSchema({
  table: 'post',
  fields: { ... },
  events: {
    onPublish: event('on_publish')
      .onUpdate()
      .when('$before.isPublished = false AND $after.isPublished = true')
      .then('UPDATE $after SET publishedAt = time::now()'),
  },
});
```

This generates:

```surql
DEFINE EVENT on_publish ON TABLE post
  WHEN $before.isPublished = false AND $after.isPublished = true
  THEN UPDATE $after SET publishedAt = time::now();
```

## Event triggers

You can trigger events on creates, updates, deletes, or any combination. Choose based on what change you need to react to.

### On create

Runs when a new record is inserted:

```typescript
onCreate: event('audit_create')
  .onCreate()
  .then('CREATE audit SET table = "user", action = "create", record = $after.id, at = time::now()'),
```

### On update

Runs when an existing record is changed:

```typescript
onUpdate: event('audit_update')
  .onUpdate()
  .then('CREATE audit SET table = "user", action = "update", record = $after.id, at = time::now()'),
```

### On delete

Runs when a record is removed:

```typescript
onDelete: event('audit_delete')
  .onDelete()
  .then('CREATE audit SET table = "user", action = "delete", record = $before.id, at = time::now()'),
```

### Multiple triggers

A single event can respond to multiple operation types:

```typescript
onChange: event('on_change')
  .on('CREATE', 'UPDATE', 'DELETE')
  .then('...'),
```

## The WHEN clause

The WHEN clause adds a condition that must be true for the event to fire. This lets you trigger on specific changes rather than all changes:

```typescript
// Only trigger when status changes to 'completed'
onComplete: event('on_complete')
  .onUpdate()
  .when('$before.status != "completed" AND $after.status = "completed"')
  .then('...'),

// Only trigger when price changes
onPriceChange: event('on_price_change')
  .onUpdate()
  .when('$before.price != $after.price')
  .then('...'),

// Only trigger for large orders
onLargeOrder: event('on_large_order')
  .onCreate()
  .when('$after.total > 1000')
  .then('...'),
```

## Available variables

SurrealDB provides special variables inside event handlers so you can access the data being changed:

| Variable | Available on | Contains |
|----------|--------------|----------|
| `$before` | UPDATE, DELETE | The record before the change |
| `$after` | CREATE, UPDATE | The record after the change |
| `$event` | All | Event name |
| `$auth` | All | Current authenticated user |

## The THEN clause

The THEN clause contains the SurrealQL to execute when the event fires. This can be a single statement or a complex block of code.

### Single statement

For simple actions, pass a single SurrealQL statement:

```typescript
.then('UPDATE $after SET updatedAt = time::now()')
```

### Multiple statements

For multiple statements, wrap them in curly braces:

```typescript
.then(`{
  UPDATE $after SET updatedAt = time::now();
  CREATE audit SET record = $after.id, action = 'update';
}`)
```

### Complex logic

You can use variables, conditionals, and loops in event handlers:

```typescript
.then(`{
  LET $old_status = $before.status;
  LET $new_status = $after.status;
  
  IF $new_status = 'completed' {
    UPDATE $after SET completedAt = time::now();
    CREATE notification SET 
      user = $after.owner,
      message = 'Your order is complete!';
  };
}`)
```

## Common patterns

These patterns cover the most common use cases for events. Copy and adapt them for your schema.

### Audit trail

Create an audit log that records every change to a table:

```typescript
const auditableTable = defineSchema({
  table: 'order',
  fields: { ... },
  events: {
    auditCreate: event('audit_create')
      .onCreate()
      .then(`CREATE audit SET 
        table = 'order',
        action = 'create',
        record = $after.id,
        data = $after,
        user = $auth.id,
        at = time::now()
      `),
    
    auditUpdate: event('audit_update')
      .onUpdate()
      .then(`CREATE audit SET 
        table = 'order',
        action = 'update',
        record = $after.id,
        before = $before,
        after = $after,
        user = $auth.id,
        at = time::now()
      `),
    
    auditDelete: event('audit_delete')
      .onDelete()
      .then(`CREATE audit SET 
        table = 'order',
        action = 'delete',
        record = $before.id,
        data = $before,
        user = $auth.id,
        at = time::now()
      `),
  },
});
```

### Timestamps

Automatically set an `updatedAt` field whenever a record changes:

```typescript
updateTimestamp: event('update_timestamp')
  .onUpdate()
  .then('UPDATE $after SET updatedAt = time::now()'),
```

### Counter cache

Maintain a denormalised count field that updates automatically:

```typescript
// On comment table
incrementCount: event('increment_count')
  .onCreate()
  .then('UPDATE $after.post SET commentCount += 1'),

decrementCount: event('decrement_count')
  .onDelete()
  .then('UPDATE $before.post SET commentCount -= 1'),
```

### Notifications

Create notification records when something happens that a user should know about:

```typescript
notifyMention: event('notify_mention')
  .onCreate()
  .when('$after.mentions != NONE AND array::len($after.mentions) > 0')
  .then(`{
    FOR $user IN $after.mentions {
      CREATE notification SET
        user = $user,
        type = 'mention',
        from = $auth.id,
        message = string::concat($auth.name, ' mentioned you'),
        link = $after.id,
        createdAt = time::now();
    };
  }`),
```

### Cascade updates

Propagate changes to related records:

```typescript
syncPrices: event('sync_prices')
  .onUpdate()
  .when('$before.price != $after.price')
  .then('UPDATE cart_item SET price = $after.price WHERE product = $after.id'),
```

### Webhook trigger

Queue changes for external processing (since events can't make HTTP calls directly):

```typescript
webhook: event('webhook')
  .on('CREATE', 'UPDATE', 'DELETE')
  .then(`CREATE webhook_queue SET
    table = 'order',
    event = $event,
    data = $after ?? $before,
    createdAt = time::now()
  `),
```

## Event comments

Add documentation to explain the event's purpose:

```typescript
onPublish: event('on_publish')
  .onUpdate()
  .when('...')
  .then('...')
  .comment('Sets publishedAt when post is first published'),
```

## Order of execution

When multiple events trigger on the same operation, they run in definition order. Structure your events accordingly:

1. Validation events first
2. Data modification events second
3. Side effect events (notifications, webhooks) last

## Limitations

Events are powerful but have constraints. Understanding these helps you design better schemas.

### Events are synchronous

Events execute within the same transaction as the triggering operation. Keep event logic fast to avoid slowing down writes.

### No external calls

SurrealDB events cannot make HTTP requests or call external services. Instead, queue the work and process it from your application:

```typescript
// In database
.then('CREATE webhook_queue SET ...')

// In your app (polling or change feed)
const queue = await db.select('webhook_queue');
for (const item of queue) {
  await fetch('https://...', { ... });
  await db.delete(item.id);
}
```

### Can cause infinite loops

Events that update records can trigger other events. Be careful not to create cycles:

```typescript
// DANGEROUS: This creates an infinite loop
updateA: event('update_a')
  .onUpdate()
  .then('UPDATE table_b SET ...')  // If table_b has event that updates table_a...
```

## Complete example

Here's an order table demonstrating multiple events working together—tracking updates, handling status changes, sending notifications, and maintaining an audit trail:

```typescript
import { defineSchema, string, int, bool, datetime, record, event } from 'smig';

const orders = defineSchema({
  table: 'order',
  fields: {
    customer: record('user').required(),
    status: string().default('pending'),
    total: decimal(),
    items: array('object'),
    createdAt: datetime().default('time::now()'),
    updatedAt: datetime(),
    completedAt: datetime(),
    cancelledAt: datetime(),
  },
  events: {
    // Track updates
    onUpdate: event('on_update')
      .onUpdate()
      .then('UPDATE $after SET updatedAt = time::now()'),
    
    // Mark completion
    onComplete: event('on_complete')
      .onUpdate()
      .when('$before.status != "completed" AND $after.status = "completed"')
      .then(`{
        UPDATE $after SET completedAt = time::now();
        CREATE notification SET
          user = $after.customer,
          message = 'Your order has been completed!',
          orderId = $after.id;
      }`),
    
    // Mark cancellation
    onCancel: event('on_cancel')
      .onUpdate()
      .when('$before.status != "cancelled" AND $after.status = "cancelled"')
      .then(`{
        UPDATE $after SET cancelledAt = time::now();
        CREATE notification SET
          user = $after.customer,
          message = 'Your order has been cancelled.',
          orderId = $after.id;
      }`),
    
    // Audit trail
    audit: event('audit')
      .on('CREATE', 'UPDATE', 'DELETE')
      .then(`CREATE order_audit SET
        order = ($after ?? $before).id,
        action = $event,
        before = $before,
        after = $after,
        at = time::now()
      `),
  },
});
```

## Related

- [Tables](/schema-reference/tables) — Where events are defined
- [Functions](/schema-reference/functions) — Reusable logic for events
