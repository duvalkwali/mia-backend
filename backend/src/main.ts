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
  // Raw stdout write — bypasses Winston entirely.
  // If you see this line, the process is alive and stdout is connected.
  process.stdout.write(`\n=== MIA Backend starting (pid ${process.pid}) ===\n\n`);

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

    // In development, flush cached prompt templates on every restart so prompt
    // code changes take effect immediately without waiting for the 1-hour TTL.
    if (process.env.NODE_ENV === 'development') {
      try {
        const templateKeys = await redisClient.keys('template:*');
        if (templateKeys.length > 0) {
          await redisClient.del(templateKeys);
          logger.info(`Dev startup: cleared ${templateKeys.length} cached prompt template(s)`);
        }
      } catch {
        // Non-fatal — Redis may be unavailable
      }
    }

    // Start server
    const app = createApp();
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Webhook path: POST /api/v1/webhooks/whatsapp`);
      logger.info(`Local test:   curl -X POST http://localhost:${PORT}/api/v1/webhooks/whatsapp -H "Content-Type: application/json" -d "{}"`)
      logger.info(`Tunnel required — Meta cannot reach localhost. Run: ngrok http ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

startServer();


