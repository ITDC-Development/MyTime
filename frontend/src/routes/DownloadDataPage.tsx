import { useEffect, useState } from 'react';
import { Box, Typography, Stack, Paper, TextField, MenuItem, Button, Alert } from '@mui/material';
import { Save } from '@mui/icons-material';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firestore } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
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

export function DownloadDataPage() {
  const { profile } = useAuth();
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [hour, setHour] = useState(23);
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [period, setPeriod] = useState<'currentMonth' | 'previousMonth'>('previousMonth');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getDoc(doc(firestore, 'sync_settings', 'default')).then(snap => {
      if (snap.exists()) {
        const d = snap.data();
        setFrequency(d.frequency); setHour(d.hour);
        setDayOfWeek(d.dayOfWeek ?? 0); setDayOfMonth(d.dayOfMonth ?? 1);
        setPeriod(d.period ?? 'previousMonth');
      }
    });
  }, []);

  const save = async () => {
    if (!profile) return;
    await setDoc(doc(firestore, 'sync_settings', 'default'), {
      frequency, hour, dayOfWeek, dayOfMonth, period,
      updatedAt: new Date().toISOString(),
      updatedBy: profile.uid,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
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
        {saved && <Alert severity="success" sx={{ mb: 2 }}>Nastavení uloženo.</Alert>}
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
          <TextField select size="small" label="Hodina" value={hour} onChange={e => setHour(Number(e.target.value))} sx={{ minWidth: 100 }}>
            {Array.from({ length: 24 }, (_, i) => i).map(h => <MenuItem key={h} value={h}>{String(h).padStart(2, '0')}:00</MenuItem>)}
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
