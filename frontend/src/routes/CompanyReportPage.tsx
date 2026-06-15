import { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Paper, Stack, Grid, Card, CardContent, Alert, Button, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { PictureAsPdf } from '@mui/icons-material';
import { exportPdf, exportPdfBulk, type PdfSummaryItem, type PdfSection } from '../services/exporters/pdfExporter';
import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { firestore } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useUsers } from '../hooks/useUsers';
import { useMembers } from '../hooks/useMembers';
import { useWorklogs } from '../hooks/useWorklogs';
import { useLock } from '../hooks/useLock';
import { usePublicHolidays } from '../hooks/usePublicHolidays';
import { usePreferences } from '../hooks/usePreferences';
import { currentMonth, monthLabel, monthRange } from '../utils/dateUtils';
import { formatHours } from '../utils/formatters';
import { overtimeStats, totalWorkedHours } from '../utils/overtime';
import { UserSelect } from '../components/common/UserSelect';
import { MonthSelect } from '../components/common/MonthSelect';
import { ColumnPickerDropdown } from '../components/common/ColumnPickerDropdown';
import { LockBadge } from '../components/common/LockBadge';
import { LockButton } from '../components/reports/LockButton';
import { WorklogTable } from '../components/reports/WorklogTable';
import { WorklogEditDialog } from '../components/reports/WorklogEditDialog';
import { HistoryDialog } from '../components/reports/HistoryDialog';
import { deleteEditedWorklog } from '../components/services-bridge';
import { logEdit } from '../services/firestore/auditLog';
import type { LinearWorklog } from '../types/worklog';
import { type ColumnId, LOCKED_COLUMNS } from '../types/export';
import type { Absence } from '../types/jira';

export function CompanyReportPage() {
  const { profile } = useAuth();
  const { users } = useUsers();
  const { members } = useMembers();
  const { preferences, update } = usePreferences();
  const { year: curY, month: curM } = currentMonth();
  const [year, setYear] = useState(curY);
  const [month, setMonth] = useState(curM);

  const isAdmin = profile?.role === 'admin';
  const isFreelancer = profile?.role === 'freelancer';
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

  const accountIds = isAdmin && selected.length === 0 ? null : selected;
  const accountId = selected[0] ?? null;

  const memberCountry = useMemo(
    () => members.find(m => m.accountId === accountId)?.country ?? null,
    [members, accountId]
  );
  const publicHolidays = usePublicHolidays(year, memberCountry);

  const [editTarget, setEditTarget] = useState<LinearWorklog | null>(null);
  const [historyTarget, setHistoryTarget] = useState<LinearWorklog | null>(null);
  const [isBulkExporting, setIsBulkExporting] = useState(false);

  const handleDeleteEdit = async (worklog: LinearWorklog) => {
    if (!profile) return;
    await deleteEditedWorklog(worklog.worklogId);
    await logEdit({
      worklogId: worklog.worklogId,
      user: worklog.user,
      accountId: worklog.accountId,
      changedAt: new Date().toISOString(),
      changedBy: profile.uid,
      changedByEmail: profile.email,
      action: 'revert',
      before: {
        seconds: Math.round(worklog.hours * 3600),
        date: worklog.date,
        issueKey: worklog.issueKey,
        summary: worklog.summary,
        parentKey: worklog.parentKey,
        parentSummary: worklog.parentSummary,
        sprint: worklog.sprint,
        components: worklog.components,
        comment: worklog.comment,
      },
      after: {},
    });
  };
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  const handleBulkExport = async () => {
    setIsBulkExporting(true);
    try {
      const { from, to } = monthRange(year, month);

      const employeesToExport = members
        .filter(m => m.role === 'user' && (countryFilter === 'all' || m.country === countryFilter))
        .sort((a, b) => a.displayName.localeCompare(b.displayName, 'cs'));
      if (employeesToExport.length === 0) return;

      const exportAccountIds = new Set(employeesToExport.map(m => m.accountId));

      // Stáhni svátky z nager.at pro CZ a SK najednou jako fallback
      const fetchNagerHolidays = async (country: 'CZ' | 'SK') => {
        try {
          const r = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`);
          if (!r.ok) return new Set<string>();
          const data: { date: string }[] = await r.json();
          return new Set(data.map(h => h.date));
        } catch { return new Set<string>(); }
      };
      const [czHolidays, skHolidays] = await Promise.all([fetchNagerHolidays('CZ'), fetchNagerHolidays('SK')]);

      // Načti absence pro všechny zaměstnance najednou (Firestore 'in' max 30)
      const allAbsences: import('../types/jira').Absence[] = [];
      const ids = employeesToExport.map(m => m.accountId);
      for (let i = 0; i < ids.length; i += 30) {
        const snap = await getDocs(query(
          collection(firestore, 'absences'),
          where('accountId', 'in', ids.slice(i, i + 30)),
          where('date', '>=', from),
          where('date', '<=', to),
        ));
        allAbsences.push(...snap.docs.map(d => d.data() as import('../types/jira').Absence));
      }

      // Seskup linear záznamy podle zaměstnance
      const linearByAccount = new Map<string, typeof linear>();
      for (const row of linear) {
        if (!exportAccountIds.has(row.accountId) || row.isPause) continue;
        if (!linearByAccount.has(row.accountId)) linearByAccount.set(row.accountId, []);
        linearByAccount.get(row.accountId)!.push(row);
      }

      const sections: PdfSection[] = [];
      for (const emp of employeesToExport) {
        const empRows = linearByAccount.get(emp.accountId) ?? [];
        if (empRows.length === 0) continue;

        const empAbsences = allAbsences.filter(a => a.accountId === emp.accountId);
        const atHolidays = new Set(empAbsences.filter(a => a.type === 'HOLIDAY').map(a => a.date));
        const fallback = emp.country === 'CZ' ? czHolidays : emp.country === 'SK' ? skHolidays : new Set<string>();
        const holidayDates = atHolidays.size > 0 ? atHolidays : fallback;

        let workingDays = 0;
        const cur = new Date(from + 'T00:00:00Z');
        const end = new Date(to + 'T00:00:00Z');
        while (cur <= end) {
          const dow = cur.getUTCDay();
          const ds = cur.toISOString().slice(0, 10);
          if (dow !== 0 && dow !== 6 && !holidayDates.has(ds)) workingDays++;
          cur.setUTCDate(cur.getUTCDate() + 1);
        }
        const expectedH = workingDays * 8;
        const vacH = empAbsences.filter(a => a.type === 'VACATION' || a.type === 'DAY_OFF').reduce((s, a) => s + a.hours, 0);
        const sickH = empAbsences.filter(a => a.type === 'SICK_LEAVE').reduce((s, a) => s + a.hours, 0);
        const workedH = totalWorkedHours(empRows);
        const overtimeH = Math.max(0, workedH + vacH - expectedH);

        sections.push({
          name: emp.displayName,
          summary: [
            { label: 'Odpracováno / Fond', value: `${formatHours(workedH)} h / ${formatHours(expectedH)} h` },
            { label: 'Dovolená', value: `${formatHours(vacH)} h` },
            { label: 'Nemoc', value: `${formatHours(sickH)} h` },
            { label: 'Přesčas', value: `${formatHours(overtimeH)} h` },
          ],
          rows: empRows.map(r => ({
            'Datum': r.date,
            'Od': fmt(r.startMinutes),
            'Do': fmt(r.endMinutes),
            'Hodiny': r.hours.toFixed(2),
            'Issue': r.issueKey,
            'Popis': r.summary,
          })),
        });
      }

      const label = countryFilter === 'all' ? 'vsichni' : countryFilter.toLowerCase();
      const titleLabel = countryFilter === 'all' ? 'Všichni zaměstnanci' : `Zaměstnanci ${countryFilter}`;
      await exportPdfBulk(
        sections,
        `dochazka-${label}-${year}-${String(month).padStart(2, '0')}`,
        `Docházka – ${titleLabel} – ${monthLabel(year, month)}`,
      );
    } finally {
      setIsBulkExporting(false);
    }
  };

  const { linear } = useWorklogs({ accountIds, year, month });

  const freelancerAccountIds = useMemo(
    () => new Set(users.filter(u => u.role === 'freelancer' && u.jiraAccountId).map(u => u.jiraAccountId!)),
    [users]
  );

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
      snap => { setAbsenceError(null); setAbsences(snap.docs.map(d => d.data() as Absence)); },
      err => setAbsenceError(`Chyba při načítání absencí: ${err.message}`)
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

  const visibleLinear = useMemo(
    () => isAdmin && !accountId ? linear.filter(r => !freelancerAccountIds.has(r.accountId)) : linear,
    [linear, isAdmin, accountId, freelancerAccountIds]
  );

  const absenceRows = useMemo(() =>
    absences
      .filter(a => a.type !== 'HOLIDAY')
      .map(a => ({
        worklogId: `absence-${a.id}`,
        accountId: a.accountId,
        user: a.user,
        date: a.date,
        startMinutes: 8 * 60,
        endMinutes: 8 * 60 + a.hours * 60,
        hours: a.hours,
        summary: a.type === 'SICK_LEAVE' ? 'Nemoc' : 'Dovolená',
        issueKey: '', parentKey: '', parentSummary: '', parentIssueType: '',
        components: [], sprint: '', comment: '',
        isOvertime: false, isPause: false, isEdited: false, isManual: false,
        issueType: '', priority: '',
        isAbsence: true as const,
        absenceType: a.type,
      })),
    [absences]
  );

  const shiftedLinear = useMemo(() => {
    const shiftByDate: Record<string, number> = {};
    for (const a of absences) {
      if (a.type !== 'HOLIDAY') {
        shiftByDate[a.date] = (shiftByDate[a.date] ?? 0) + a.hours * 60;
      }
    }
    return visibleLinear.map(row => {
      const shift = shiftByDate[row.date] ?? 0;
      if (shift === 0) return row;
      return { ...row, startMinutes: row.startMinutes + shift, endMinutes: row.endMinutes + shift };
    });
  }, [visibleLinear, absences]);

  const combinedRows = useMemo(() =>
    [...shiftedLinear, ...absenceRows].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      if (a.isAbsence !== b.isAbsence) return a.isAbsence ? -1 : 1;
      return a.startMinutes - b.startMinutes;
    }),
    [shiftedLinear, absenceRows]
  );

  const columns: ColumnId[] = useMemo(() => {
    const raw = (preferences?.columns.companyReport as string[]) ?? ['date', 'from', 'to', 'issue', 'name', 'hours'];
    const migrated = raw.flatMap((c): ColumnId[] => c === 'period' ? ['from', 'to'] : c === 'parent' ? ['parentKey', 'parentName'] : [c as ColumnId]);
    const nonLocked = migrated.filter(c => !LOCKED_COLUMNS.includes(c));
    return [...LOCKED_COLUMNS, ...nonLocked];
  }, [preferences]);
  const { isLocked, lockNow, unlockNow } = useLock(year, month, accountId);

  const selectedUserName = useMemo(() => {
    if (!accountId) return '';
    return users.find(u => u.jiraAccountId === accountId)?.displayName
      ?? linear.find(r => !r.isPause)?.user
      ?? accountId;
  }, [accountId, users, linear]);

  const pdfRows = linear
    .filter(r => !r.isPause)
    .map(r => ({
      'Datum': r.date,
      'Od': fmt(r.startMinutes),
      'Do': fmt(r.endMinutes),
      'Hodiny': r.hours.toFixed(2),
      'Issue': r.issueKey,
      'Popis': r.summary,
    }));
  const pdfSummary: PdfSummaryItem[] = [
    { label: 'Odpracováno / Fond', value: `${formatHours(stats.totalHours)} h / ${formatHours(expectedHours)} h` },
    { label: 'Dovolená', value: `${formatHours(stats.vacationHours)} h` },
    { label: 'Nemoc', value: `${formatHours(stats.sickHours)} h` },
    { label: 'Přesčas', value: `${formatHours(stats.overtimeHours)} h` },
    { label: 'Dnů s přesčasem', value: `${stats.daysWithOvertime}` },
  ];

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="h4">Docházka</Typography>
        {accountId && <LockBadge locked={isLocked} />}
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Přehled docházky s povinnou polední pauzou 12:00–12:30.
      </Typography>

      <Paper sx={{ p: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }} alignItems={{ md: 'center' }} flexWrap="wrap">
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
          {isAdmin && <UserSelect jiraUsers={employeeMembers} value={selected} onChange={ids => {
            const next = ids.slice(0, 1); setSelected(next); update({ lastSelectedUser: next[0] ?? null });
          }} />}
          <MonthSelect year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
          <ColumnPickerDropdown
            selected={columns}
            onChange={cols => update({ columns: { ...preferences!.columns, companyReport: cols } })}
            locked={LOCKED_COLUMNS}
          />
        </Stack>

        {absenceError && <Alert severity="error" sx={{ mb: 2 }}>{absenceError}</Alert>}

        {(accountId || (isAdmin && selected.length === 0)) ? (
          <>
            {accountId && (
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Metric label="Odpracováno / Fond" value={`${formatHours(stats.totalHours)} h / ${formatHours(expectedHours)} h`} />
                <Metric label="Dovolená" value={`${formatHours(stats.vacationHours)} h`} />
                <Metric label="Nemoc" value={`${formatHours(stats.sickHours)} h`} />
                <Metric label="Přesčas" value={`${formatHours(stats.overtimeHours)} h`} />
              </Grid>
            )}
            <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mb: 1 }}>
              {accountId && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<PictureAsPdf />}
                  onClick={() => exportPdf(pdfRows, `dochazka-${year}-${String(month).padStart(2, '0')}`, `Docházka – ${selectedUserName} – ${monthLabel(year, month)}`, pdfSummary)}
                >
                  Stáhnout PDF
                </Button>
              )}
              {isAdmin && !accountId && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<PictureAsPdf />}
                  disabled={isBulkExporting}
                  onClick={handleBulkExport}
                >
                  {isBulkExporting ? 'Generuji PDF…' : `Exportovat ${countryFilter === 'all' ? 'vše' : countryFilter} PDF`}
                </Button>
              )}
            </Stack>
            <WorklogTable
              rows={combinedRows}
              columns={columns}
              isLocked={isLocked || !isAdmin}
              showOvertime
              onEdit={r => setEditTarget(r)}
              onHistory={r => setHistoryTarget(r)}
              onDeleteEdit={handleDeleteEdit}
            />
            {isAdmin && (
              <Stack direction="row" sx={{ mt: 2 }}>
                <LockButton
                  locked={isLocked}
                  onToggle={async () => isLocked ? unlockNow(accountId) : lockNow(accountId)}
                  monthLabel={monthLabel(year, month)}
                />
              </Stack>
            )}
          </>
        ) : (
          <Typography color="text.secondary">
            {isAdmin ? 'Vyber zaměstnance, jehož docházku chceš zobrazit.' : 'Tvůj Jira účet zatím nebyl spárován administrátorem.'}
          </Typography>
        )}
      </Paper>

      <WorklogEditDialog open={Boolean(editTarget)} worklog={editTarget} onClose={() => setEditTarget(null)} />
      <HistoryDialog open={Boolean(historyTarget)} worklogId={historyTarget?.worklogId ?? null} onClose={() => setHistoryTarget(null)} />
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
