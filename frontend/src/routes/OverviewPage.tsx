import { useState, useMemo, useEffect } from 'react';
import { Box, Typography, Paper, Stack, Alert, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';
import { useUsers } from '../hooks/useUsers';
import { useWorklogs } from '../hooks/useWorklogs';
import { usePreferences } from '../hooks/usePreferences';
import { currentMonth, monthLabel } from '../utils/dateUtils';
import { filterPauses } from '../utils/pauseRules';
import { formatPeriod, formatHours } from '../utils/formatters';
import { UserSelect } from '../components/common/UserSelect';
import { MonthSelect } from '../components/common/MonthSelect';
import { PauseToggle } from '../components/common/PauseToggle';
import { ColumnPicker } from '../components/common/ColumnPicker';
import { WorklogTable } from '../components/reports/WorklogTable';
import { ExportButtons } from '../components/export/ExportButtons';
import { ExportPresetManager } from '../components/export/ExportPresetManager';
import { setLocks } from '../services/firestore/locks';
import { ColumnId } from '../types/export';
import type { ExportPreset } from '../types/user';
import dayjs from 'dayjs';

export function OverviewPage() {
  const { profile } = useAuth();
  const { users } = useUsers();
  const { preferences, update } = usePreferences();
  const { year: curY, month: curM } = currentMonth();
  const [year, setYear] = useState(curY);
  const [month, setMonth] = useState(curM);
  const [selected, setSelected] = useState<string[]>([]);
  const [pending, setPending] = useState<null | (() => void)>(null);

  const isAdmin = profile?.role === 'admin';
  const accountIds = isAdmin && selected.length === 0 ? null : selected;
  const { linear } = useWorklogs({ accountIds, year, month });
  const showPauses = preferences?.showPauses ?? true;
  const stored = (preferences?.columns.overview as ColumnId[]) ?? ['user', 'date', 'period', 'issue', 'name', 'hours'];

  const [jiraUsers, setJiraUsers] = useState<{ accountId: string; name: string }[]>([]);
  useEffect(() => {
    if (isAdmin && accountIds === null && linear.length > 0) {
      setJiraUsers(
        Array.from(new Map(linear.map(w => [w.accountId, { accountId: w.accountId, name: w.user }])).values())
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    }
  }, [linear, accountIds, isAdmin]);

  const columns = useMemo(() => {
    if (selected.length > 1 && !stored.includes('user')) return ['user' as ColumnId, ...stored];
    return stored;
  }, [selected, stored]);

  const filtered = useMemo(() => filterPauses(linear, showPauses), [linear, showPauses]);

  const rowsForExport = useMemo(() =>
    filtered.map(r => {
      const obj: Record<string, unknown> = {};
      for (const c of columns) {
        obj[labelOf(c)] = renderForExport(r, c);
      }
      return obj;
    }), [filtered, columns]);

  const filename = useMemo(() => {
    const mm = String(month).padStart(2, '0');
    const yy = String(year).slice(-2);
    if (selected.length === 1) {
      const name = filtered.find(r => !r.isPause)?.user ?? '';
      if (name) return `${sanitizeName(name)}_${mm}_${yy}`;
    }
    if (selected.length > 1) {
      const name = filtered.find(r => !r.isPause)?.user ?? '';
      const prefix = name ? sanitizeName(name) : 'vykaz';
      return `${prefix}_a_dalsi_${mm}_${yy}`;
    }
    return `vykaz_${year}-${mm}`;
  }, [filtered, selected, year, month]);
  const title = `Výkaz · ${monthLabel(year, month)}`;

  const onBeforeExport = async () => {
    if (!profile || selected.length === 0) return;
    setPending(() => async () => {
      await setLocks(year, month, selected, profile.uid);
    });
    return new Promise<void>(resolve => {
      // dialog se otevře, po potvrzení uzamkne a resolve
      setPending(() => async () => { await setLocks(year, month, selected, profile.uid); resolve(); });
    });
  };

  // Jednoduší přístup: uzamkneme rovnou při exportu po potvrzení
  const exportWithLock = async () => {
    if (!profile) return;
    await setLocks(year, month, selected, profile.uid);
  };

  const [confirmExport, setConfirmExport] = useState<null | (() => void)>(null);

  const presets: ExportPreset[] = preferences?.exportPresets ?? [];

  const savePreset = (name: string) => {
    const next: ExportPreset[] = [
      ...presets,
      { id: crypto.randomUUID(), name, columns: stored },
    ];
    update({ exportPresets: next });
  };

  const deletePreset = (id: string) => {
    update({ exportPresets: presets.filter(p => p.id !== id) });
  };

  const loadPreset = (columns: ColumnId[]) => {
    update({ columns: { ...preferences!.columns, overview: columns } });
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 1 }}>Přehledy</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Vyber uživatele, měsíc a sloupce. Přepínač pauz se promítne i do exportu.
      </Typography>

      <Paper sx={{ p: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }} alignItems={{ md: 'center' }} flexWrap="wrap">
          {isAdmin
            ? <UserSelect jiraUsers={jiraUsers} value={selected} onChange={setSelected} multiple label="Uživatelé" />
            : <UserSelect users={users} value={selected} onChange={setSelected} multiple label="Uživatelé" />
          }
          <MonthSelect year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
          <PauseToggle checked={showPauses} onChange={v => update({ showPauses: v })} />
        </Stack>

        <ColumnPicker
          selected={stored}
          onChange={cols => update({ columns: { ...preferences!.columns, overview: cols } })}
        />
        <ExportPresetManager
          currentColumns={stored}
          presets={presets}
          onLoad={loadPreset}
          onSave={savePreset}
          onDelete={deletePreset}
        />

        {!isAdmin && selected.length === 0 ? (
          <Alert severity="info">Vyber alespoň jednoho uživatele pro zobrazení a export.</Alert>
        ) : (
          <>
            <WorklogTable rows={filtered} columns={columns} isLocked />
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Vybráno {selected.length} {selected.length === 1 ? 'zaměstnanec' : 'zaměstnanců'} · {filtered.filter(r => !r.isPause).length} worklogů
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Alert severity="warning" sx={{ py: 0 }}>Export zamkne období!</Alert>
                <ExportButtons rows={rowsForExport} filename={filename} title={title} onExport={async () => {
                  return new Promise<void>(resolve => {
                    setConfirmExport(() => async () => {
                      await exportWithLock();
                      setConfirmExport(null);
                      resolve();
                    });
                  });
                }} />
              </Stack>
            </Stack>
          </>
        )}
      </Paper>

      <Dialog open={Boolean(confirmExport)} onClose={() => setConfirmExport(null)}>
        <DialogTitle>Potvrzení exportu</DialogTitle>
        <DialogContent>
          <Typography>
            Tento export uzamkne období <strong>{monthLabel(year, month)}</strong> proti dalšímu syncu i editacím
            pro {selected.length} vybraných zaměstnanců. Pokračovat?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmExport(null)}>Zrušit</Button>
          <Button variant="contained" onClick={() => confirmExport && confirmExport()}>Exportovat a zamknout</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function labelOf(c: ColumnId): string {
  return { user: 'Uživatel', date: 'Datum', period: 'Období', issue: 'Issue', name: 'Název', parent: 'Parent',
    sprint: 'Sprint', component: 'Komponenta', hours: 'Hodiny', comment: 'Komentář', overtime: 'Přesčas' }[c];
}

function sanitizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9]/g, '');
}

function decodeHtml(s: string): string {
  const t = document.createElement('textarea');
  t.innerHTML = s;
  return t.value;
}

function renderForExport(r: { user: string; date: string; startMinutes: number; endMinutes: number; issueKey: string; summary: string; parentKey: string; parentSummary: string; sprint: string; components: string[]; hours: number; comment: string; isOvertime: boolean; isPause: boolean; }, c: ColumnId): string {
  switch (c) {
    case 'user': return r.user;
    case 'date': return dayjs(r.date).format('DD. MM. YYYY');
    case 'period': return formatPeriod(r.startMinutes, r.endMinutes);
    case 'issue': return r.isPause ? decodeHtml(r.summary) : (r.issueKey || '');
    case 'name': return r.isPause ? '' : decodeHtml(r.summary);
    case 'parent': return r.parentKey ? `${r.parentKey} ${decodeHtml(r.parentSummary)}` : '';
    case 'sprint': return decodeHtml(r.sprint);
    case 'component': return r.components.map(decodeHtml).join(', ');
    case 'hours': return r.isPause ? '' : formatHours(r.hours);
    case 'comment': return decodeHtml(r.comment);
    case 'overtime': return r.isOvertime ? formatHours(r.hours) : '';
  }
}
