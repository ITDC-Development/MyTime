import { useEffect, useState } from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { firestore } from '../../services/firebase';
import dayjs from 'dayjs';

interface Entry { startedAt: string; finishedAt: string; worklogsWritten: number; mode: string; }

export function SyncStatusCard() {
  const [last, setLast] = useState<Entry | null>(null);
  useEffect(() => {
    const q = query(collection(firestore, 'sync_log'), orderBy('finishedAt', 'desc'), limit(1));
    return onSnapshot(q, (snap) => {
      const doc = snap.docs[0];
      setLast(doc ? (doc.data() as Entry) : null);
    });
  }, []);

  return (
    <Card>
      <CardContent>
        <Typography variant="caption" color="text.secondary">Poslední sync</Typography>
        {last ? (
          <>
            <Typography variant="body1" sx={{ fontWeight: 500, mt: 0.5 }}>
              {dayjs(last.finishedAt).format('DD. MM. YYYY · HH:mm')}
              <Box component="span" sx={{ color: 'text.secondary', ml: 1, fontWeight: 400 }}>({last.mode})</Box>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {last.worklogsWritten} worklogů uloženo
            </Typography>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Zatím žádný sync.</Typography>
        )}
      </CardContent>
    </Card>
  );
}
