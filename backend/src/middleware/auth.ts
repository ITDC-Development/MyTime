import type { Request, Response, NextFunction } from 'express';
import { authAdmin, db } from '../services/firestoreClient';
import { logger } from '../utils/logger';

export interface AuthedRequest extends Request {
  user?: { uid: string; email: string; role: 'admin' | 'user'; status: string };
}

export async function authenticate(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }
  const token = header.slice(7);
  try {
    const decoded = await authAdmin().verifyIdToken(token);
    const snap = await db().collection('users').doc(decoded.uid).get();
    if (!snap.exists) {
      return res.status(403).json({ error: 'User profile not found' });
    }
    const profile = snap.data() as { role: 'admin' | 'user'; status: string; email: string };
    if (profile.status !== 'active') {
      return res.status(403).json({ error: `Account ${profile.status}` });
    }
    req.user = { uid: decoded.uid, email: profile.email, role: profile.role, status: profile.status };
    next();
  } catch (err) {
    logger.warn('Auth selhal', { err: String(err) });
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  next();
}
