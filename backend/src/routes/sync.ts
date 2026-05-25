import { Router } from 'express';
import { syncWorklogs, periodForSettings } from '../services/worklogService';
import { authenticate, requireAdmin, AuthedRequest } from '../middleware/auth';
import { db } from '../services/firestoreClient';
import { logger } from '../utils/logger';

const router = Router();

// Manuální sync (admin only)
router.post('/manual', authenticate, requireAdmin, async (req: AuthedRequest, res) => {
  const { from, to } = req.body as { from?: string; to?: string };
  try {
    const mode = from && to ? 'override' : 'incremental';
    const range = from && to ? { from, to } : periodForSettings('currentMonth');
    const result = await syncWorklogs({ ...range, mode });
    res.json(result);
  } catch (err) {
    logger.error('Manuální sync selhal', { err: String(err) });
    res.status(500).json({ error: 'Sync failed', details: String(err) });
  }
});

// Plánovaný sync - volá Cloud Scheduler s OIDC tokenem
router.post('/scheduled', async (_req, res) => {
  try {
    const settingsSnap = await db().collection('sync_settings').doc('default').get();
    const settings = settingsSnap.exists
      ? settingsSnap.data() as { period: 'currentMonth' | 'previousMonth' }
      : { period: 'previousMonth' as const };
    const range = periodForSettings(settings.period);
    const result = await syncWorklogs({ ...range, mode: 'incremental' });
    res.json(result);
  } catch (err) {
    logger.error('Plánovaný sync selhal', { err: String(err) });
    res.status(500).json({ error: 'Scheduled sync failed' });
  }
});

export default router;
