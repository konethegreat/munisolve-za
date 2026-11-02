import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import 'dotenv/config';

import { requestId } from './middleware/requestId.middleware';
import { logger, httpLogger } from './logger';
import { notFound } from './middleware/notFound.middleware';
import { errorHandler } from './middleware/error.middleware';
import { generalLimiter } from './middleware/rateLimit.middleware';
import { liveness, readiness } from './controllers/health.controller';

import internalRoutes from './routes/internal.routes';
import authRoutes from './routes/auth.routes';
import reportRoutes from './routes/report.routes';
import aiRoutes from './routes/ai.routes';
import adminRoutes from './routes/admin.routes';
import publicRoutes from './routes/public.routes';
import geoRoutes from './routes/geo.routes';
import supervisorRoutes from './routes/supervisor.routes';
import { openapiJson, docsPage } from './controllers/docs.controller';

const app = express();
app.set('trust proxy', 1);

app.use(requestId);
app.use(httpLogger);

app.use(helmet());

const allowedOrigins = [
  'http://localhost:5173',
  process.env.CLIENT_URL?.replace(/\/$/, ''),
].filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json());

app.get('/', (_req, res) => {
  res.send('<h1>MuniSolve ZA Backend is Live!</h1><p>Go to /health to check status.</p>');
});

app.get('/health', liveness);
app.get('/ready', readiness);

// The internal router has its own limiter, so it is mounted before the global one.
app.use('/api/internal', internalRoutes);

app.use('/api/', generalLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/geo', geoRoutes);
app.use('/api/supervisor', supervisorRoutes);
app.get('/api/openapi.json', openapiJson);
app.get('/api/docs', docsPage);

app.use(notFound);
app.use(errorHandler);

// Listen only when run directly. Tests and the demo launcher require() the app.
if (require.main === module) {
  const port = process.env.PORT || 5000;
  app.listen(port, () => {
    logger.info({ port }, 'API listening');
    logger.info('Security layers active');
  });
}

export = app;
