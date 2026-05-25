import { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Stack, Alert, Grid } from '@mui/material';
import type { LinearWorklog } from '../../types/worklog';
import { saveEditedWorklog } from '../services-bridge';
import { logEdit } from '../../services/firestore/auditLog';
import { useAuth } from '../../contexts/AuthContext';

interface Props { open: boolean; worklog: LinearWorklog | null; onClose: () => void; }

export function WorklogEditDialog({ open, worklog, onClose }: Props) {
  const { profile } = useAuth();
  const [date, setDate] = useState('');
  const [issueKey, setIssueKey] = useState('');
  const [summary, setSummary] = useState('');
  const [hours, setHours] = useState('');
  const [parentKey, setParentKey] = useState('');
  const [parentSummary, setParentSummary] = useState('');
  const [sprint, setSprint] = useState('');
  const [components, setComponents] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (worklog) {
      setDate(worklog.date);
      setIssueKey(worklog.issueKey);
      setSummary(worklog.summary);
      setHours(worklog.hours.toString());
      setParentKey(worklog.parentKey);
      setParentSummary(worklog.parentSummary);
      setSprint(worklog.sprint);
      setComponents(worklog.components.join(', '));
      setComment(worklog.comment);
      setError(null);
    }
  }, [worklog]);

  const submit = async () => {
    if (!worklog || !profile) return;
    try {
      const newSeconds = Math.round(parseFloat(hours.replace(',', '.')) * 3600);
      if (!newSeconds || newSeconds < 0) { setError('Hodiny musí být kladné číslo'); return; }
      const compsArray = components.split(',').map(c => c.trim()).filter(Boolean);
      const before = {
        seconds: Math.round(worklog.hours * 3600),
        date: worklog.date,
        issueKey: worklog.issueKey,
        summary: worklog.summary,
        parentKey: worklog.parentKey,
        parentSummary: worklog.parentSummary,
        sprint: worklog.sprint,
        components: worklog.components,
        comment: worklog.comment,
      };
      const after = { seconds: newSeconds, date, issueKey, summary, parentKey, parentSummary, sprint, components: compsArray, comment };
      await saveEditedWorklog({
        worklogId: worklog.worklogId,
        user: worklog.user,
        accountId: worklog.accountId,
        seconds: newSeconds,
        date,
        issueKey,
        summary,
        parentKey,
        parentSummary,
        sprint,
        components: compsArray,
        comment,
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
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField label="Datum" type="date" value={date} onChange={e => setDate(e.target.value)} fullWidth InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Hodiny" value={hours} onChange={e => setHours(e.target.value)} fullWidth />
            </Grid>
          </Grid>
          <Grid container spacing={2}>
            <Grid item xs={4}>
              <TextField label="Issue klíč" value={issueKey} onChange={e => setIssueKey(e.target.value)} fullWidth />
            </Grid>
            <Grid item xs={8}>
              <TextField label="Issue / název" value={summary} onChange={e => setSummary(e.target.value)} fullWidth />
            </Grid>
          </Grid>
          <Grid container spacing={2}>
            <Grid item xs={4}>
              <TextField label="Parent klíč" value={parentKey} onChange={e => setParentKey(e.target.value)} fullWidth />
            </Grid>
            <Grid item xs={8}>
              <TextField label="Parent název" value={parentSummary} onChange={e => setParentSummary(e.target.value)} fullWidth />
            </Grid>
          </Grid>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField label="Sprint" value={sprint} onChange={e => setSprint(e.target.value)} fullWidth />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Komponenty" value={components} onChange={e => setComponents(e.target.value)} fullWidth placeholder="např. Backend, API" />
            </Grid>
          </Grid>
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
