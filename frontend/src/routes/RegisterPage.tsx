import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link as RouterLink } from 'react-router-dom';
import { Box, Paper, Typography, TextField, Button, Alert, Link, Stack, CircularProgress } from '@mui/material';
import { Logo } from '../components/common/Logo';
import { createAccount } from '../services/firestore/users';
import { validateInvite, markInviteUsed } from '../services/firestore/invites';
import { BRAND } from '../theme';

export function RegisterPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const inviteToken = params.get('invite') ?? '';
  const inviteEmail = params.get('email') ?? '';

  const [inviteValid, setInviteValid] = useState<boolean | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!inviteToken || !inviteEmail) {
      setInviteValid(false);
      setInviteError('Neplatný odkaz. Požádej administrátora o novou pozvánku.');
      return;
    }
    validateInvite(inviteToken, inviteEmail).then(({ valid, reason }) => {
      setInviteValid(valid);
      if (!valid) setInviteError(reason ?? 'Neplatná pozvánka.');
    });
  }, [inviteToken, inviteEmail]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) { setError('Vyplň jméno.'); return; }
    if (password.length < 6) { setError('Heslo musí mít alespoň 6 znaků.'); return; }
    setBusy(true); setError(null);
    try {
      await createAccount(inviteEmail, password, displayName.trim(), 'active', null);
      await markInviteUsed(inviteToken);
      setSuccess(true);
      setTimeout(() => navigate('/'), 2000);
    } catch (e) {
      setError(String(e).replace('FirebaseError: ', ''));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BRAND.cream }}>
      <Paper sx={{ p: 4, width: 380 }}>
        <Stack alignItems="center" sx={{ mb: 3 }}><Logo /></Stack>
        <Typography variant="h6" sx={{ mb: 2, textAlign: 'center' }}>Registrace</Typography>

        {inviteValid === null && (
          <Stack alignItems="center" sx={{ py: 3 }}><CircularProgress /></Stack>
        )}

        {inviteValid === false && (
          <Stack spacing={2}>
            <Alert severity="error">{inviteError}</Alert>
            <Link component={RouterLink} to="/login" variant="body2" align="center" display="block">
              Zpět na přihlášení
            </Link>
          </Stack>
        )}

        {inviteValid === true && !success && (
          <form onSubmit={submit}>
            <Stack spacing={2}>
              <TextField label="Email" value={inviteEmail} disabled size="small" fullWidth />
              <TextField
                label="Jméno"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                required size="small" fullWidth autoFocus
              />
              <TextField
                label="Heslo"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required size="small" fullWidth
              />
              {error && <Alert severity="error">{error}</Alert>}
              <Button type="submit" variant="contained" disabled={busy}>
                {busy ? 'Vytvářím účet…' : 'Vytvořit účet'}
              </Button>
              <Link component={RouterLink} to="/login" variant="caption" align="center" display="block">
                Zpět na přihlášení
              </Link>
            </Stack>
          </form>
        )}

        {success && (
          <Alert severity="success">Účet byl vytvořen. Přihlašuji tě…</Alert>
        )}
      </Paper>
    </Box>
  );
}
