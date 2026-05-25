import { db } from './firestoreClient';

export function lockId(year: number, month: number, accountId: string) {
  return `${year}-${String(month).padStart(2, '0')}-${accountId}`;
}

export async function isLocked(year: number, month: number, accountId: string): Promise<boolean> {
  const snap = await db().collection('locks').doc(lockId(year, month, accountId)).get();
  return snap.exists;
}

export async function lockMonth(year: number, month: number, accountId: string, lockedBy: string) {
  await db().collection('locks').doc(lockId(year, month, accountId)).set({
    year, month, accountId, lockedBy, lockedAt: new Date().toISOString(),
  });
}

export async function unlockMonth(year: number, month: number, accountId: string) {
  await db().collection('locks').doc(lockId(year, month, accountId)).delete();
}
