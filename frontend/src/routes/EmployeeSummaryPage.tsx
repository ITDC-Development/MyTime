import { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Paper, Stack, Grid, Card, CardContent, Table, TableHead, TableBody, TableRow, TableCell, Chip, Alert, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { firestore } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useWorklogs } from '../hooks/useWorklogs';
import { useMembers } from '../hooks/useMembers';
import { usePublicHolidays } from '../hooks/usePublicHolidays';
import { UserSelect } from '../components/common/UserSelect';
import { MonthSelect } from '../components/common/MonthSelect';
import { currentMonth, monthRange, formatDateFull } from '../utils/dateUtils';
import { formatHours } from '../utils/formatters';
import { overtimeStats, totalWorkedHours } from '../utils/overtime';
import type { Absence } from '../types/jira';

const ABSENCE_LABEL: Record<Absence['type'], string> = {
  VACATION: 'Dovolená',
  SICK_LEAVE: 'Nemoc',
  DAY_OFF: 'Volno',
  HOLIDAY: 'Svátek',
};

const ABSENCE_COLOR: Record<Absence['type'], 'primary' | 'error' | 'warning' | 'default'> = {
  VACATION: 'primary',
  SICK_LEAVE: 'error',
  DAY_OFF: 'warning',
  HOLIDAY: 'default',
};

export function EmployeeSummaryPage() {
  const { profile } = useAuth();
  const { year: curY, month: curM } = currentMonth();
  const [year, setYear] = useState(curY);
  const [month, setMonth] = useState(curM);

  const isAdmin = profile?.role === 'admin';
  const { members } = useMembers();
  const ownAccount = profile?.jiraAccountId ?? null;
  const [selected, setSelected] = useState<string[]>(!isAdmin && ownAccount ? [ownAccount] : []);
  const [countryFilter, setCountryFilter] = useState<'all' | 'CZ' | 'SK'>('all');

  useEffect(() => {
    if (!isAdmin && ownAccount && !selected.includes(ownAccount)) setSelected([ownAccount]);
  }, [isAdmin, ownAccount]);

  useEffect(() => {
    if (countryFilter === 'all' || selected.length === 0) return;
    const member = members.find(m => m.accountId === selected[0]);
    if (member?.country !== countryFilter) setSelected([]);
  }, [countryFilter]);

  const accountId = selected[0] ?? null;
  const accountIds = isAdmin && selected.length === 0 ? null : selected;
  const { linear } = useWorklogs({ accountIds, year, month });

  const memberCountry = useMemo(
    () => members.find(m => m.accountId === accountId)?.country ?? null,
    [members, accountId]
  );
  const publicHolidays = usePublicHolidays(year, memberCountry);

  const employeeMembers = useMemo(
    () => members
      .filter(m => m.role === 'user' && (countryFilter === 'all' || m.country === countryFilter))
      .map(m => ({ accountId: m.accountId, name: m.displayName })),
    [members, countryFilter]
  );
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [absenceError, setAbsenceError] = useState<string | null>(null);

  useEffect(() => {
    if (!accountId) { setAbsences([]); return; }
    const { from, to } = monthRange(year, month);
    const q = query(
      collection(firestore, 'absences'),
      where('accountId', '==', accountId),
      where('date', '>=', from),
      where('date', '<=', to)
    );
    return onSnapshot(q,
      snap => {
        setAbsenceError(null);
        setAbsences(snap.docs.map(d => d.data() as Absence));
      },
      err => setAbsenceError(`Firestore chyba: ${err.message}`)
    );
  }, [accountId, year, month]);

  const expectedHours = useMemo(() => {
    const { from, to } = monthRange(year, month);
    const atHolidays = new Set(absences.filter(a => a.type === 'HOLIDAY').map(a => a.date));
    const holidayDates = atHolidays.size > 0 ? atHolidays : publicHolidays;
    let workingDays = 0;
    const cur = new Date(from + 'T00:00:00Z');
    const end = new Date(to + 'T00:00:00Z');
    while (cur <= end) {
      const dow = cur.getUTCDay();
      const dateStr = cur.toISOString().slice(0, 10);
      if (dow !== 0 && dow !== 6 && !holidayDates.has(dateStr)) workingDays++;
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return workingDays * 8;
  }, [year, month, absences, publicHolidays]);

  const stats = useMemo(() => {
    const ot = overtimeStats(linear);
    const vacationHours = absences.filter(a => a.type === 'VACATION' || a.type === 'DAY_OFF').reduce((sum, a) => sum + a.hours, 0);
    const sickHours = absences.filter(a => a.type === 'SICK_LEAVE').reduce((sum, a) => sum + a.hours, 0);
    const workedHours = totalWorkedHours(linear);
    const overtimeHours = Math.max(0, workedHours + vacationHours - expectedHours);
    return {
      totalHours: workedHours,
      overtimeHours,
      daysWithOvertime: ot.daysWithOvertime,
      vacationHours,
      sickHours,
    };
  }, [linear, absences, expectedHours]);

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 1 }}>Přehled zaměstnance</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Souhrn odpracovaných hodin, dovolené a přesčasů.
      </Typography>

      <Paper sx={{ p: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }} alignItems={{ md: 'center' }}>
          {isAdmin && (
            <ToggleButtonGroup
              size="small"
              exclusive
              value={countryFilter}
              onChange={(_, v) => { if (v) setCountryFilter(v); }}
            >
              <ToggleButton value="all">Vše</ToggleButton>
              <ToggleButton value="CZ">CZ</ToggleButton>
              <ToggleButton value="SK">SK</ToggleButton>
            </ToggleButtonGroup>
          )}
          {isAdmin && <UserSelect jiraUsers={employeeMembers} value={selected} onChange={ids => setSelected(ids.slice(0, 1))} />}
          <MonthSelect year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
        </Stack>

        {absenceError && (
          <Alert severity="error" sx={{ mb: 2 }}>{absenceError}</Alert>
        )}

        {accountId ? (
          <>
            <Grid container spacing={2}>
              <Metric label="Odpracováno / Fond" value={`${formatHours(stats.totalHours)} h / ${formatHours(expectedHours)} h`} />
              <Metric label="Dovolená" value={`${formatHours(stats.vacationHours)} h`} />
              <Metric label="Nemoc" value={`${formatHours(stats.sickHours)} h`} />
              <Metric label="Přesčas" value={`${formatHours(stats.overtimeHours)} h`} />
            </Grid>

            {absences.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                  Absence v tomto měsíci
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Datum</TableCell>
                      <TableCell>Typ</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {[...absences].sort((a, b) => a.date.localeCompare(b.date)).map(a => (
                      <TableRow key={a.id}>
                        <TableCell>{formatDateFull(a.date)}</TableCell>
                        <TableCell>
                          <Chip
                            label={ABSENCE_LABEL[a.type]}
                            color={ABSENCE_COLOR[a.type]}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </>
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
    <Grid item xs={12} sm={6} md={3}>
      <Card sx={{ background: '#f8f9f9' }}>
        <CardContent>
          <Typography variant="caption" color="text.secondary">{label}</Typography>
          <Typography variant="h5" sx={{ mt: 0.5, fontWeight: 500 }}>{value}</Typography>
        </CardContent>
      </Card>
    </Grid>
  );
}
