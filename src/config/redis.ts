import { createClient } from 'redis';
import logger from './logger';
import { env } from './env';

const redisClient = createClient({
  url: env.redisUrl,
  socket: {
    reconnectStrategy: (retries: number) => {
      if (retries >= 5) {
        logger.error('Redis: max reconnect attempts reached — Redis features disabled');
        return false; // stop retrying
      }
      return Math.min(retries * 500, 3000); // backoff: 500ms, 1s, 1.5s, 2s, 2.5s
    },
  },
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
