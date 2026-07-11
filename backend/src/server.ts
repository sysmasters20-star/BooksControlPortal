import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import pool from './database/connection.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(helmet());
app.use(cors({
  origin: env.frontendUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

if (env.features.enableRateLimiting) {
  app.use(rateLimit({
    windowMs: env.rateLimit.windowMinutes * 60 * 1000,
    max: env.rateLimit.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
  }));
}

app.get('/api/health', async (_req, res) => {
  let dbStatus = 'disconnected';
  try {
    await pool.query('SELECT 1');
    dbStatus = 'connected';
  } catch {
    // non-critical
  }
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbStatus,
  });
});

import authRoutes from './routes/auth.js';
import bookRoutes from './routes/books.js';
import printRoutes from './routes/print.js';

app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/print', printRoutes);

app.use(errorHandler);

const server = app.listen(env.port, () => {
  logger.info(`Server running on port ${env.port} in ${env.nodeEnv} mode`);
});

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(async () => {
    logger.info('HTTP server closed');
    await pool.end();
    logger.info('Database connection closed');
    process.exit(0);
  });
});

export default app;
