import { createClient } from 'redis';
import logger from './logger';
import { env } from './env';

const redisClient = createClient({
  url: env.redisUrl,
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
