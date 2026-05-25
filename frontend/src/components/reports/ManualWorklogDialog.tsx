import { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Stack, Alert } from '@mui/material';
import { addManualWorklog } from '../services-bridge';
import { useAuth } from '../../contexts/AuthContext';
import dayjs from 'dayjs';

interface Props { open: boolean; accountId: string; user: string; date: string; onClose: () => void; }

export function ManualWorklogDialog({ open, accountId, user, date, onClose }: Props) {
  const { profile } = useAuth();
  const [summary, setSummary] = useState('');
  const [hours, setHours] = useState('1');
  const [comment, setComment] = useState('');
  const [d, setD] = useState(date || dayjs().format('YYYY-MM-DD'));
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!profile) return;
    try {
      const seconds = Math.round(parseFloat(hours.replace(',', '.')) * 3600);
      if (!seconds) { setError('Vyplň počet hodin'); return; }
      if (!summary.trim()) { setError('Vyplň název'); return; }
      await addManualWorklog({
        accountId, user, summary, date: d, seconds, comment,
        createdAt: new Date().toISOString(), createdBy: profile.uid,
      });
      setSummary(''); setHours('1'); setComment('');
      onClose();
    } catch (e) { setError(String(e)); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Přidat ruční záznam</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Datum" type="date" value={d} onChange={e => setD(e.target.value)} fullWidth InputLabelProps={{ shrink: true }} />
          <TextField label="Název / popis" value={summary} onChange={e => setSummary(e.target.value)} fullWidth />
          <TextField label="Hodiny" value={hours} onChange={e => setHours(e.target.value)} fullWidth />
          <TextField label="Komentář" value={comment} onChange={e => setComment(e.target.value)} fullWidth multiline minRows={2} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Zrušit</Button>
        <Button onClick={submit} variant="contained">Přidat</Button>
      </DialogActions>
    </Dialog>
  );
}
