import { createClient } from 'redis';
import logger from './logger';

const redisClient = createClient({
  url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
  password: process.env.REDIS_PASSWORD || undefined,
});

redisClient.on('error', (err) => {
  logger.error('Redis error', { error: err.message });
});

redisClient.on('connect', () => {
  logger.info('Redis connected');
});

redisClient.connect();

export default redisClient;

// Graceful shutdown
process.on('SIGINT', async () => {
  await redisClient.quit();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await redisClient.quit();
  process.exit(0);
});
