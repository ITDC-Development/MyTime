import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { firestore } from '../services/firebase';
import type { TagDefinition } from '../types/tagDefinition';

export function useTagDefinitions() {
  const [tagDefinitions, setTagDefinitions] = useState<TagDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const q = query(collection(firestore, 'tag_definitions'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      setTagDefinitions(snap.docs.map(d => ({ id: d.id, ...d.data() } as TagDefinition)));
      setLoading(false);
    });
  }, []);
  return { tagDefinitions, loading };
}
