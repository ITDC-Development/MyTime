import { Router } from 'express';
import { authenticate, requireAdmin, AuthedRequest } from '../middleware/auth';
import { db, authAdmin } from '../services/firestoreClient';
import { logger } from '../utils/logger';

const router = Router();

router.get('/', authenticate, requireAdmin, async (_req, res) => {
  const snap = await db().collection('users').orderBy('createdAt', 'desc').get();
  res.json(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
});

router.patch('/:uid', authenticate, requireAdmin, async (req: AuthedRequest, res) => {
  const { uid } = req.params;
  const updates = req.body as { role?: 'admin' | 'user'; status?: 'active' | 'pending' | 'blocked' };

  // Bezpečnostní pojistka pro posledního admina - jen warning v UI, server jen loguje
  if (updates.role === 'user' || updates.status === 'blocked') {
    const adminCount = await db().collection('users')
      .where('role', '==', 'admin')
      .where('status', '==', 'active')
      .get();
    if (adminCount.size === 1 && adminCount.docs[0].id === uid) {
      logger.warn('Admin upravuje posledního admina', { uid });
    }
  }

  const cleaned: Record<string, unknown> = {};
  if (updates.role) cleaned.role = updates.role;
  if (updates.status) cleaned.status = updates.status;
  if (updates.status === 'active') {
    cleaned.approvedAt = new Date().toISOString();
    cleaned.approvedBy = req.user!.uid;
  }
  await db().collection('users').doc(uid).update(cleaned);
  res.json({ ok: true });
});

router.delete('/:uid', authenticate, requireAdmin, async (req, res) => {
  const { uid } = req.params;
  await db().collection('users').doc(uid).delete();
  try {
    await authAdmin().deleteUser(uid);
  } catch (err) {
    logger.warn('Smazání Firebase Auth uživatele selhalo', { uid, err: String(err) });
  }
  res.json({ ok: true });
});

export default router;
