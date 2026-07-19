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

// The returned promise rejects when Redis is unreachable — without this catch
// the rejection is unhandled and crashes the whole process (AggregateError)
redisClient.connect().catch((err) => {
  logger.error('Redis: initial connection failed — continuing without Redis', {
    error: (err as Error)?.message,
  });
});

export default redisClient;

// Graceful shutdown — quit() throws if the client never connected
process.on('SIGINT', async () => {
  await redisClient.quit().catch(() => {});
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await redisClient.quit().catch(() => {});
  process.exit(0);
});
