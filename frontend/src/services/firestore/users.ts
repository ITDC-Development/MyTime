import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { firestore } from '../firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../firebase';

export async function isFirstUser(): Promise<boolean> {
  const snap = await getDocs(collection(firestore, 'users'));
  return snap.empty;
}

export async function createAccount(email: string, password: string, displayName: string) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });
  const firstUser = await isFirstUser();
  await setDoc(doc(firestore, 'users', cred.user.uid), {
    email: email.toLowerCase(),
    displayName,
    role: firstUser ? 'admin' : 'user',
    status: firstUser ? 'active' : 'pending',
    jiraAccountId: null,
    createdAt: new Date().toISOString(),
    approvedAt: firstUser ? new Date().toISOString() : null,
    approvedBy: null,
    preferences: {
      showPauses: true,
      columns: {
        projectReport: ['date', 'period', 'issue', 'hours'],
        companyReport: ['date', 'period', 'issue', 'hours'],
        overview: ['user', 'date', 'period', 'issue', 'hours'],
      },
      lastSelectedUser: null,
    },
  });
  return cred.user.uid;
}
