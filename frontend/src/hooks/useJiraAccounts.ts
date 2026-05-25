import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { firestore } from '../services/firebase';

export interface JiraAccount {
  accountId: string;
  displayName: string;
}

export function useJiraAccounts() {
  const [accounts, setAccounts] = useState<JiraAccount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocs(collection(firestore, 'worklogs_raw')).then(snap => {
      const map = new Map<string, string>();
      snap.docs.forEach(d => {
        const { accountId, user } = d.data() as { accountId: string; user: string };
        if (accountId && user && !map.has(accountId)) {
          map.set(accountId, user);
        }
      });
      const sorted = Array.from(map.entries())
        .map(([accountId, displayName]) => ({ accountId, displayName }))
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
      setAccounts(sorted);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return { accounts, loading };
}
