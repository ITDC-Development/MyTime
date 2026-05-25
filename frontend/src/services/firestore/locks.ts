import { collection, onSnapshot, query, where, doc, setDoc } from 'firebase/firestore';
import { firestore } from '../firebase';
import type { Lock } from '../../types/lock';

export function lockKey(year: number, month: number, accountId: string) {
  return `${year}-${String(month).padStart(2, '0')}-${accountId}`;
}

export async function setLocks(year: number, month: number, accountIds: string[], lockedBy: string) {
  await Promise.all(accountIds.map(acc =>
    setDoc(doc(firestore, 'locks', lockKey(year, month, acc)), {
      year, month, accountId: acc,
      lockedAt: new Date().toISOString(),
      lockedBy,
    } as Lock)
  ));
}
