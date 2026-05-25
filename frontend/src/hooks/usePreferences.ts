import { useCallback } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { firestore } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import type { UserPreferences } from '../types/user';

export function usePreferences() {
  const { profile } = useAuth();
  const update = useCallback(
    async (patch: Partial<UserPreferences>) => {
      if (!profile) return;
      await updateDoc(doc(firestore, 'users', profile.uid), {
        preferences: { ...profile.preferences, ...patch },
      });
    },
    [profile]
  );
  return { preferences: profile?.preferences, update };
}
