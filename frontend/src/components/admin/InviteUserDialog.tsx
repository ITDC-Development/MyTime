import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Stack, Alert, InputAdornment, IconButton, Typography,
} from '@mui/material';
import { ContentCopy, Check } from '@mui/icons-material';
import { createInvite } from '../../services/firestore/invites';
import { useAuth } from '../../contexts/AuthContext';

interface Props { open: boolean; onClose: () => void; }

export function InviteUserDialog({ open, onClose }: Props) {
  const { profile } = useAuth();
  const [email, setEmail] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setEmail(''); setLink(null); setCopied(false); setError(null);
    onClose();
  };

  const submit = async () => {
    if (!email || !profile) { setError('Vyplň email.'); return; }
    setBusy(true); setError(null);
    try {
      const token = await createInvite(email, profile.uid);
      const url = `${window.location.origin}/register?invite=${token}&email=${encodeURIComponent(email.toLowerCase())}`;
      setLink(url);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Pozvat uživatele</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {link ? (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="success">Pozvánka vytvořena. Zkopíruj odkaz a pošli ho uživateli.</Alert>
            <Typography variant="caption" color="text.secondary">
              Platnost odkazu je 7 dní. Po použití se automaticky zneplatní.
            </Typography>
            <TextField
              value={link}
              fullWidth
              size="small"
              InputProps={{
                readOnly: true,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={copy} edge="end" size="small">
                      {copied ? <Check fontSize="small" color="success" /> : <ContentCopy fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Stack>
        ) : (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Email uživatele"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              fullWidth
              size="small"
              autoFocus
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {link ? (
          <Button onClick={handleClose} variant="contained">Zavřít</Button>
        ) : (
          <>
            <Button onClick={handleClose}>Zrušit</Button>
            <Button onClick={submit} variant="contained" disabled={busy}>
              {busy ? 'Generuji…' : 'Vygenerovat odkaz'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
