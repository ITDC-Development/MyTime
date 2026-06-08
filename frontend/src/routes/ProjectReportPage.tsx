import { useState, useMemo, useEffect } from 'react';
import { Box, Typography, Paper, Stack, Button, Grid, Card, CardContent } from '@mui/material';
import { Add, PictureAsPdf } from '@mui/icons-material';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { firestore } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useUsers } from '../hooks/useUsers';
import { useMembers } from '../hooks/useMembers';
import { useWorklogs } from '../hooks/useWorklogs';
import { useLock } from '../hooks/useLock';
import { usePreferences } from '../hooks/usePreferences';
import { currentMonth, monthLabel, monthRange } from '../utils/dateUtils';
import { formatHours } from '../utils/formatters';
import { totalWorkedHours } from '../utils/overtime';
import { filterPauses } from '../utils/pauseRules';
import { UserSelect } from '../components/common/UserSelect';
import { MonthSelect } from '../components/common/MonthSelect';
import { PauseToggle } from '../components/common/PauseToggle';
import { ColumnPickerDropdown } from '../components/common/ColumnPickerDropdown';
import { LockBadge } from '../components/common/LockBadge';
import { LockButton } from '../components/reports/LockButton';
import { WorklogTable } from '../components/reports/WorklogTable';
import { WorklogEditDialog } from '../components/reports/WorklogEditDialog';
import { ManualWorklogDialog } from '../components/reports/ManualWorklogDialog';
import { HistoryDialog } from '../components/reports/HistoryDialog';
import { deleteEditedWorklog } from '../components/services-bridge';
import { logEdit } from '../services/firestore/auditLog';
import { exportPdf, type PdfSummaryItem } from '../services/exporters/pdfExporter';
import type { LinearWorklog } from '../types/worklog';
import { type ColumnId, LOCKED_COLUMNS } from '../types/export';
import type { Absence } from '../types/jira';

export function ProjectReportPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const isFreelancer = profile?.role === 'freelancer';
  const ownAccount = profile?.jiraAccountId ?? null;
  const { users } = useUsers();
  const { members } = useMembers();
  const { preferences, update } = usePreferences();
  const { year: curY, month: curM } = currentMonth();
  const [year, setYear] = useState(curY);
  const [month, setMonth] = useState(curM);
  const [selected, setSelected] = useState<string[]>(
    isFreelancer && ownAccount ? [ownAccount] : (!isAdmin && preferences?.lastSelectedUser ? [preferences.lastSelectedUser] : [])
  );
  const [editTarget, setEditTarget] = useState<LinearWorklog | null>(null);
  const [historyTarget, setHistoryTarget] = useState<LinearWorklog | null>(null);
  const [manualOpen, setManualOpen] = useState(false);

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

  useEffect(() => {
    if (isFreelancer && ownAccount && !selected.includes(ownAccount)) setSelected([ownAccount]);
  }, [isFreelancer, ownAccount]);

  const accountIds = isAdmin && selected.length === 0 ? null : selected;
  const accountId = selected[0] ?? null;
  const { linear } = useWorklogs({ accountIds, year, month });


  // Absence pro výpočet fondu (jen pro freelancera)
  const [absences, setAbsences] = useState<Absence[]>([]);
  useEffect(() => {
    if (!isFreelancer || !accountId) { setAbsences([]); return; }
    const { from, to } = monthRange(year, month);
    const q = query(
      collection(firestore, 'absences'),
      where('accountId', '==', accountId),
      where('date', '>=', from),
      where('date', '<=', to)
    );
    return onSnapshot(q, snap => setAbsences(snap.docs.map(d => d.data() as Absence)));
  }, [isFreelancer, accountId, year, month]);

  const expectedHours = useMemo(() => {
    if (!isFreelancer) return 0;
    const { from, to } = monthRange(year, month);
    const holidayDates = new Set(absences.filter(a => a.type === 'HOLIDAY').map(a => a.date));
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
  }, [isFreelancer, year, month, absences]);

  const workedHours = useMemo(() => totalWorkedHours(linear), [linear]);

  const showPauses = preferences?.showPauses ?? true;
  const columns: ColumnId[] = useMemo(() => {
    const raw = (preferences?.columns.projectReport as string[]) ?? ['date', 'from', 'to', 'issue', 'name', 'hours'];
    const migrated = raw.flatMap((c): ColumnId[] => c === 'period' ? ['from', 'to'] : [c as ColumnId]);
    const nonLocked = migrated.filter(c => !LOCKED_COLUMNS.includes(c));
    return [...LOCKED_COLUMNS, ...nonLocked];
  }, [preferences]);
  const filtered = useMemo(() => filterPauses(linear, showPauses), [linear, showPauses]);
  const { isLocked, lockNow, unlockNow } = useLock(year, month, accountId);
  const selectedUser = users.find(u => u.jiraAccountId === accountId);

  const handleSelectionChange = (ids: string[]) => {
    const next = ids.slice(0, 1);
    setSelected(next);
    update({ lastSelectedUser: next[0] ?? null });
  };

  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const pdfRows = filtered.map(r => ({
    'Datum': r.date,
    'Od': fmt(r.startMinutes),
    'Do': fmt(r.endMinutes),
    'Hodiny': r.hours.toFixed(2),
    'Issue': r.issueKey,
    'Popis': r.summary,
  }));
  const pdfSummary: PdfSummaryItem[] = [
    { label: 'Odpracováno', value: `${formatHours(workedHours)} h` },
    { label: 'Fond', value: `${formatHours(expectedHours)} h` },
  ];

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="h4">Projektový výkaz</Typography>
        {accountId && <LockBadge locked={isLocked} />}
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Worklogy seřazené chronologicky na lineární časové ose 8:00–16:30.
      </Typography>

      <Paper sx={{ p: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }} alignItems={{ md: 'center' }} flexWrap="wrap">
          {isAdmin && <UserSelect jiraUsers={members.map(m => ({ accountId: m.accountId, name: m.displayName }))} value={selected} onChange={handleSelectionChange} />}
          <MonthSelect year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
          <PauseToggle checked={showPauses} onChange={v => update({ showPauses: v })} />
          <ColumnPickerDropdown
            selected={columns}
            onChange={cols => update({ columns: { ...preferences!.columns, projectReport: cols } })}
            exclude={['overtime']}
            locked={LOCKED_COLUMNS}
          />
        </Stack>

        {(accountId || (isAdmin && selected.length === 0)) ? (
          <>
            {isFreelancer && accountId && (
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={4}>
                  <Card sx={{ background: '#FAF7F0' }}>
                    <CardContent>
                      <Typography variant="caption" color="text.secondary">Odpracováno / Fond</Typography>
                      <Typography variant="h5" sx={{ mt: 0.5, fontWeight: 500 }}>
                        {formatHours(workedHours)} h / {formatHours(expectedHours)} h
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            )}

            {isFreelancer && accountId && (
              <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<PictureAsPdf />}
                  onClick={() => exportPdf(
                    pdfRows,
                    `projektovy-vyzkaz-${year}-${String(month).padStart(2, '0')}`,
                    `Projektový výkaz – ${selectedUser?.jiraDisplayName || selectedUser?.displayName || profile?.displayName} – ${monthLabel(year, month)}`,
                    pdfSummary
                  )}
                >
                  Stáhnout PDF
                </Button>
              </Stack>
            )}

            <WorklogTable
              rows={filtered}
              columns={columns}
              isLocked={isLocked || !isAdmin}
              onEdit={r => setEditTarget(r)}
              onHistory={r => setHistoryTarget(r)}
              onDeleteEdit={handleDeleteEdit}
            />
            {isAdmin && (
              <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                {!isLocked && (
                  <Button size="small" variant="outlined" startIcon={<Add />} onClick={() => setManualOpen(true)}>
                    Přidat ruční záznam
                  </Button>
                )}
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
            {isFreelancer ? 'Tvůj Jira účet zatím nebyl spárován administrátorem.' : 'Vyber zaměstnance, jehož výkaz chceš zobrazit.'}
          </Typography>
        )}
      </Paper>

      <WorklogEditDialog open={Boolean(editTarget)} worklog={editTarget} onClose={() => setEditTarget(null)} />
      <HistoryDialog open={Boolean(historyTarget)} worklogId={historyTarget?.worklogId ?? null} onClose={() => setHistoryTarget(null)} />
      {isAdmin && selectedUser && (
        <ManualWorklogDialog
          open={manualOpen}
          accountId={accountId!}
          user={selectedUser.displayName}
          date={`${year}-${String(month).padStart(2, '0')}-01`}
          onClose={() => setManualOpen(false)}
        />
      )}
    </Box>
  );
}
