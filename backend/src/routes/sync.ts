import { Router } from 'express';
import { syncWorklogs, periodForSettings } from '../services/worklogService';
import { authenticate, requireAdmin, AuthedRequest } from '../middleware/auth';
import { db } from '../services/firestoreClient';
import { logger } from '../utils/logger';
import { updateSchedulerJob, type SyncSettings } from '../services/schedulerService';

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
    res.status(500).json({ error: 'Sync failed' });
  }
});

router.all('/manual', (_req, res) => res.status(405).json({ error: 'Method not allowed' }));

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

// Uložení nastavení plánovaného syncu + aktualizace Cloud Scheduler jobu
router.post('/settings', authenticate, requireAdmin, async (req: AuthedRequest, res) => {
  const { frequency, hour, minute, dayOfWeek, dayOfMonth, period } = req.body as SyncSettings;
  try {
    const settings: SyncSettings = {
      frequency: frequency ?? 'daily',
      hour: Number(hour ?? 23),
      minute: Number(minute ?? 0),
      dayOfWeek: Number(dayOfWeek ?? 0),
      dayOfMonth: Number(dayOfMonth ?? 1),
      period: period ?? 'previousMonth',
    };
    await db().collection('sync_settings').doc('default').set({
      ...settings,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user!.uid,
    });
    await updateSchedulerJob(settings);
    logger.info('Sync nastavení uloženo a Cloud Scheduler aktualizován', { settings });
    res.json({ ok: true });
  } catch (err) {
    logger.error('Chyba při ukládání sync nastavení', { err: String(err) });
    res.status(500).json({ error: 'Nepodařilo se uložit nastavení' });
  }
});

export default router;
