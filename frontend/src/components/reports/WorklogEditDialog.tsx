import { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Stack, Alert } from '@mui/material';
import type { LinearWorklog } from '../../types/worklog';
import { saveEditedWorklog } from '../services-bridge';
import { logEdit } from '../../services/firestore/auditLog';
import { useAuth } from '../../contexts/AuthContext';

interface Props { open: boolean; worklog: LinearWorklog | null; onClose: () => void; }

export function WorklogEditDialog({ open, worklog, onClose }: Props) {
  const { profile } = useAuth();
  const [hours, setHours] = useState('');
  const [comment, setComment] = useState('');
  const [summary, setSummary] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (worklog) {
      setHours(worklog.hours.toString());
      setComment(worklog.comment);
      setSummary(worklog.summary);
      setError(null);
    }
  }, [worklog]);

  const submit = async () => {
    if (!worklog || !profile) return;
    try {
      const newSeconds = Math.round(parseFloat(hours.replace(',', '.')) * 3600);
      if (!newSeconds || newSeconds < 0) {
        setError('Hodiny musí být kladné číslo');
        return;
      }
      const before = { seconds: Math.round(worklog.hours * 3600), comment: worklog.comment, summary: worklog.summary };
      const after = { seconds: newSeconds, comment, summary };
      await saveEditedWorklog({
        worklogId: worklog.worklogId,
        user: worklog.user,
        accountId: worklog.accountId,
        seconds: newSeconds,
        comment,
        summary,
        editedAt: new Date().toISOString(),
        editedBy: profile.uid,
      });
      await logEdit({
        worklogId: worklog.worklogId,
        user: worklog.user,
        accountId: worklog.accountId,
        changedAt: new Date().toISOString(),
        changedBy: profile.uid,
        changedByEmail: profile.email,
        before, after,
      });
      onClose();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Upravit worklog</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Issue / název" value={summary} onChange={e => setSummary(e.target.value)} fullWidth />
          <TextField label="Hodiny" value={hours} onChange={e => setHours(e.target.value)} fullWidth />
          <TextField label="Komentář" value={comment} onChange={e => setComment(e.target.value)} fullWidth multiline minRows={2} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Zrušit</Button>
        <Button onClick={submit} variant="contained">Uložit</Button>
      </DialogActions>
    </Dialog>
  );
}
