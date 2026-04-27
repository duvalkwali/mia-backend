/**
 * Main application setup for the MIA Backend API.
 * This file configures the Express application with middleware, routes, and error handling.
 */

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { errorHandler } from '@/middleware/errorHandler';
import logger from '@/config/logger';
import prisma from '@/config/database';
import { requireAuth } from '@/middleware/auth';
import { SignalsService } from '@/modules/signals/signals.service';
import { ReplyService } from '@/modules/ai-reply/reply.service';

// Import routes
import authRoutes from '@/modules/auth/auth.routes';
import businessRoutes from '@/modules/business/business.routes';
import styleRoutes from '@/modules/style/style.routes';
import signalsRoutes from '@/modules/signals/signals.routes';
import replyRoutes from '@/modules/ai-reply/reply.routes';
import whatsappRoutes from '@/modules/webhooks/whatsapp.routes';

/**
 * Creates and configures the Express application instance.
 * Sets up middleware, routes, and error handling in the correct order.
 *
 * @returns {Express} The configured Express application
 */
export function createApp(): Express {
  const app = express();

  // Middleware — open CORS for development; tighten via ALLOWED_ORIGINS in production
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3001',
    'http://localhost:3000',
    'http://localhost:5173',
  ];
  app.use(cors({ origin: allowedOrigins, credentials: true, methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use((req, _res, next) => {
    logger.info('Incoming request', {
      method: req.method,
      path: req.path,
      ip: req.ip,
    });
    next();
  });

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // API Routes
  const apiVersion = process.env.API_VERSION || 'v1';
  app.use(`/api/${apiVersion}/auth`, authRoutes);
  app.use(`/api/${apiVersion}/business`, businessRoutes);
  app.use(`/api/${apiVersion}/style`, styleRoutes);
  app.use(`/api/${apiVersion}/signals`, signalsRoutes);
  app.use(`/api/${apiVersion}/replies`, replyRoutes);
  app.use(`/api/${apiVersion}/webhooks/whatsapp`, whatsappRoutes);

  // Dashboard stats endpoint
  app.get(`/api/${apiVersion}/dashboard`, requireAuth, async (req: Request, res: Response) => {
    try {
      const { tenantId } = req.tenantContext!;
      const [pendingReplies, faqsCount, costRow] = await Promise.all([
        prisma.generatedReply.count({ where: { status: 'PENDING', contact: { tenantId } } }),
        prisma.fAQ.count({ where: { business: { tenantId } } }),
        prisma.costTracking.aggregate({ where: { tenantId }, _sum: { costUsd: true } }),
      ]);
      res.json({ success: true, data: { pendingReplies, faqsCount, costTracked: costRow._sum.costUsd ?? 0 } });
    } catch (err) {
      logger.error('Dashboard error', { err });
      res.status(500).json({ success: false, error: 'Failed to load dashboard' });
    }
  });

  // Playground: extract signal + generate reply in one shot
  const signalsService = new SignalsService();
  const replyService = new ReplyService();

  app.post(`/api/${apiVersion}/playground/extract-signal`, requireAuth, async (req: Request, res: Response) => {
    try {
      const { contactExternalId, platform, messageText } = req.body;
      const result = await signalsService.extractSignals(req.tenantContext!, {
        contactExternalId: contactExternalId || 'playground-user',
        platform: platform || 'WHATSAPP',
        messageText,
      });
      res.json({ success: true, data: result.signals });
    } catch (err) {
      logger.error('Playground extract error', { err });
      res.status(500).json({ success: false, error: 'Signal extraction failed' });
    }
  });

  app.post(`/api/${apiVersion}/playground/generate-reply`, requireAuth, async (req: Request, res: Response) => {
    try {
      const { contactExternalId, messageText } = req.body;
      const result = await replyService.generateReply(req.tenantContext!, {
        contactId: contactExternalId || 'playground-user',
        incomingMessage: messageText,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      logger.error('Playground generate error', { err });
      res.status(500).json({ success: false, error: 'Reply generation failed' });
    }
  });


  // Root route — friendly response for browser/ngrok visits
  app.get('/', (_req, res) => {
    res.json({
      name: 'MIA Backend API',
      version: apiVersion,
      status: 'running',
      health: '/health',
      api: `/api/${apiVersion}`,
    });
  });

  // 404 handler — clean JSON instead of Express default "Cannot GET X"
  app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Route not found' });
  });

  // Error handling (must be last)
  app.use(errorHandler);

  return app;
}

