# Sequences

Sequences generate auto-incrementing numbers. Use them for order numbers, invoice IDs, or any place you need guaranteed unique sequential values.

## What are sequences for?

Sometimes UUIDs aren't the right choice:

- **Order numbers** — Customers expect "Order #10042", not "Order #a7b3c9d2-..."
- **Invoice IDs** — Sequential numbers for accounting
- **Serial numbers** — Manufacturing or tracking codes
- **Human-readable IDs** — Short, memorable identifiers

Sequences give you database-guaranteed unique incrementing numbers.

## Creating a sequence

Use the `sequence()` function to define an auto-incrementing sequence:

```typescript
import { sequence } from 'smig';

const orderNumber = sequence('order_number');
```

This generates:

```surql
DEFINE SEQUENCE order_number;
```

Use it in a field:

```typescript
orderNumber: int().default('sequence::next("order_number")')
```

## Sequence options

### Start value

Begin from a specific number:

```typescript
sequence('order_number').start(10000)
```

Generates:

```surql
DEFINE SEQUENCE order_number START 10000;
```

### Step

Increment by more than 1:

```typescript
sequence('ticket_number').step(2)
// 1, 3, 5, 7, ...
```

### Cycle

Wrap around when reaching a limit:

```typescript
sequence('daily_counter')
  .minValue(1)
  .maxValue(999)
  .cycle()
// 1, 2, ..., 999, 1, 2, ...
```

### Cache

Preallocate numbers for performance:

```typescript
sequence('high_volume')
  .cache(100)  // Fetch 100 at a time
```

## Using sequences

### In field defaults

Reference the sequence in a field's default value:

```typescript
import { defineSchema, int, string, sequence } from 'smig';

const orderSeq = sequence('order_seq').start(10000);

const orders = defineSchema({
  table: 'order',
  fields: {
    orderNumber: int()
      .default('sequence::next("order_seq")')
      .readonly(),
    // ...
  },
});
```

### In functions

Generate sequence values programmatically:

```typescript
const createOrder = fn('fn::create_order')
  .params({ customer: 'record<user>', items: 'array' })
  .returns('record')
  .body(`{
    LET $num = sequence::next('order_seq');
    CREATE order SET
      orderNumber = $num,
      customer = $customer,
      items = $items;
  }`);
```

### In queries

Use sequences directly in SQL:

```surql
LET $next = sequence::next('order_seq');
CREATE order SET orderNumber = $next;
```

## Sequence functions

SurrealDB provides these functions:

| Function | Description |
|----------|-------------|
| `sequence::next(name)` | Get and increment |
| `sequence::value(name)` | Get current value without incrementing |

## Common patterns

### Order numbering

Customer-facing order numbers starting from a specific value:

```typescript
const orderSeq = sequence('order_seq')
  .start(10000)
  .comment('Customer-facing order numbers');

// In table
orderNumber: int()
  .default('sequence::next("order_seq")')
  .readonly()
  .comment('Auto-generated order number')
```

### Invoice numbering with prefix

Generate formatted invoice numbers like "INV-2025-000001":

```typescript
const invoiceSeq = sequence('invoice_seq').start(1);

// In function
fn('fn::generate_invoice_number')
  .params({})
  .returns('string')
  .body(`{
    LET $num = sequence::next('invoice_seq');
    LET $year = time::year(time::now());
    RETURN string::concat('INV-', $year, '-', string::pad_start($num, 6, '0'));
  }`)
// Returns: "INV-2025-000001", "INV-2025-000002", etc.
```

### Daily reset counter

For ticket systems that reset daily:

```typescript
const dailyTicket = sequence('daily_ticket')
  .minValue(1)
  .maxValue(9999)
  .cycle();

// Reset at midnight with a scheduled job
// DEFINE SEQUENCE daily_ticket ... RESTART;
```

### Multiple sequences per table

Different ID types in one table:

```typescript
const custSeq = sequence('customer_seq').start(1000);
const vendSeq = sequence('vendor_seq').start(5000);

const accounts = defineSchema({
  table: 'account',
  fields: {
    type: string().required(),
    accountNumber: int().readonly(),
    // Computed based on type
  },
  events: {
    assignNumber: event('assign_number')
      .onCreate()
      .then(`{
        IF $after.type = 'customer' {
          UPDATE $after SET accountNumber = sequence::next('customer_seq');
        } ELSE {
          UPDATE $after SET accountNumber = sequence::next('vendor_seq');
        };
      }`),
  },
});
```

## Sequence comments

Document your sequence's purpose:

```typescript
const orderSeq = sequence('order_seq')
  .start(10000)
  .comment('Sequential order numbers starting from 10000');
```

## Considerations

### Gaps

Sequences can have gaps:
- If a transaction rolls back, the sequence number is not reclaimed
- This is normal and expected

### Performance

Sequences are fast but require database roundtrips. For extremely high volume:
- Use `cache()` to preallocate numbers
- Consider UUIDs if strict sequence isn't required

### Uniqueness

Sequences guarantee uniqueness within the sequence, but not globally. If you need globally unique numbers, use UUIDs or combine sequence with a prefix.

## Complete example

A complete setup with multiple sequences for orders and tickets:

```typescript
import { sequence, defineSchema, int, string, datetime, record, composeSchema } from 'smig';

// Define sequences
const orderSeq = sequence('order_seq')
  .start(10000)
  .comment('Customer-facing order numbers');

const invoiceSeq = sequence('invoice_seq')
  .start(1)
  .comment('Invoice sequential numbers');

const ticketSeq = sequence('ticket_seq')
  .start(1)
  .comment('Support ticket numbers');

// Use in schemas
const orders = defineSchema({
  table: 'order',
  fields: {
    orderNumber: int()
      .default('sequence::next("order_seq")')
      .readonly()
      .comment('Human-readable order number'),
    customer: record('user').required(),
    status: string().default('pending'),
    createdAt: datetime().default('time::now()'),
  },
});

const tickets = defineSchema({
  table: 'ticket',
  fields: {
    ticketNumber: int()
      .default('sequence::next("ticket_seq")')
      .readonly(),
    subject: string().required(),
    priority: string().default('normal'),
    createdAt: datetime().default('time::now()'),
  },
});

export default composeSchema({
  models: { order: orders, ticket: tickets },
  sequences: [orderSeq, invoiceSeq, ticketSeq],
});
```

## Related

- [Fields](/schema-reference/fields) — Use sequences in default values
- [Functions](/schema-reference/functions) — Generate formatted IDs
- [Events](/schema-reference/events) — Assign numbers on create
