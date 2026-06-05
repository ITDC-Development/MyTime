import { addDoc, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { firestore } from '../firebase';

export interface AuditEntry {
  id?: string;
  worklogId: string;
  user: string;
  accountId: string;
  changedAt: string;
  changedBy: string;
  changedByEmail: string;
  action?: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

export async function logEdit(entry: Omit<AuditEntry, 'id'>) {
  await addDoc(collection(firestore, 'audit_log'), entry);
}
