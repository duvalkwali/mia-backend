import { createApp } from '@/app';
import logger from '@/config/logger';
import prisma from '@/config/database';
import redisClient from '@/config/redis';

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    logger.info('Database connected');

    // Test Redis connection
    await redisClient.ping();
    logger.info('Redis connected');

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


