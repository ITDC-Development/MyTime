import { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, List, ListItem, ListItemText, Typography, Divider } from '@mui/material';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { firestore } from '../../services/firebase';
import { formatDateFull } from '../../utils/dateUtils';
import dayjs from 'dayjs';
import type { AuditEntry } from '../../services/firestore/auditLog';

interface Props { open: boolean; worklogId: string | null; onClose: () => void; }

export function HistoryDialog({ open, worklogId, onClose }: Props) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  useEffect(() => {
    if (!worklogId || !open) return;
    const q = query(
      collection(firestore, 'audit_log'),
      where('worklogId', '==', worklogId),
      orderBy('changedAt', 'desc')
    );
    return onSnapshot(q, (snap) => {
      setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditEntry)));
    });
  }, [worklogId, open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Historie změn worklogu</DialogTitle>
      <DialogContent>
        {entries.length === 0 ? (
          <Typography color="text.secondary">Žádné editace.</Typography>
        ) : (
          <List dense>
            {entries.map((e, idx) => (
              <div key={e.id}>
                <ListItem>
                  <ListItemText
                    primary={`${dayjs(e.changedAt).format('DD. MM. YYYY HH:mm')} · ${e.changedByEmail}`}
                    secondary={e.action === 'revert' ? 'Úprava smazána – obnoveno na původní hodnoty' : renderDiff(e.before, e.after)}
                  />
                </ListItem>
                {idx < entries.length - 1 && <Divider component="li" />}
              </div>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Zavřít</Button>
      </DialogActions>
    </Dialog>
  );
}

function renderDiff(before: Record<string, unknown>, after: Record<string, unknown>) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const diffs: string[] = [];
  keys.forEach((k) => {
    const b = before[k], a = after[k];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      diffs.push(`${k}: ${String(b ?? '—')} → ${String(a ?? '—')}`);
    }
  });
  return diffs.join(' · ') || 'beze změn';
}
