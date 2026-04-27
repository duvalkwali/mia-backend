/**
 * Main entry point for the MIA Backend application.
 * Initializes database connections, starts the server, and handles graceful shutdown.
 */

import { createApp } from '@/app';
import logger from '@/config/logger';
import prisma from '@/config/database';
import redisClient from '@/config/redis';

const PORT = process.env.PORT || 3000;

/**
 * Starts the server after establishing database and Redis connections.
 * Performs connection tests and starts listening on the specified port.
 * Exits the process if startup fails.
 */
async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('Database connected');

    // Test Redis connection with timeout (non-blocking - server starts even if Redis fails)
    try {
      const redisTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Redis ping timeout')), 3000)
      );
      await Promise.race([redisClient.ping(), redisTimeout]);
      logger.info('Redis connected');
    } catch (err) {
      logger.warn('Redis connection failed - server starting without Redis');
    }

    // Start server
    const app = createApp();
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

startServer();


