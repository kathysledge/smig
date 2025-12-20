# Events

Events are triggers that run when data changes. They let you automate business logic directly in the database.

## What are events for?

Instead of handling every side effect in your application code, events let you:

- **Audit changes** — Log who changed what and when
- **Sync data** — Update related records automatically
- **Send notifications** — Trigger webhooks or create notification records
- **Validate complex rules** — Reject changes that don't meet business requirements

## Creating an event

Define an event with a trigger type, optional condition, and action:

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

### On create

Runs when a new record is created:

```typescript
onCreate: event('audit_create')
  .onCreate()
  .then('CREATE audit SET table = "user", action = "create", record = $after.id, at = time::now()'),
```

### On update

Runs when a record is modified:

```typescript
onUpdate: event('audit_update')
  .onUpdate()
  .then('CREATE audit SET table = "user", action = "update", record = $after.id, at = time::now()'),
```

### On delete

Runs when a record is deleted:

```typescript
onDelete: event('audit_delete')
  .onDelete()
  .then('CREATE audit SET table = "user", action = "delete", record = $before.id, at = time::now()'),
```

### Multiple triggers

React to multiple operations:

```typescript
onChange: event('on_change')
  .on('CREATE', 'UPDATE', 'DELETE')
  .then('...'),
```

## The WHEN clause

Events can have conditions:

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

Inside event handlers, you have access to:

| Variable | Available on | Contains |
|----------|--------------|----------|
| `$before` | UPDATE, DELETE | The record before the change |
| `$after` | CREATE, UPDATE | The record after the change |
| `$event` | All | Event name |
| `$auth` | All | Current authenticated user |

## The THEN clause

### Single statement

For simple actions, use a single statement:

```typescript
.then('UPDATE $after SET updatedAt = time::now()')
```

### Multiple statements

Use curly braces:

```typescript
.then(`{
  UPDATE $after SET updatedAt = time::now();
  CREATE audit SET record = $after.id, action = 'update';
}`)
```

### Complex logic

For multi-step actions with conditions:

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

### Audit trail

Track all changes:

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

Auto-update `updatedAt`:

```typescript
updateTimestamp: event('update_timestamp')
  .onUpdate()
  .then('UPDATE $after SET updatedAt = time::now()'),
```

### Counter cache

Keep a count in sync:

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

Alert users:

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

Sync related data:

```typescript
syncPrices: event('sync_prices')
  .onUpdate()
  .when('$before.price != $after.price')
  .then('UPDATE cart_item SET price = $after.price WHERE product = $after.id'),
```

### Webhook trigger

Create a queue record for external processing:

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

Document what the event does:

```typescript
onPublish: event('on_publish')
  .onUpdate()
  .when('...')
  .then('...')
  .comment('Sets publishedAt when post is first published'),
```

## Order of execution

Events run in the order they're defined. For predictable behavior:

1. Validation events first
2. Data modification events second
3. Side effect events (notifications, webhooks) last

## Limitations

### Events are synchronous

They run as part of the transaction. Long-running operations can slow down writes.

### No external calls

Events can't make HTTP requests directly. Create a queue record and process externally:

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

Be careful with events that trigger other events:

```typescript
// DANGEROUS: This creates an infinite loop
updateA: event('update_a')
  .onUpdate()
  .then('UPDATE table_b SET ...')  // If table_b has event that updates table_a...
```

## Complete example

An order table with comprehensive event handling for status changes:

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
