# E-commerce

An online store with products, orders, and inventory management.

## Schema

A full e-commerce schema with categories, products, customers, and orders with inventory management:

```typescript
import {
  defineSchema,
  composeSchema,
  string,
  int,
  float,
  decimal,
  bool,
  datetime,
  array,
  record,
  option,
  index,
  event,
  sequence,
} from 'smig';

// Categories
const categorySchema = defineSchema({
  table: 'category',
  fields: {
    name: string().required(),
    slug: string().required(),
    description: option('string'),
    parent: option(record('category')),
    sortOrder: int().default(0),
    isActive: bool().default(true),
  },
  indexes: {
    slug: index(['slug']).unique(),
    parent: index(['parent', 'sortOrder']),
  },
});

// Products
const productSchema = defineSchema({
  table: 'product',
  fields: {
    sku: string().required(),
    name: string().required(),
    slug: string().required(),
    description: string().required(),
    price: decimal().required().assert('$value >= 0'),
    comparePrice: option('decimal'),
    category: record('category').required(),
    images: array('string').default([]),
    stock: int().default(0).assert('$value >= 0'),
    lowStockThreshold: int().default(5),
    isActive: bool().default(true),
    isFeatured: bool().default(false),
    weight: option('float'),
    dimensions: option('object'),
    metadata: option('object'),
    createdAt: datetime().default('time::now()'),
    updatedAt: datetime().value('time::now()'),
  },
  indexes: {
    sku: index(['sku']).unique(),
    slug: index(['slug']).unique(),
    category: index(['category', 'isActive']),
    featured: index(['isFeatured', 'createdAt']),
    search: index(['name', 'description']).fulltext().analyzer('english'),
  },
  events: {
    lowStockAlert: event('low_stock_alert')
      .onUpdate()
      .when('$before.stock > $after.lowStockThreshold AND $after.stock <= $after.lowStockThreshold')
      .thenDo(`
        CREATE notification SET
          type = "low_stock",
          product = $after.id,
          message = string::concat("Low stock alert: ", $after.name),
          createdAt = time::now()
      `),
  },
});

// Customers
const customerSchema = defineSchema({
  table: 'customer',
  fields: {
    email: string().required().assert('string::is_email($value)'),
    name: string().required(),
    phone: option('string'),
    defaultAddress: option('object'),
    addresses: array('object').default([]),
    orderCount: int().default(0),
    totalSpent: decimal().default('0'),
    createdAt: datetime().default('time::now()'),
    updatedAt: datetime().value('time::now()'),
  },
  indexes: {
    email: index(['email']).unique(),
  },
});

// Orders
const orderSchema = defineSchema({
  table: 'order',
  fields: {
    orderNumber: int().default('sequence::next("order_number")').readonly(),
    customer: record('customer').required(),
    items: array('object').required(),  // {product, quantity, price}
    subtotal: decimal().required(),
    tax: decimal().default('0'),
    shipping: decimal().default('0'),
    total: decimal().required(),
    status: string().default('pending'),
    shippingAddress: object().required(),
    billingAddress: option('object'),
    notes: option('string'),
    createdAt: datetime().default('time::now()'),
    updatedAt: datetime().value('time::now()'),
    completedAt: option('datetime'),
  },
  indexes: {
    orderNumber: index(['orderNumber']).unique(),
    customer: index(['customer', 'createdAt']),
    status: index(['status', 'createdAt']),
  },
  events: {
    updateInventory: event('update_inventory')
      .onCreate()
      .when('$event = "CREATE"')
      .thenDo(`{
        FOR $item IN $after.items {
          UPDATE product SET stock -= $item.quantity 
          WHERE id = $item.product;
        };
      }`),
    
    onComplete: event('on_complete')
      .onUpdate()
      .when('$before.status != "completed" AND $after.status = "completed"')
      .thenDo(`{
        UPDATE $after.id SET completedAt = time::now();
        UPDATE $after.customer SET 
          orderCount += 1,
          totalSpent += $after.total;
      }`),
    
    restoreInventory: event('restore_inventory')
      .onUpdate()
      .when('$after.status = "cancelled" AND $before.status != "cancelled"')
      .thenDo(`{
        FOR $item IN $after.items {
          UPDATE product SET stock += $item.quantity 
          WHERE id = $item.product;
        };
      }`),
  },
  permissions: {
    select: '$auth.id = customer OR $auth.role = "admin"',
    create: '$auth.id != NONE',
    update: '$auth.role = "admin"',
    delete: 'NONE',
  },
});

// Order number sequence
const orderNumberSequence = sequence('order_number')
  .start(10000)
  .batch(100);

export default composeSchema({
  models: {
    category: categorySchema,
    product: productSchema,
    customer: customerSchema,
    order: orderSchema,
  },
  sequences: {
    orderNumber: orderNumberSequence,
  },
});
```

## Example queries

### Create a product

Add a new product with pricing and stock:

```sql
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

```sql
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

```sql
SELECT 
  *,
  items.*.product.* AS productDetails
FROM order
WHERE orderNumber = 10001;
```

### Low stock products

Find products that need restocking:

```sql
SELECT * FROM product
WHERE stock <= lowStockThreshold AND isActive = true
ORDER BY stock ASC;
```

### Top customers

Find your biggest spenders:

```sql
SELECT * FROM customer
ORDER BY totalSpent DESC
LIMIT 10;
```

### Sales by category

Aggregate revenue by product category:

```sql
SELECT 
  category,
  count() AS orderCount,
  math::sum(total) AS revenue
FROM order
WHERE status = "completed"
GROUP BY category;
```

## See also

- [Sequences reference](../schema-reference/sequences.md) - Order numbers
- [Events reference](../schema-reference/events.md) - Inventory triggers

