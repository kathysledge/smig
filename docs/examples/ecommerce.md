# E-commerce

An online store with products, orders, and inventory management. This example shows how to build a complete e-commerce backend with automatic inventory tracking and order processing.

## What you'll learn

This example demonstrates several key **smig** concepts:

- Sequences for auto-incrementing order numbers
- Events for inventory management (stock reduction, low stock alerts)
- Table-level permissions for access control
- Category hierarchies with self-referencing records
- Decimal fields for precise money handling

## Complete schema

The e-commerce schema includes four tables (categories, products, customers, orders) and a sequence for order numbers. Events automatically manage inventory and customer statistics.

<<< @/../examples/ecommerce-example.ts

## Schema highlights

### Auto-incrementing order numbers

The `orderNumber` field uses SurrealDB's sequence feature to generate unique, incrementing order IDs:

```typescript
orderNumber: int().default('sequence::nextval("order_number")'),
```

The sequence is defined separately and starts at 10000:

```typescript
const orderNumberSequence = sequence('order_number').start(10000);
```

### Inventory events

Three events manage inventory automatically:

1. **`updateInventory`** — Reduces stock when an order is created
2. **`onComplete`** — Updates customer stats when an order is completed
3. **`restoreInventory`** — Restores stock when an order is cancelled

### Row-level permissions

The order table restricts access based on user role:

```typescript
permissions: {
  select: '$auth.id = customer OR $auth.role = "admin"',
  create: '$auth.id != NONE',
  update: '$auth.role = "admin"',
  delete: 'NONE',
}
```

## Example queries

These queries show how to work with the e-commerce schema in SurrealQL.

### Create a product

Add a new product with pricing and stock:

```surql
CREATE product SET
  sku = "WIDGET-001",
  name = "Super Widget",
  slug = "super-widget",
  description = "The best widget money can buy",
  price = 29.99d,
  comparePrice = 39.99d,
  category = category:electronics,
  images = ["/images/widget-1.jpg", "/images/widget-2.jpg"],
  stock = 100;
```

### Place an order

Create an order (triggers inventory reduction automatically):

```surql
CREATE order SET
  customer = customer:cust123,
  items = [
    { product: product:widget1, quantity: 2, price: 29.99d },
    { product: product:gadget1, quantity: 1, price: 49.99d }
  ],
  subtotal = 109.97d,
  tax = 9.90d,
  shipping = 5.99d,
  total = 125.86d,
  shippingAddress = {
    street: "123 Main St",
    city: "Springfield",
    state: "IL",
    zip: "62701",
    country: "US"
  };
```

### Get order with product details

Fetch an order with its product information:

```surql
SELECT
  *,
  items.*.product.* AS productDetails
FROM order
WHERE orderNumber = 10001;
```

### Low stock products

Find products that need restocking:

```surql
SELECT * FROM product
WHERE stock <= lowStockThreshold AND isActive = true
ORDER BY stock ASC;
```

### Top customers

Find your biggest spenders:

```surql
SELECT * FROM customer
ORDER BY totalSpent DESC
LIMIT 10;
```

### Sales by category

Aggregate revenue by product category:

```surql
SELECT
  category,
  count() AS orderCount,
  math::sum(total) AS revenue
FROM order
WHERE status = "completed"
GROUP BY category;
```

## See also

- [Sequences reference](../schema-reference/sequences.md) — Order numbers
- [Events reference](../schema-reference/events.md) — Inventory triggers
