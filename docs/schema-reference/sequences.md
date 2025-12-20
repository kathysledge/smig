# Sequences

Define auto-increment sequences with `sequence()`.

---

## Basic usage

```javascript
import { sequence } from 'smig';

const orderNumber = sequence('order_number')
  .start(1000)
  .batch(100);
```

**Generated SurrealQL:**

```sql
DEFINE SEQUENCE order_number BATCH 100 START 1000;
```

---

## Options

| Method | Description | Default |
|--------|-------------|---------|
| `.start(n)` | Starting value | `0` |
| `.batch(n)` | Batch size for preallocation | `1` |
| `.timeout(duration)` | Batch reservation timeout | - |

---

## Batch sizing

Sequences preallocate values in batches for performance:

```javascript
// Single allocation (slower, no gaps)
sequence('invoice_id').batch(1)

// Batch allocation (faster, may have gaps on restart)
sequence('order_id').batch(100)
```

---

## Using sequences

Get the next value with `sequence::next()`:

```sql
-- In queries
CREATE order SET
  orderNumber = sequence::next('order_number'),
  createdAt = time::now();

-- In field defaults
DEFINE FIELD orderNumber ON order 
  DEFAULT sequence::next('order_number');
```

---

## Common patterns

### Order numbers

```javascript
const orderNumber = sequence('order_number')
  .start(10000)
  .batch(50)
  .comment('Sequential order numbers starting at 10000');
```

### Invoice IDs

```javascript
const invoiceId = sequence('invoice_id')
  .start(1)
  .batch(10);
```

### With field definition

```javascript
const orderSchema = defineSchema({
  table: 'order',
  fields: {
    orderNumber: int().default('sequence::next("order_number")').readonly(),
    customer: record('customer').required(),
    total: decimal(),
    createdAt: datetime().default('time::now()'),
  },
});

const orderSequence = sequence('order_number')
  .start(10000)
  .batch(100);

export default composeSchema({
  models: { order: orderSchema },
  sequences: { orderNumber: orderSequence },
});
```

---

## Complete example

```javascript
import { sequence, defineSchema, composeSchema, int, decimal, datetime, record } from 'smig';

// Sequences
const orderNumber = sequence('order_number')
  .start(10000)
  .batch(100);

const invoiceNumber = sequence('invoice_number')
  .start(1)
  .batch(50);

// Tables using sequences
const orderSchema = defineSchema({
  table: 'order',
  fields: {
    orderNumber: int()
      .default('sequence::next("order_number")')
      .readonly(),
    customer: record('customer').required(),
    total: decimal().required(),
    createdAt: datetime().default('time::now()'),
  },
});

const invoiceSchema = defineSchema({
  table: 'invoice',
  fields: {
    invoiceNumber: int()
      .default('sequence::next("invoice_number")')
      .readonly(),
    order: record('order').required(),
    amount: decimal().required(),
    issuedAt: datetime().default('time::now()'),
  },
});

export default composeSchema({
  models: {
    order: orderSchema,
    invoice: invoiceSchema,
  },
  sequences: {
    orderNumber,
    invoiceNumber,
  },
});
```

---

## See also

- [Fields](fields.md) - Using sequences in defaults
- [Tables](tables.md) - Table definitions

