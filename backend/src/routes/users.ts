import { Router } from 'express';
import { authenticate, requireAdmin, AuthedRequest } from '../middleware/auth';
import { db, authAdmin } from '../services/firestoreClient';
import { logger } from '../utils/logger';

const router = Router();

const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS || '').split(',').map(s => s.trim()).filter(Boolean);

router.post('/', authenticate, requireAdmin, async (req: AuthedRequest, res) => {
  const { email, displayName } = req.body as { email: string; displayName: string };
  if (!email || !displayName) {
    return res.status(400).json({ error: 'email a displayName jsou povinné' });
  }
  const emailDomain = email.split('@')[1]?.toLowerCase();
  if (allowedDomains.length && !allowedDomains.includes(emailDomain)) {
    return res.status(400).json({ error: 'Email není z povolené domény.' });
  }
  try {
    const userRecord = await authAdmin().createUser({
      email: email.toLowerCase(),
      displayName,
      emailVerified: false,
    });
    await db().collection('users').doc(userRecord.uid).set({
      email: email.toLowerCase(),
      displayName,
      role: 'user',
      status: 'active',
      jiraAccountId: null,
      createdAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
      approvedBy: req.user!.uid,
      preferences: {
        showPauses: true,
        columns: {
          projectReport: ['date', 'from', 'to', 'issue', 'hours'],
          companyReport: ['date', 'from', 'to', 'issue', 'hours'],
          overview: ['user', 'date', 'from', 'to', 'issue', 'hours'],
        },
        lastSelectedUser: null,
      },
    });
    res.json({ uid: userRecord.uid });
  } catch (err: any) {
    if (err.code === 'auth/email-already-exists') {
      return res.status(409).json({ error: 'Uživatel s tímto emailem již existuje.' });
    }
    logger.error('Vytvoření uživatele selhalo', { err: String(err) });
    res.status(500).json({ error: 'Vytvoření uživatele selhalo.' });
  }
});

router.get('/', authenticate, requireAdmin, async (_req, res) => {
  const snap = await db().collection('users').orderBy('createdAt', 'desc').get();
  res.json(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
});

router.patch('/:uid', authenticate, requireAdmin, async (req: AuthedRequest, res) => {
  const { uid } = req.params;
  const updates = req.body as { role?: 'admin' | 'user' | 'freelancer'; status?: 'active' | 'pending' | 'blocked' };

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

  const VALID_ROLES = ['admin', 'user', 'freelancer'];
  const VALID_STATUSES = ['active', 'pending', 'blocked'];
  if (updates.role && !VALID_ROLES.includes(updates.role)) {
    return res.status(400).json({ error: 'Neplatná role.' });
  }
  if (updates.status && !VALID_STATUSES.includes(updates.status)) {
    return res.status(400).json({ error: 'Neplatný status.' });
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
