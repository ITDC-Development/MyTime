import { useEffect, useState } from 'react';
import { Box, Typography, Stack, Paper, TextField, MenuItem, Button, Alert } from '@mui/material';
import { Save } from '@mui/icons-material';
import { doc, getDoc } from 'firebase/firestore';
import { firestore } from '../services/firebase';
import { api } from '../services/api';
import { DownloadForm } from '../components/sync/DownloadForm';
import { SyncStatusCard } from '../components/sync/SyncStatusCard';

const FREQ_OPTIONS = [
  { value: 'daily', label: 'Denně' },
  { value: 'weekly', label: 'Týdně' },
  { value: 'monthly', label: 'Měsíčně' },
];
const DAYS_OF_WEEK = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];
const PERIOD_OPTIONS = [
  { value: 'currentMonth', label: 'Aktuální měsíc' },
  { value: 'previousMonth', label: 'Předchozí měsíc' },
];

const TIME_OPTIONS = Array.from({ length: 24 * 12 }, (_, i) => {
  const h = Math.floor(i / 12);
  const m = (i % 12) * 5;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
});

export function DownloadDataPage() {
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [time, setTime] = useState('23:00');
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [period, setPeriod] = useState<'currentMonth' | 'previousMonth'>('previousMonth');
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    getDoc(doc(firestore, 'sync_settings', 'default')).then(snap => {
      if (snap.exists()) {
        const d = snap.data();
        setFrequency(d.frequency);
        const h = String(d.hour ?? 23).padStart(2, '0');
        const m = String(d.minute ?? 0).padStart(2, '0');
        setTime(`${h}:${m}`);
        setDayOfWeek(d.dayOfWeek ?? 0);
        setDayOfMonth(d.dayOfMonth ?? 1);
        setPeriod(d.period ?? 'previousMonth');
      }
    });
  }, []);

  const save = async () => {
    setSaveError(null);
    const [hour, minute] = time.split(':').map(Number);
    try {
      await api('/sync/settings', {
        method: 'POST',
        body: JSON.stringify({ frequency, hour, minute, dayOfWeek, dayOfMonth, period }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setSaveError(String(e));
    }
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 1 }}>Stažení dat z Jira</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Stáhne worklogy a absence z Jira a Activity Timeline do Firestore.
      </Typography>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Paper sx={{ p: 3, flex: 1 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Manuální sync</Typography>
          <DownloadForm />
        </Paper>

        <Box sx={{ flex: 1 }}>
          <SyncStatusCard />
        </Box>
      </Stack>

      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Plánovaný sync</Typography>
        {saved && <Alert severity="success" sx={{ mb: 2 }}>Nastavení uloženo a plánovaný sync aktualizován.</Alert>}
        {saveError && <Alert severity="error" sx={{ mb: 2 }}>{saveError}</Alert>}
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField select size="small" label="Frekvence" value={frequency} onChange={e => setFrequency(e.target.value as any)} sx={{ minWidth: 140 }}>
            {FREQ_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
          </TextField>
          {frequency === 'weekly' && (
            <TextField select size="small" label="Den v týdnu" value={dayOfWeek} onChange={e => setDayOfWeek(Number(e.target.value))} sx={{ minWidth: 140 }}>
              {DAYS_OF_WEEK.map((d, i) => <MenuItem key={i} value={i}>{d}</MenuItem>)}
            </TextField>
          )}
          {frequency === 'monthly' && (
            <TextField select size="small" label="Den v měsíci" value={dayOfMonth} onChange={e => setDayOfMonth(Number(e.target.value))} sx={{ minWidth: 140 }}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <MenuItem key={d} value={d}>{d}</MenuItem>)}
            </TextField>
          )}
          <TextField select size="small" label="Čas" value={time} onChange={e => setTime(e.target.value)} sx={{ minWidth: 110 }}>
            {TIME_OPTIONS.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Období" value={period} onChange={e => setPeriod(e.target.value as any)} sx={{ minWidth: 180 }}>
            {PERIOD_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
          </TextField>
          <Button variant="outlined" startIcon={<Save />} onClick={save}>Uložit nastavení</Button>
        </Stack>
      </Paper>
    </Box>
  );
}
