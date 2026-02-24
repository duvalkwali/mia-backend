/**
 * Test Redis Connection
 * 
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/test-redis.ts
 * 
 * Tests both direct Redis connection and the configured app Redis client.
 */

import { createClient } from 'redis';
import { env } from '../src/config/env';

async function testRedisConnection() {
  console.log('🧪 Testing Redis Connection...\n');

  // Test 1: Check env configuration
  console.log('📋 Step 1: Checking Configuration');
  console.log(`   REDIS_URL configured: ${env.redisUrl ? '✅ Yes' : '❌ No'}`);
  console.log(`   URL preview: ${env.redisUrl.replace(/:[^:/@]*@/, ':***@')}\n`);

  // Test 2: Try direct connection
  console.log('📋 Step 2: Testing Direct Connection');
  const testClient = createClient({
    url: env.redisUrl,
  });

  testClient.on('error', (err) => {
    console.error('   ❌ Redis error:', err.message);
  });

  testClient.on('connect', () => {
    console.log('   ✅ Connected to Redis');
  });

  try {
    await testClient.connect();
    const pong = await testClient.ping();
    console.log(`   ✅ PING response: ${pong}\n`);

    // Test 3: Try set/get
    console.log('📋 Step 3: Testing SET/GET Operations');
    const testKey = 'app:test:connection';
    const testValue = `test-${Date.now()}`;

    await testClient.set(testKey, testValue);
    console.log(`   ✅ SET "${testKey}" = "${testValue}"`);

    const getValue = await testClient.get(testKey);
    if (getValue === testValue) {
      console.log(`   ✅ GET "${testKey}" = "${getValue}" (matches)\n`);
    } else {
      console.log(`   ❌ GET mismatch: expected "${testValue}", got "${getValue}"\n`);
    }

    // Clean up
    await testClient.del(testKey);
    console.log(`   ✅ Cleaned up test key\n`);

    // Test 4: Import app's Redis client
    console.log('📋 Step 4: Testing App Redis Client');
    const appRedisClient = (await import('../src/config/redis')).default;
    const appPing = await appRedisClient.ping();
    console.log(`   ✅ App Redis client PING: ${appPing}\n`);

    console.log('✨ All Redis tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('   ❌ Connection failed:', error instanceof Error ? error.message : String(error));
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check if Redis server is running: redis-cli ping');
    console.error('   2. Verify REDIS_URL or REDIS_HOST/PORT/PASSWORD in .env');
    console.error('   3. For local: ensure redis-server started with correct password (if set)');
    console.error('   4. For Upstash/Redis Cloud: check credential accuracy and TLS requirement');
    process.exit(1);
  } finally {
    await testClient.quit().catch(() => {
      /* ignore */
    });
  }
}

testRedisConnection();
