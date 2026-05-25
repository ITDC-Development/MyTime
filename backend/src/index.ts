import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { logger } from './utils/logger';
import health from './routes/health';
import sync from './routes/sync';
import users from './routes/users';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/health', health);
app.use('/sync', sync);
app.use('/users', users);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { err: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

const port = Number(process.env.PORT) || 8081;
app.listen(port, () => {
  logger.info(`MyTime backend běží na portu ${port}`);
});
