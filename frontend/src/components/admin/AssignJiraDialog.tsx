import { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Autocomplete, TextField, Stack, Alert, CircularProgress, Typography,
} from '@mui/material';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { firestore } from '../../services/firebase';
import { useJiraAccounts } from '../../hooks/useJiraAccounts';
import type { UserProfile } from '../../types/user';

interface Props {
  open: boolean;
  user: UserProfile | null;
  onClose: () => void;
}

export function AssignJiraDialog({ open, user, onClose }: Props) {
  const { accounts, loading } = useJiraAccounts();
  const [selected, setSelected] = useState<{ accountId: string; displayName: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user && accounts.length > 0) {
      const current = accounts.find(a => a.accountId === user.jiraAccountId) ?? null;
      setSelected(current);
    } else {
      setSelected(null);
    }
    setError(null);
  }, [user, accounts]);

  const save = async () => {
    if (!user) return;
    setBusy(true); setError(null);
    try {
      const update: Record<string, unknown> = {
        jiraAccountId: selected?.accountId ?? null,
        jiraDisplayName: selected?.displayName ?? null,
      };
      // Automaticky nastav roli podle members kolekce (jen pro non-admin uživatele)
      if (selected?.accountId && user.role !== 'admin') {
        const memberSnap = await getDoc(doc(firestore, 'members', selected.accountId));
        if (memberSnap.exists()) {
          update.role = memberSnap.data().role;
        }
      }
      await updateDoc(doc(firestore, 'users', user.uid), update);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Přiřadit Jira účet</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Uživatel: <strong>{user?.displayName}</strong>
          </Typography>
          {loading ? (
            <Stack alignItems="center" sx={{ py: 2 }}><CircularProgress size={24} /></Stack>
          ) : accounts.length === 0 ? (
            <Alert severity="info">
              Žádné Jira účty nejsou k dispozici. Spusť nejprve sync dat.
            </Alert>
          ) : (
            <Autocomplete
              options={accounts}
              value={selected}
              onChange={(_, val) => setSelected(val)}
              getOptionLabel={o => `${o.displayName} (${o.accountId})`}
              isOptionEqualToValue={(a, b) => a.accountId === b.accountId}
              renderInput={params => <TextField {...params} label="Jira účet" size="small" />}
              noOptionsText="Žádné výsledky"
              clearText="Odebrat přiřazení"
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Zrušit</Button>
        <Button onClick={save} variant="contained" disabled={busy || loading}>
          {busy ? 'Ukládám…' : 'Uložit'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
