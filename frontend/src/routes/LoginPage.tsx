import { useState } from 'react';
import { useNavigate, Link as RouterLink, useLocation } from 'react-router-dom';
import { Box, Paper, Typography, TextField, Button, Alert, Link, Stack } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from '../components/common/Logo';
import { BRAND } from '../theme';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      await login(email.toLowerCase(), password);
      navigate(from, { replace: true });
    } catch {
      setError('Přihlášení se nezdařilo. Zkontroluj email a heslo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BRAND.cream }}>
      <Paper sx={{ p: 4, width: 360 }}>
        <Stack alignItems="center" sx={{ mb: 3 }}><Logo /></Stack>
        <Typography variant="h6" sx={{ mb: 2, textAlign: 'center' }}>Přihlášení</Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <form onSubmit={submit}>
          <Stack spacing={2}>
            <TextField label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required size="small" fullWidth />
            <TextField label="Heslo" type="password" value={password} onChange={e => setPassword(e.target.value)} required size="small" fullWidth />
            <Button type="submit" variant="contained" disabled={busy}>{busy ? 'Přihlašuji…' : 'Přihlásit se'}</Button>
            <Typography variant="caption" align="center">
              Nemáš účet? <Link component={RouterLink} to="/register">Registrovat se</Link>
            </Typography>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
}
