import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { firestore } from '../firebase';

export interface Invite {
  email: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  used: boolean;
}

export async function createInvite(email: string, createdBy: string): Promise<string> {
  const token = crypto.randomUUID();
  await setDoc(doc(firestore, 'invites', token), {
    email: email.toLowerCase(),
    createdBy,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    used: false,
  });
  return token;
}

export async function validateInvite(token: string, email: string): Promise<{ valid: boolean; reason?: string }> {
  const snap = await getDoc(doc(firestore, 'invites', token));
  if (!snap.exists()) return { valid: false, reason: 'Pozvánka neexistuje nebo vypršela.' };
  const data = snap.data() as Invite;
  if (data.used) return { valid: false, reason: 'Tato pozvánka již byla použita.' };
  if (data.email !== email.toLowerCase()) return { valid: false, reason: 'Email neodpovídá pozvánce.' };
  if (new Date(data.expiresAt) < new Date()) return { valid: false, reason: 'Platnost pozvánky vypršela.' };
  return { valid: true };
}

export async function markInviteUsed(token: string): Promise<void> {
  await updateDoc(doc(firestore, 'invites', token), { used: true });
}
