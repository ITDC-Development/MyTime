import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { firestore } from '../services/firebase';
import type { Member } from '../types/user';

export function useMembers() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const q = query(collection(firestore, 'members'), orderBy('displayName'));
    return onSnapshot(q, (snap) => {
      setMembers(snap.docs.map(d => d.data() as Member));
      setLoading(false);
    });
  }, []);
  return { members, loading };
}
