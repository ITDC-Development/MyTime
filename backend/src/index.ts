import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { logger } from './utils/logger';
import health from './routes/health';
import sync from './routes/sync';
import users from './routes/users';
import smartReports from './routes/smartReports';

const app = express();
app.disable('x-powered-by');

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',').map(s => s.trim());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '10mb' }));

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Příliš mnoho požadavků, zkus to za chvíli.' },
});

const syncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Příliš mnoho sync požadavků.' },
});

app.use(generalLimiter);

app.use('/health', health);
app.use('/sync', syncLimiter, sync);
app.use('/users', users);
app.use('/smart-reports', smartReports);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { err: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

const port = Number(process.env.PORT) || 8081;
app.listen(port, () => {
  logger.info(`MyTime backend běží na portu ${port}`);
});
