#!/usr/bin/env bun
/**
 * Debug script for UUID field default values
 *
 * This script investigates the issue where creating a record without specifying
 * an ID on a table with a `uuid` type id field and `rand::uuid::v7()` default
 * fails because SurrealDB generates a default ID type instead of a UUID.
 *
 * Run with: bun scripts/debug-uuid-default.ts
 */

import { Surreal } from 'surrealdb';

// Configuration
const DB_CONFIG = {
  url: process.env.SMIG_URL || 'ws://localhost:8000',
  username: process.env.SMIG_USERNAME || 'root',
  password: process.env.SMIG_PASSWORD || 'root',
  namespace: process.env.SMIG_NAMESPACE || 'test',
  database: `uuid_debug_${Date.now()}`,
};

console.log('🔍 UUID Default Value Debug Script');
console.log('===================================\n');
console.log('Configuration:', {
  ...DB_CONFIG,
  password: '***',
});

const db = new Surreal();

interface TestResult {
  approach: string;
  success: boolean;
  error?: string;
  recordId?: string;
  recordIdType?: string;
}

async function runTest(): Promise<void> {
  const results: TestResult[] = [];

  try {
    // Connect
    console.log('\n📡 Connecting to SurrealDB...');
    await db.connect(DB_CONFIG.url);
    await db.signin({
      username: DB_CONFIG.username,
      password: DB_CONFIG.password,
    });
    await db.use({
      namespace: DB_CONFIG.namespace,
      database: DB_CONFIG.database,
    });
    console.log('✅ Connected!\n');

    // Test different approaches to defining UUID id fields

    // Approach 1: uuid type with rand::uuid::v7() default
    console.log('📋 Test 1: UUID type with rand::uuid::v7() default');
    console.log('   DEFINE TABLE test1 SCHEMAFULL;');
    console.log('   DEFINE FIELD id ON TABLE test1 TYPE uuid DEFAULT rand::uuid::v7();');
    try {
      await db.query(`
        DEFINE TABLE test1 SCHEMAFULL;
        DEFINE FIELD id ON TABLE test1 TYPE uuid DEFAULT rand::uuid::v7();
        DEFINE FIELD name ON TABLE test1 TYPE string;
      `);

      const result1 = await db.query('CREATE test1 SET name = "Test Record 1"');
      console.log('   Result:', JSON.stringify(result1, null, 2));

      // biome-ignore lint/suspicious/noExplicitAny: Dynamic database query result
      const record = (result1 as any[])?.[0]?.[0] || (result1 as any[])?.[0];
      if (record?.id) {
        results.push({
          approach: 'uuid type + DEFAULT rand::uuid::v7()',
          success: true,
          recordId: String(record.id),
          recordIdType: typeof record.id,
        });
        console.log('   ✅ SUCCESS! Record created with ID:', record.id);
      } else {
        results.push({
          approach: 'uuid type + DEFAULT rand::uuid::v7()',
          success: false,
          error: 'No ID in result',
        });
        console.log('   ❌ FAILED: No ID in result');
      }
    } catch (error) {
      results.push({
        approach: 'uuid type + DEFAULT rand::uuid::v7()',
        success: false,
        error: String(error),
      });
      console.log('   ❌ FAILED:', error);
    }

    // Approach 2: uuid type with rand::uuid::v4() default
    console.log('\n📋 Test 2: UUID type with rand::uuid::v4() default');
    console.log('   DEFINE TABLE test2 SCHEMAFULL;');
    console.log('   DEFINE FIELD id ON TABLE test2 TYPE uuid DEFAULT rand::uuid::v4();');
    try {
      await db.query(`
        DEFINE TABLE test2 SCHEMAFULL;
        DEFINE FIELD id ON TABLE test2 TYPE uuid DEFAULT rand::uuid::v4();
        DEFINE FIELD name ON TABLE test2 TYPE string;
      `);

      const result2 = await db.query('CREATE test2 SET name = "Test Record 2"');
      console.log('   Result:', JSON.stringify(result2, null, 2));

      // biome-ignore lint/suspicious/noExplicitAny: Dynamic database query result
      const record = (result2 as any[])?.[0]?.[0] || (result2 as any[])?.[0];
      if (record?.id) {
        results.push({
          approach: 'uuid type + DEFAULT rand::uuid::v4()',
          success: true,
          recordId: String(record.id),
          recordIdType: typeof record.id,
        });
        console.log('   ✅ SUCCESS! Record created with ID:', record.id);
      } else {
        results.push({
          approach: 'uuid type + DEFAULT rand::uuid::v4()',
          success: false,
          error: 'No ID in result',
        });
        console.log('   ❌ FAILED: No ID in result');
      }
    } catch (error) {
      results.push({
        approach: 'uuid type + DEFAULT rand::uuid::v4()',
        success: false,
        error: String(error),
      });
      console.log('   ❌ FAILED:', error);
    }

    // Approach 3: uuid type with VALUE rand::uuid::v7() (computed on each write)
    console.log('\n📋 Test 3: UUID type with VALUE rand::uuid::v7()');
    console.log('   DEFINE TABLE test3 SCHEMAFULL;');
    console.log('   DEFINE FIELD id ON TABLE test3 TYPE uuid VALUE rand::uuid::v7();');
    try {
      await db.query(`
        DEFINE TABLE test3 SCHEMAFULL;
        DEFINE FIELD id ON TABLE test3 TYPE uuid VALUE rand::uuid::v7();
        DEFINE FIELD name ON TABLE test3 TYPE string;
      `);

      const result3 = await db.query('CREATE test3 SET name = "Test Record 3"');
      console.log('   Result:', JSON.stringify(result3, null, 2));

      // biome-ignore lint/suspicious/noExplicitAny: Dynamic database query result
      const record = (result3 as any[])?.[0]?.[0] || (result3 as any[])?.[0];
      if (record?.id) {
        results.push({
          approach: 'uuid type + VALUE rand::uuid::v7()',
          success: true,
          recordId: String(record.id),
          recordIdType: typeof record.id,
        });
        console.log('   ✅ SUCCESS! Record created with ID:', record.id);
      } else {
        results.push({
          approach: 'uuid type + VALUE rand::uuid::v7()',
          success: false,
          error: 'No ID in result',
        });
        console.log('   ❌ FAILED: No ID in result');
      }
    } catch (error) {
      results.push({
        approach: 'uuid type + VALUE rand::uuid::v7()',
        success: false,
        error: String(error),
      });
      console.log('   ❌ FAILED:', error);
    }

    // Approach 4: No id field defined, let SurrealDB handle it
    console.log('\n📋 Test 4: No id field defined (SurrealDB default)');
    console.log('   DEFINE TABLE test4 SCHEMAFULL;');
    try {
      await db.query(`
        DEFINE TABLE test4 SCHEMAFULL;
        DEFINE FIELD name ON TABLE test4 TYPE string;
      `);

      const result4 = await db.query('CREATE test4 SET name = "Test Record 4"');
      console.log('   Result:', JSON.stringify(result4, null, 2));

      // biome-ignore lint/suspicious/noExplicitAny: Dynamic database query result
      const record = (result4 as any[])?.[0]?.[0] || (result4 as any[])?.[0];
      if (record?.id) {
        results.push({
          approach: 'No id field (SurrealDB default)',
          success: true,
          recordId: String(record.id),
          recordIdType: typeof record.id,
        });
        console.log('   ✅ SUCCESS! Record created with ID:', record.id);
      } else {
        results.push({
          approach: 'No id field (SurrealDB default)',
          success: false,
          error: 'No ID in result',
        });
        console.log('   ❌ FAILED: No ID in result');
      }
    } catch (error) {
      results.push({
        approach: 'No id field (SurrealDB default)',
        success: false,
        error: String(error),
      });
      console.log('   ❌ FAILED:', error);
    }

    // Approach 5: Define table with TYPE NORMAL and UUID id
    console.log('\n📋 Test 5: Table with explicit TYPE NORMAL and UUID id');
    console.log('   DEFINE TABLE test5 TYPE NORMAL SCHEMAFULL;');
    console.log('   DEFINE FIELD id ON TABLE test5 TYPE uuid DEFAULT rand::uuid::v7();');
    try {
      await db.query(`
        DEFINE TABLE test5 TYPE NORMAL SCHEMAFULL;
        DEFINE FIELD id ON TABLE test5 TYPE uuid DEFAULT rand::uuid::v7();
        DEFINE FIELD name ON TABLE test5 TYPE string;
      `);

      const result5 = await db.query('CREATE test5 SET name = "Test Record 5"');
      console.log('   Result:', JSON.stringify(result5, null, 2));

      // biome-ignore lint/suspicious/noExplicitAny: Dynamic database query result
      const record = (result5 as any[])?.[0]?.[0] || (result5 as any[])?.[0];
      if (record?.id) {
        results.push({
          approach: 'TYPE NORMAL + uuid DEFAULT rand::uuid::v7()',
          success: true,
          recordId: String(record.id),
          recordIdType: typeof record.id,
        });
        console.log('   ✅ SUCCESS! Record created with ID:', record.id);
      } else {
        results.push({
          approach: 'TYPE NORMAL + uuid DEFAULT rand::uuid::v7()',
          success: false,
          error: 'No ID in result',
        });
        console.log('   ❌ FAILED: No ID in result');
      }
    } catch (error) {
      results.push({
        approach: 'TYPE NORMAL + uuid DEFAULT rand::uuid::v7()',
        success: false,
        error: String(error),
      });
      console.log('   ❌ FAILED:', error);
    }

    // Approach 6: Explicitly specify ID on create
    console.log('\n📋 Test 6: Explicitly specifying UUID on CREATE');
    console.log('   CREATE test1:u"..uuid.." SET name = "...";');
    try {
      const result6 = await db.query(`
        LET $uuid = rand::uuid::v7();
        CREATE test1:u$uuid SET name = "Test Record 6 with explicit UUID";
      `);
      console.log('   Result:', JSON.stringify(result6, null, 2));

      // biome-ignore lint/suspicious/noExplicitAny: Dynamic database query result
      const record = (result6 as any[])?.[1]?.[0] || (result6 as any[])?.[1];
      if (record?.id) {
        results.push({
          approach: 'Explicit UUID on CREATE',
          success: true,
          recordId: String(record.id),
          recordIdType: typeof record.id,
        });
        console.log('   ✅ SUCCESS! Record created with ID:', record.id);
      } else {
        results.push({
          approach: 'Explicit UUID on CREATE',
          success: false,
          error: 'No ID in result',
        });
        console.log('   ❌ FAILED: No ID in result');
      }
    } catch (error) {
      results.push({
        approach: 'Explicit UUID on CREATE',
        success: false,
        error: String(error),
      });
      console.log('   ❌ FAILED:', error);
    }

    // Approach 7: String field named 'id' with UUID default
    console.log('\n📋 Test 7: Custom uuid_id field (not overriding id)');
    console.log('   DEFINE FIELD uuid_id ON TABLE test7 TYPE uuid DEFAULT rand::uuid::v7();');
    try {
      await db.query(`
        DEFINE TABLE test7 SCHEMAFULL;
        DEFINE FIELD uuid_id ON TABLE test7 TYPE uuid DEFAULT rand::uuid::v7();
        DEFINE FIELD name ON TABLE test7 TYPE string;
      `);

      const result7 = await db.query('CREATE test7 SET name = "Test Record 7"');
      console.log('   Result:', JSON.stringify(result7, null, 2));

      // biome-ignore lint/suspicious/noExplicitAny: Dynamic database query result
      const record = (result7 as any[])?.[0]?.[0] || (result7 as any[])?.[0];
      if (record?.id && record?.uuid_id) {
        results.push({
          approach: 'Separate uuid_id field (not overriding id)',
          success: true,
          recordId: `id: ${record.id}, uuid_id: ${record.uuid_id}`,
          recordIdType: `id: ${typeof record.id}, uuid_id: ${typeof record.uuid_id}`,
        });
        console.log('   ✅ SUCCESS! Record id:', record.id, 'uuid_id:', record.uuid_id);
      } else {
        results.push({
          approach: 'Separate uuid_id field',
          success: false,
          error: 'Missing id or uuid_id',
        });
        console.log('   ❌ FAILED: Missing fields');
      }
    } catch (error) {
      results.push({
        approach: 'Separate uuid_id field',
        success: false,
        error: String(error),
      });
      console.log('   ❌ FAILED:', error);
    }

    // Approach 8: Use INSERT instead of CREATE
    console.log('\n📋 Test 8: Using INSERT instead of CREATE');
    try {
      await db.query(`
        DEFINE TABLE test8 SCHEMAFULL;
        DEFINE FIELD id ON TABLE test8 TYPE uuid DEFAULT rand::uuid::v7();
        DEFINE FIELD name ON TABLE test8 TYPE string;
      `);

      const result8 = await db.query('INSERT INTO test8 { name: "Test Record 8" }');
      console.log('   Result:', JSON.stringify(result8, null, 2));

      // biome-ignore lint/suspicious/noExplicitAny: Dynamic database query result
      const record = (result8 as any[])?.[0]?.[0] || (result8 as any[])?.[0];
      if (record?.id) {
        results.push({
          approach: 'INSERT instead of CREATE',
          success: true,
          recordId: String(record.id),
          recordIdType: typeof record.id,
        });
        console.log('   ✅ SUCCESS! Record created with ID:', record.id);
      } else {
        results.push({
          approach: 'INSERT instead of CREATE',
          success: false,
          error: 'No ID in result',
        });
        console.log('   ❌ FAILED: No ID in result');
      }
    } catch (error) {
      results.push({
        approach: 'INSERT instead of CREATE',
        success: false,
        error: String(error),
      });
      console.log('   ❌ FAILED:', error);
    }

    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));

    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    console.log(`\n✅ Successful approaches (${successes.length}):`);
    for (const r of successes) {
      console.log(`   • ${r.approach}`);
      console.log(`     ID: ${r.recordId}`);
      console.log(`     Type: ${r.recordIdType}`);
    }

    console.log(`\n❌ Failed approaches (${failures.length}):`);
    for (const r of failures) {
      console.log(`   • ${r.approach}`);
      console.log(`     Error: ${r.error}`);
    }

    // Recommendation
    console.log(`\n${'='.repeat(60)}`);
    console.log('💡 RECOMMENDATIONS');
    console.log('='.repeat(60));

    if (successes.some((r) => r.approach.includes('VALUE'))) {
      console.log('\n✅ Use VALUE instead of DEFAULT for uuid id fields:');
      console.log('   id: uuid().value("rand::uuid::v7()")');
    }

    if (
      successes.some(
        (r) => r.approach.includes('Separate uuid_id') || r.approach.includes('No id field'),
      )
    ) {
      console.log(
        '\n✅ Consider NOT overriding the id field - SurrealDB auto-generates efficient IDs',
      );
      console.log('   If you need UUIDs for external APIs, use a separate field like uuid_id');
    }

    if (successes.some((r) => r.approach.includes('Explicit UUID'))) {
      console.log('\n✅ If you must use UUID ids, specify them explicitly on create:');
      console.log('   CREATE table:u"your-uuid-here" SET ...');
    }
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
  } finally {
    // Clean up
    try {
      await db.close();
      console.log('\n🧹 Connection closed');
    } catch (_e) {
      // Ignore close errors
    }
  }
}

// Run the test
runTest().catch(console.error);
