import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { firestore } from '../firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../firebase';

export async function createAccount(
  email: string,
  password: string,
  displayName: string,
  status: 'pending' | 'active' = 'pending',
  approvedBy: string | null = null,
) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });
  await setDoc(doc(firestore, 'users', cred.user.uid), {
    email: email.toLowerCase(),
    displayName,
    role: 'user',
    status,
    jiraAccountId: null,
    createdAt: new Date().toISOString(),
    approvedAt: status === 'active' ? new Date().toISOString() : null,
    approvedBy,
    preferences: {
      showPauses: true,
      columns: {
        projectReport: ['date', 'period', 'issue', 'hours'],
        companyReport: ['date', 'period', 'issue', 'hours'],
        overview: ['user', 'date', 'period', 'issue', 'hours'],
      },
      lastSelectedUser: null,
      exportPresets: [],
    },
  });
  return cred.user.uid;
}
