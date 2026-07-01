import { useState } from 'react';
import { Button, Alert, Box } from '@mui/material';
import { PlayArrow } from '@mui/icons-material';
import { api } from '../../services/api';
import { DateRangeFields } from '../common/DateRangeFields';

function lastMonthRange() {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10),
    to:   new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10),
  };
}

export function DownloadForm() {
  const defaultRange = lastMonthRange();
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
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
      <Box sx={{ mb: 2 }}>
        <DateRangeFields
          from={from}
          to={to}
          onChange={(f, t) => { setFrom(f); setTo(t); }}
          fromLabel="Datum od"
          toLabel="Datum do"
        />
      </Box>
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
