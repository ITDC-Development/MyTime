import { useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { firestore } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { Lock } from '../types/lock';

function lockId(year: number, month: number, accountId: string) {
  return `${year}-${String(month).padStart(2, '0')}-${accountId}`;
}

export function useLock(year: number, month: number, accountId: string | null) {
  const { profile } = useAuth();
  const [lock, setLock] = useState<Lock | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accountId) { setLock(null); setLoading(false); return; }
    const ref = doc(firestore, 'locks', lockId(year, month, accountId));
    return onSnapshot(ref, (snap) => {
      setLock(snap.exists() ? (snap.data() as Lock) : null);
      setLoading(false);
    });
  }, [year, month, accountId]);

  const lockNow = useCallback(async (account: string) => {
    if (!profile) return;
    await setDoc(doc(firestore, 'locks', lockId(year, month, account)), {
      year, month, accountId: account,
      lockedAt: new Date().toISOString(),
      lockedBy: profile.uid,
    });
  }, [profile, year, month]);

  const unlockNow = useCallback(async (account: string) => {
    await deleteDoc(doc(firestore, 'locks', lockId(year, month, account)));
  }, [year, month]);

  return { lock, isLocked: Boolean(lock), loading, lockNow, unlockNow };
}
