import { useState } from 'react';
import { Stack, TextField, Button, Alert, Box } from '@mui/material';
import { PlayArrow } from '@mui/icons-material';
import { api } from '../../services/api';

export function DownloadForm() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true); setError(null); setResult(null);
    try {
      const r = await api<{ worklogsWritten: number; worklogsSkipped: number; absencesWritten: number; atError?: string }>('/sync/manual', {
        method: 'POST',
        body: JSON.stringify(from && to ? { from, to } : {}),
      });
      setResult(`Hotovo: ${r.worklogsWritten} worklogů uloženo, ${r.worklogsSkipped} přeskočeno, ${r.absencesWritten} absencí.`);
      if (r.atError) setError(`Activity Timeline chyba: ${r.atError}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <TextField label="Datum od" type="date" value={from} onChange={e => setFrom(e.target.value)} size="small" InputLabelProps={{ shrink: true }} />
        <TextField label="Datum do" type="date" value={to} onChange={e => setTo(e.target.value)} size="small" InputLabelProps={{ shrink: true }} />
      </Stack>
      <Alert severity="info" sx={{ mb: 2 }}>
        Bez datumů se stáhnou jen nové worklogy (incremental). S datumy se přepíší všechny worklogy v rozsahu.
      </Alert>
      <Button variant="contained" startIcon={<PlayArrow />} disabled={busy} onClick={run}>
        {busy ? 'Probíhá sync…' : 'Spustit stažení'}
      </Button>
      {result && <Alert severity="success" sx={{ mt: 2 }}>{result}</Alert>}
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
    </Box>
  );
}
