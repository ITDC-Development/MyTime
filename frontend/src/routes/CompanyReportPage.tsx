import { useState, useEffect } from 'react';
import { Box, Typography, Paper, Stack } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { useUsers } from '../hooks/useUsers';
import { useWorklogs } from '../hooks/useWorklogs';
import { useLock } from '../hooks/useLock';
import { usePreferences } from '../hooks/usePreferences';
import { currentMonth, monthLabel } from '../utils/dateUtils';
import { UserSelect } from '../components/common/UserSelect';
import { MonthSelect } from '../components/common/MonthSelect';
import { ColumnPickerDropdown } from '../components/common/ColumnPickerDropdown';
import { LockBadge } from '../components/common/LockBadge';
import { LockButton } from '../components/reports/LockButton';
import { WorklogTable } from '../components/reports/WorklogTable';
import { WorklogEditDialog } from '../components/reports/WorklogEditDialog';
import { HistoryDialog } from '../components/reports/HistoryDialog';
import type { LinearWorklog } from '../types/worklog';
import type { ColumnId } from '../types/export';

export function CompanyReportPage() {
  const { profile } = useAuth();
  const { users } = useUsers();
  const { preferences, update } = usePreferences();
  const { year: curY, month: curM } = currentMonth();
  const [year, setYear] = useState(curY);
  const [month, setMonth] = useState(curM);

  const isAdmin = profile?.role === 'admin';
  const ownAccount = profile?.jiraAccountId ?? null;
  const [selected, setSelected] = useState<string[]>(!isAdmin && ownAccount ? [ownAccount] : []);

  useEffect(() => {
    if (!isAdmin && ownAccount && !selected.includes(ownAccount)) setSelected([ownAccount]);
  }, [isAdmin, ownAccount]);

  const accountIds = isAdmin && selected.length === 0 ? null : selected;

  const [editTarget, setEditTarget] = useState<LinearWorklog | null>(null);
  const [historyTarget, setHistoryTarget] = useState<LinearWorklog | null>(null);
  const { linear } = useWorklogs({ accountIds, year, month });

  const [jiraUsers, setJiraUsers] = useState<{ accountId: string; name: string }[]>([]);
  useEffect(() => {
    if (isAdmin && accountIds === null && linear.length > 0) {
      setJiraUsers(
        Array.from(new Map(linear.map(w => [w.accountId, { accountId: w.accountId, name: w.user }])).values())
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    }
  }, [linear, accountIds, isAdmin]);
  const columns: ColumnId[] = (preferences?.columns.companyReport as ColumnId[]) ?? ['date', 'period', 'issue', 'name', 'hours'];
  const filtered = linear;
  const accountId = selected[0] ?? null;
  const { isLocked, lockNow, unlockNow } = useLock(year, month, accountId);

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="h4">Firemní výkaz</Typography>
        {accountId && <LockBadge locked={isLocked} />}
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Pohled pro firemní účely s povinnou polední pauzou 12:00–12:30.
      </Typography>

      <Paper sx={{ p: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }} alignItems={{ md: 'center' }} flexWrap="wrap">
          {isAdmin && <UserSelect jiraUsers={jiraUsers} value={selected} onChange={ids => {
            const next = ids.slice(0, 1); setSelected(next); update({ lastSelectedUser: next[0] ?? null });
          }} />}
          <MonthSelect year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
          <ColumnPickerDropdown
            selected={columns}
            onChange={cols => update({ columns: { ...preferences!.columns, companyReport: cols } })}
          />
        </Stack>

        {(accountId || (isAdmin && selected.length === 0)) ? (
          <>
            <WorklogTable
              rows={filtered}
              columns={columns}
              isLocked={isLocked || !isAdmin}
              showOvertime
              onEdit={r => setEditTarget(r)}
              onHistory={r => setHistoryTarget(r)}
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
            {isAdmin ? 'Vyber zaměstnance, jehož výkaz chceš zobrazit.' : 'Tvůj Jira účet zatím nebyl spárován administrátorem.'}
          </Typography>
        )}
      </Paper>

      <WorklogEditDialog open={Boolean(editTarget)} worklog={editTarget} onClose={() => setEditTarget(null)} />
      <HistoryDialog open={Boolean(historyTarget)} worklogId={historyTarget?.worklogId ?? null} onClose={() => setHistoryTarget(null)} />
    </Box>
  );
}
