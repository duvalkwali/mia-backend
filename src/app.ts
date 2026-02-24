/**
 * Main application setup for the MIA Backend API.
 * This file configures the Express application with middleware, routes, and error handling.
 */

import express, { Express } from 'express';
import cors from 'cors';
import { errorHandler } from '@/middleware/errorHandler';
import logger from '@/config/logger';

// Import routes
import authRoutes from '@/modules/auth/auth.routes';
// import businessRoutes from './modules/business/business.routes';
// import styleRoutes from './modules/style/style.routes';
// import signalsRoutes from './modules/signals/signals.routes';
// import replyRoutes from './modules/ai-reply/reply.routes';
// import whatsappRoutes from './modules/webhooks/whatsapp.routes';

/**
 * Creates and configures the Express application instance.
 * Sets up middleware, routes, and error handling in the correct order.
 *
 * @returns {Express} The configured Express application
 */
export function createApp(): Express {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use((req, res, next) => {
    logger.info('Incoming request', {
      method: req.method,
      path: req.path,
      ip: req.ip,
    });
    next();
  });

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // API Routes
  const apiVersion = process.env.API_VERSION || 'v1';
  app.use(`/api/${apiVersion}/auth`, authRoutes);
  // app.use(`/api/${apiVersion}/business`, businessRoutes);
  // app.use(`/api/${apiVersion}/style`, styleRoutes);
  // app.use(`/api/${apiVersion}/signals`, signalsRoutes);
  // app.use(`/api/${apiVersion}/replies`, replyRoutes);
  // app.use(`/api/${apiVersion}/webhooks/whatsapp`, whatsappRoutes);


  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:5173',
  'http://localhost:3001',
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

  // Error handling (must be last)
  app.use(errorHandler);

  return app;
}

