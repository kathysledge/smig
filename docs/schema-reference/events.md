# Events

Define database triggers for business logic automation.

---

## Basic usage

```javascript
import { event } from 'smig';

const events = {
  updateTimestamp: event('update_timestamp')
    .onUpdate()
    .when('$event = "UPDATE"')
    .thenDo('UPDATE $after.id SET updatedAt = time::now()'),
};
```

**Generated SurrealQL:**

```sql
DEFINE EVENT update_timestamp ON TABLE user 
  WHEN $event = "UPDATE" 
  THEN UPDATE $after.id SET updatedAt = time::now();
```

---

## Event triggers

| Trigger | Description | Available variables |
|---------|-------------|---------------------|
| `.onCreate()` | Fires after record creation | `$after`, `$event` |
| `.onUpdate()` | Fires after record update | `$before`, `$after`, `$event` |
| `.onDelete()` | Fires after record deletion | `$before`, `$event` |

---

## Event variables

| Variable | Description |
|----------|-------------|
| `$event` | Event type: `"CREATE"`, `"UPDATE"`, or `"DELETE"` |
| `$before` | Record state before the change (update/delete only) |
| `$after` | Record state after the change (create/update only) |

---

## When conditions

Control when the event fires:

```javascript
// Always fire on update
event('log_update')
  .onUpdate()
  .when('$event = "UPDATE"')
  .thenDo('/* ... */')

// Only when specific field changes
event('notify_status_change')
  .onUpdate()
  .when('$before.status != $after.status')
  .thenDo('/* ... */')

// Only when transitioning to published
event('on_publish')
  .onUpdate()
  .when('$before.published = false AND $after.published = true')
  .thenDo('/* ... */')
```

---

## Then actions

### Single statement

```javascript
event('update_count')
  .onCreate()
  .when('$event = "CREATE"')
  .thenDo('UPDATE $after.author SET postCount += 1')
```

### Multiple statements

Use braces for multiple statements:

```javascript
event('on_order_complete')
  .onUpdate()
  .when('$before.status != "complete" AND $after.status = "complete"')
  .thenDo(`{
    UPDATE $after.customer SET orderCount += 1;
    UPDATE $after.customer SET totalSpent += $after.total;
    CREATE notification SET 
      recipient = $after.customer,
      message = "Order complete!",
      createdAt = time::now();
  }`)
```

### With control flow

```javascript
event('conditional_action')
  .onUpdate()
  .when('$event = "UPDATE"')
  .thenDo(`{
    IF $after.priority = "high" {
      CREATE alert SET
        target = $after.id,
        message = "High priority item updated";
    };
  }`)
```

---

## Common patterns

### Update timestamp

```javascript
events: {
  updateTimestamp: event('update_timestamp')
    .onUpdate()
    .when('$event = "UPDATE"')
    .thenDo('UPDATE $after.id SET updatedAt = time::now()'),
}
```

### Cascade updates

```javascript
events: {
  updatePostCount: event('update_post_count')
    .onCreate()
    .when('$event = "CREATE"')
    .thenDo('UPDATE $after.author SET postCount += 1'),
    
  decrementPostCount: event('decrement_post_count')
    .onDelete()
    .when('$event = "DELETE"')
    .thenDo('UPDATE $before.author SET postCount -= 1'),
}
```

### Notifications

```javascript
events: {
  notifyFollowers: event('notify_followers')
    .onCreate()
    .when('$event = "CREATE"')
    .thenDo(`{
      FOR $follower IN (SELECT VALUE in FROM follows WHERE out = $after.author) {
        CREATE notification SET
          recipient = $follower,
          type = "new_post",
          post = $after.id,
          createdAt = time::now();
      };
    }`),
}
```

### Audit logging

```javascript
events: {
  auditLog: event('audit_log')
    .onUpdate()
    .when('$event = "UPDATE"')
    .thenDo(`
      CREATE audit_log SET
        table = "user",
        recordId = $after.id,
        action = "UPDATE",
        before = $before,
        after = $after,
        timestamp = time::now()
    `),
}
```

### Validation

```javascript
events: {
  preventUnpublish: event('prevent_unpublish')
    .onUpdate()
    .when('$before.status = "published" AND $after.status = "draft"')
    .thenDo('THROW "Cannot unpublish: use archive instead"'),
}
```

---

## Complete example

```javascript
const orderSchema = defineSchema({
  table: 'order',
  fields: {
    customer: record('customer').required(),
    items: array('object').required(),
    total: decimal().required(),
    status: string().default('pending'),
    createdAt: datetime().default('time::now()'),
    updatedAt: datetime().value('time::now()'),
    completedAt: datetime(),
  },
  events: {
    onComplete: event('on_complete')
      .onUpdate()
      .when('$before.status != "complete" AND $after.status = "complete"')
      .thenDo(`{
        UPDATE $after.id SET completedAt = time::now();
        UPDATE $after.customer SET 
          orderCount += 1,
          totalSpent += $after.total;
      }`),
      
    onCancel: event('on_cancel')
      .onUpdate()
      .when('$after.status = "cancelled"')
      .thenDo(`{
        FOR $item IN $after.items {
          UPDATE product SET stock += $item.quantity 
          WHERE id = $item.productId;
        };
      }`),
  },
});
```

---

## See also

- [Tables](tables.md) - Table definitions
- [Best practices](../guides/best-practices.md) - Event patterns

