/**
 * E-commerce Example
 *
 * An online store with products, orders, and inventory management.
 * Demonstrates sequences, events for inventory, and permissions.
 */
import {
  array,
  bool,
  composeSchema,
  datetime,
  decimal,
  defineSchema,
  event,
  index,
  int,
  object,
  option,
  record,
  sequence,
  string,
} from '../dist/schema/concise-schema.js';

// Categories
const categorySchema = defineSchema({
  table: 'category',
  fields: {
    name: string().required(),
    slug: string().required(),
    description: option('string'),
    parent: option('record<category>'),
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
    // Full-text search (single column)
    nameSearch: index(['name']).search().analyzer('english'),
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
    orderNumber: int().default('sequence::nextval("order_number")'),
    customer: record('customer').required(),
    items: array('object').assert('$value != NONE'), // {product, quantity, price}
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

// Order number sequence (SurrealDB 3.x only supports START)
const orderNumberSequence = sequence('order_number').start(10000);

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
  relations: {},
});
