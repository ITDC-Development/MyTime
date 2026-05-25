import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { Box, Paper, Typography, TextField, Button, Alert, Link, Stack } from '@mui/material';
import { Logo } from '../components/common/Logo';
import { createAccount } from '../services/firestore/users';
import { BRAND } from '../theme';

const ALLOWED = (import.meta.env.VITE_ALLOWED_EMAIL_DOMAINS || 'it-dc.cz,it-dc.sk').split(',').map(s => s.trim().toLowerCase());

function isAllowedEmail(email: string) {
  const lower = email.toLowerCase();
  return ALLOWED.some(d => lower.endsWith('@' + d));
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!isAllowedEmail(email)) {
      setError(`Registrace je povolená jen pro emaily ${ALLOWED.map(d => '@' + d).join(' nebo ')}.`);
      return;
    }
    if (password.length < 6) {
      setError('Heslo musí mít alespoň 6 znaků.');
      return;
    }
    setBusy(true);
    try {
      await createAccount(email.toLowerCase(), password, displayName);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2500);
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
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success ? (
          <Alert severity="success">Účet vytvořen. Čeká na schválení administrátorem.</Alert>
        ) : (
          <form onSubmit={submit}>
            <Stack spacing={2}>
              <TextField label="Jméno" value={displayName} onChange={e => setDisplayName(e.target.value)} required size="small" fullWidth />
              <TextField label="Firemní email" type="email" value={email} onChange={e => setEmail(e.target.value)} required size="small" fullWidth helperText={`Povoleno: ${ALLOWED.map(d => '@' + d).join(', ')}`} />
              <TextField label="Heslo" type="password" value={password} onChange={e => setPassword(e.target.value)} required size="small" fullWidth />
              <Button type="submit" variant="contained" disabled={busy}>{busy ? 'Vytvářím účet…' : 'Vytvořit účet'}</Button>
              <Typography variant="caption" align="center">
                <Link component={RouterLink} to="/login">Zpět na přihlášení</Link>
              </Typography>
            </Stack>
          </form>
        )}
      </Paper>
    </Box>
  );
}
