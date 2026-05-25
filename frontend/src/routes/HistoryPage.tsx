import { useEffect, useState } from 'react';
import { Box, Typography, Paper, Table, TableHead, TableBody, TableRow, TableCell, Stack, TextField, MenuItem } from '@mui/material';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { firestore } from '../services/firebase';
import { useUsers } from '../hooks/useUsers';
import dayjs from 'dayjs';
import type { AuditEntry } from '../services/firestore/auditLog';

export function HistoryPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [monthFilter, setMonthFilter] = useState<string>('all');
  const { users } = useUsers();

  useEffect(() => {
    const q = query(collection(firestore, 'audit_log'), orderBy('changedAt', 'desc'));
    return onSnapshot(q, snap => {
      setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditEntry)));
    });
  }, []);

  const months = Array.from(new Set(entries.map(e => e.changedAt.slice(0, 7)))).sort().reverse();

  const filtered = entries.filter(e =>
    (accountFilter === 'all' || e.accountId === accountFilter) &&
    (monthFilter === 'all' || e.changedAt.startsWith(monthFilter))
  );

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 1 }}>Historie změn</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Audit log všech editací worklogů (diff předchozí → nové hodnoty).
      </Typography>

      <Paper sx={{ p: 3 }}>
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <TextField select size="small" label="Zaměstnanec" value={accountFilter} onChange={e => setAccountFilter(e.target.value)} sx={{ minWidth: 200 }}>
            <MenuItem value="all">Všichni</MenuItem>
            {users.filter(u => u.jiraAccountId).map(u => <MenuItem key={u.uid} value={u.jiraAccountId!}>{u.displayName}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Měsíc" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} sx={{ minWidth: 140 }}>
            <MenuItem value="all">Vše</MenuItem>
            {months.map(m => <MenuItem key={m} value={m}>{dayjs(m + '-01').format('MMMM YYYY')}</MenuItem>)}
          </TextField>
        </Stack>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Kdy</TableCell>
              <TableCell>Kdo</TableCell>
              <TableCell>Worklog</TableCell>
              <TableCell>Změna</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map(e => (
              <TableRow key={e.id}>
                <TableCell>{dayjs(e.changedAt).format('DD. MM. YYYY HH:mm')}</TableCell>
                <TableCell>{e.changedByEmail}</TableCell>
                <TableCell><code>{e.worklogId}</code></TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                    {renderDiff(e.before, e.after)}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filtered.length === 0 && <Typography color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>Žádné záznamy.</Typography>}
      </Paper>
    </Box>
  );
}

function renderDiff(before: Record<string, unknown>, after: Record<string, unknown>) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const diffs: string[] = [];
  keys.forEach(k => {
    const b = before[k], a = after[k];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      diffs.push(`${k}: ${JSON.stringify(b)} → ${JSON.stringify(a)}`);
    }
  });
  return diffs.join(' · ') || '—';
}
