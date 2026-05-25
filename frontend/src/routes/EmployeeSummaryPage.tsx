import { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Paper, Stack, Grid, Card, CardContent } from '@mui/material';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { firestore } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useUsers } from '../hooks/useUsers';
import { useWorklogs } from '../hooks/useWorklogs';
import { UserSelect } from '../components/common/UserSelect';
import { MonthSelect } from '../components/common/MonthSelect';
import { currentMonth, monthRange } from '../utils/dateUtils';
import { formatHours } from '../utils/formatters';
import { overtimeStats, totalWorkedHours } from '../utils/overtime';
import type { Absence } from '../types/jira';

export function EmployeeSummaryPage() {
  const { profile } = useAuth();
  const { users } = useUsers();
  const { year: curY, month: curM } = currentMonth();
  const [year, setYear] = useState(curY);
  const [month, setMonth] = useState(curM);

  const isAdmin = profile?.role === 'admin';
  const ownAccount = profile?.jiraAccountId ?? null;
  const [selected, setSelected] = useState<string[]>(ownAccount ? [ownAccount] : []);

  useEffect(() => {
    if (!isAdmin && ownAccount && !selected.includes(ownAccount)) setSelected([ownAccount]);
  }, [isAdmin, ownAccount]);

  const accountId = selected[0] ?? null;
  const { linear } = useWorklogs({ accountIds: selected, year, month });
  const [absences, setAbsences] = useState<Absence[]>([]);

  useEffect(() => {
    if (!accountId) { setAbsences([]); return; }
    const { from, to } = monthRange(year, month);
    const q = query(
      collection(firestore, 'absences'),
      where('accountId', '==', accountId),
      where('date', '>=', from),
      where('date', '<=', to)
    );
    return onSnapshot(q, snap => {
      setAbsences(snap.docs.map(d => d.data() as Absence));
    });
  }, [accountId, year, month]);

  const stats = useMemo(() => {
    const ot = overtimeStats(linear);
    return {
      totalHours: totalWorkedHours(linear),
      overtimeHours: ot.totalOvertimeHours,
      daysWithOvertime: ot.daysWithOvertime,
      vacationDays: absences.filter(a => a.type === 'VACATION').length,
      sickDays: absences.filter(a => a.type === 'SICK_LEAVE').length,
      dayOffDays: absences.filter(a => a.type === 'DAY_OFF').length,
    };
  }, [linear, absences]);

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 1 }}>Přehled zaměstnance</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Souhrn odpracovaných hodin, dovolené a přesčasů.
      </Typography>

      <Paper sx={{ p: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }} alignItems={{ md: 'center' }}>
          {isAdmin && <UserSelect users={users} value={selected} onChange={ids => setSelected(ids.slice(0, 1))} />}
          <MonthSelect year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
        </Stack>

        {accountId ? (
          <Grid container spacing={2}>
            <Metric label="Celkem odpracováno" value={`${formatHours(stats.totalHours)} h`} />
            <Metric label="Dovolená" value={`${stats.vacationDays} dní`} />
            <Metric label="Přesčas" value={`${formatHours(stats.overtimeHours)} h`} />
            <Metric label="Dnů s přesčasem" value={`${stats.daysWithOvertime}`} />
            <Metric label="Nemoc" value={`${stats.sickDays} dní`} />
            <Metric label="Volno" value={`${stats.dayOffDays} dní`} />
          </Grid>
        ) : (
          <Typography color="text.secondary">
            {isAdmin ? 'Vyber zaměstnance.' : 'Tvůj Jira účet zatím nebyl spárován.'}
          </Typography>
        )}
      </Paper>
    </Box>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Grid item xs={12} sm={6} md={4}>
      <Card sx={{ background: '#FAF7F0' }}>
        <CardContent>
          <Typography variant="caption" color="text.secondary">{label}</Typography>
          <Typography variant="h5" sx={{ mt: 0.5, fontWeight: 500 }}>{value}</Typography>
        </CardContent>
      </Card>
    </Grid>
  );
}
