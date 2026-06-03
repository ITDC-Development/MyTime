import { useState, useMemo } from 'react';
import {
  Box, Typography, Paper, Stack, Button, TextField, MenuItem, Select,
  FormControl, InputLabel, Chip, OutlinedInput, CircularProgress, Alert,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
} from '@mui/material';
import { AutoAwesome } from '@mui/icons-material';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { firestore } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { UserSelect } from '../components/common/UserSelect';
import { api } from '../services/api';
import { ExportButtons } from '../components/export/ExportButtons';
import type { RawWorklog } from '../types/worklog';

type SmartReportRow = { _values: Record<string, number> } & Record<string, string>;
interface SmartReportResponse { columns: { key: string; label: string }[]; rows: SmartReportRow[]; }
interface JiraUser { accountId: string; name: string; }

// ─── Konstanty ──────────────────────────────────────────────────────────────

const TIME_GROUPINGS = [
  { value: 'day',     label: 'Po dnech' },
  { value: 'week',    label: 'Po týdnech' },
  { value: 'month',   label: 'Po měsících' },
  { value: 'quarter', label: 'Po čtvrtletích' },
  { value: 'year',    label: 'Po letech' },
] as const;

const DIMENSION_OPTIONS = [
  { value: 'user',          label: 'Uživatel' },
  { value: 'parentSummary', label: 'Projekt (název)' },
  { value: 'parentKey',     label: 'Projekt (klíč)' },
  { value: 'issueKey',      label: 'Issue' },
  { value: 'sprint',        label: 'Sprint' },
  { value: 'components',    label: 'Komponenta' },
  { value: 'issueType',     label: 'Typ (Bug/Task…)' },
  { value: 'priority',      label: 'Priorita' },
];

const NONE = '(nevybráno)';

type TimeGrouping = 'day' | 'week' | 'month' | 'quarter' | 'year';

function currentMonthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { from, to };
}

// ─── Komponenta ──────────────────────────────────────────────────────────────

export function SmartReportsPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const ownAccountId = profile?.jiraAccountId ?? null;

  // Panel 1 – datum
  const defaultRange = currentMonthRange();
  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo,   setDateTo]   = useState(defaultRange.to);
  const [loadingData, setLoadingData] = useState(false);
  const [dataLoaded,  setDataLoaded]  = useState(false);

  // Načtená data + odvozené seznamy
  const [rawWorklogs, setRawWorklogs] = useState<RawWorklog[]>([]);
  const [jiraUsers,   setJiraUsers]   = useState<JiraUser[]>([]);

  // Panel 2 – konfigurace
  const [selUsers,      setSelUsers]      = useState<string[]>([]);
  const [selComponents, setSelComponents] = useState<string[]>([]);
  const [selParents,    setSelParents]    = useState<string[]>([]);
  const [timeGrouping,  setTimeGrouping]  = useState<TimeGrouping>('month');
  const [dim1, setDim1] = useState('parentSummary');
  const [dim2, setDim2] = useState('user');
  const [dim3, setDim3] = useState(NONE);

  // Výsledek
  const [result,  setResult]  = useState<SmartReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // ── Načtení dat z Firestore ─────────────────────────────────────────────

  const handleLoadData = async () => {
    if (!dateFrom || !dateTo) return;
    setLoadingData(true);
    setDataLoaded(false);
    setResult(null);
    setError(null);

    try {
      // Admin načte všechna data; ostatní jen svá
      const q = isAdmin
        ? query(
            collection(firestore, 'worklogs_raw'),
            where('date', '>=', dateFrom),
            where('date', '<=', dateTo),
          )
        : query(
            collection(firestore, 'worklogs_raw'),
            where('accountId', '==', ownAccountId ?? ''),
            where('date', '>=', dateFrom),
            where('date', '<=', dateTo),
          );

      const snap = await getDocs(q);
      const worklogs = snap.docs.map(d => d.data() as RawWorklog);
      setRawWorklogs(worklogs);

      // Extrahuj všechny Jira uživatele (pro admin)
      if (isAdmin) {
        const map = new Map<string, string>();
        for (const w of worklogs) {
          if (w.accountId) map.set(w.accountId, w.user || w.accountId);
        }
        setJiraUsers(
          Array.from(map.entries())
            .map(([accountId, name]) => ({ accountId, name }))
            .sort((a, b) => a.name.localeCompare(b.name, 'cs'))
        );
      }

      setSelUsers([]);
      setSelComponents([]);
      setSelParents([]);
      setDataLoaded(true);
    } catch (e: any) {
      setError(`Chyba při načítání dat: ${e.message}`);
    } finally {
      setLoadingData(false);
    }
  };

  // ── Sestavení přehledu (AI) ──────────────────────────────────────────────

  const handleBuild = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    // Filtrování client-side
    let filtered = rawWorklogs;
    if (isAdmin && selUsers.length > 0) {
      filtered = filtered.filter(w => selUsers.includes(w.accountId));
    }
    if (selComponents.length > 0) {
      filtered = filtered.filter(w => w.components.some(c => selComponents.includes(c)));
    }
    if (selParents.length > 0) {
      filtered = filtered.filter(w => selParents.includes(w.parentKey));
    }

    const dimensions = [dim1, dim2, dim3 !== NONE ? dim3 : null].filter(Boolean) as string[];

    try {
      const res = await api<SmartReportResponse>('/smart-reports', {
        method: 'POST',
        body: JSON.stringify({
          worklogs: filtered,
          dimensions,
          timeGrouping,
          dateRange: { from: dateFrom, to: dateTo },
        }),
      });
      setResult(res);
    } catch (e: any) {
      setError(`Chyba AI agenta: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ── Kaskádové filtry ─────────────────────────────────────────────────────

  const byUsers = useMemo(() =>
    isAdmin && selUsers.length > 0
      ? rawWorklogs.filter(w => selUsers.includes(w.accountId))
      : rawWorklogs,
  [rawWorklogs, selUsers, isAdmin]);

  const availableComponents = useMemo(() => {
    const set = new Set<string>();
    for (const w of byUsers) {
      for (const c of w.components) { if (c) set.add(c); }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'cs'));
  }, [byUsers]);

  const availableParents = useMemo(() => {
    const source = selComponents.length > 0
      ? byUsers.filter(w => w.components.some(c => selComponents.includes(c)))
      : byUsers;
    const map = new Map<string, string>();
    for (const w of source) {
      // Zobraz Epic, nebo starý záznam bez parentIssueType (před synchem s novým polem)
      if (w.parentKey && (w.parentIssueType === 'Epic' || !w.parentIssueType)) {
        map.set(w.parentKey, w.parentSummary || w.parentKey);
      }
    }
    return Array.from(map.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'cs'));
  }, [byUsers, selComponents]);

  // ── Export rows ──────────────────────────────────────────────────────────

  const exportRows = useMemo(() => {
    if (!result) return [];
    return result.rows.map(row => {
      const obj: Record<string, unknown> = {};
      for (const key of Object.keys(row)) {
        if (key === '_values') continue;
        const dim = DIMENSION_OPTIONS.find(d => d.value === key);
        obj[dim?.label ?? key] = row[key];
      }
      for (const col of result.columns) {
        obj[col.label] = row._values[col.key] ?? 0;
      }
      obj['Celkem'] = Object.values(row._values).reduce((s, v) => s + v, 0).toFixed(2);
      return obj;
    });
  }, [result]);

  const exportFilename = `chytre_prehledy_${dateFrom}_${dateTo}`;
  const exportTitle    = `Chytré přehledy · ${dateFrom} – ${dateTo}`;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <AutoAwesome sx={{ color: 'primary.main' }} />
        <Typography variant="h4">Chytré přehledy</Typography>
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Nastav filtry, konfiguraci a nech AI sestavit tabulku časů na projektech.
      </Typography>

      {/* ── Panel 1: Načtení dat ── */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>1. Načtení dat</Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
          <TextField
            label="Od"
            type="date"
            size="small"
            value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setDataLoaded(false); }}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 160 }}
          />
          <TextField
            label="Do"
            type="date"
            size="small"
            value={dateTo}
            onChange={e => { setDateTo(e.target.value); setDataLoaded(false); }}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 160 }}
          />
          <Button
            variant="contained"
            onClick={handleLoadData}
            disabled={loadingData || !dateFrom || !dateTo}
            startIcon={loadingData ? <CircularProgress size={16} /> : undefined}
          >
            Načíst data
          </Button>
          {dataLoaded && (
            <Typography variant="body2" color="text.secondary">
              Načteno {rawWorklogs.length} worklogů
              {isAdmin && ` · ${jiraUsers.length} zaměstnanců`}
            </Typography>
          )}
        </Stack>
      </Paper>

      {/* ── Panel 2: Konfigurace tabulky ── */}
      {dataLoaded && (
        <Paper sx={{ p: 3, mb: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>2. Konfigurace tabulky</Typography>

          {/* Filtry zaměstnanců a projektů */}
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap" sx={{ mb: 2 }}>
            {isAdmin && (
              <UserSelect
                jiraUsers={jiraUsers}
                value={selUsers}
                onChange={v => { setSelUsers(v); setSelComponents([]); setSelParents([]); }}
                multiple
                label="Zaměstnanci (prázdné = všichni)"
              />
            )}

            {availableComponents.length > 0 && (
              <FormControl size="small" sx={{ minWidth: 240 }}>
                <InputLabel>Komponenta (prázdné = všechny)</InputLabel>
                <Select
                  multiple
                  value={selComponents}
                  onChange={e => { setSelComponents(e.target.value as string[]); setSelParents([]); }}
                  input={<OutlinedInput label="Komponenta (prázdné = všechny)" />}
                  renderValue={sel => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {sel.map(c => <Chip key={c} label={c} size="small" />)}
                    </Box>
                  )}
                >
                  {availableComponents.map(c => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            {availableParents.length > 0 && (
              <FormControl size="small" sx={{ minWidth: 300 }}>
                <InputLabel>Projekt / Epic (prázdné = všechny)</InputLabel>
                <Select
                  multiple
                  value={selParents}
                  onChange={e => setSelParents(e.target.value as string[])}
                  input={<OutlinedInput label="Projekt / Epic (prázdné = všechny)" />}
                  renderValue={sel => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {sel.map(k => {
                        const p = availableParents.find(x => x.key === k);
                        return <Chip key={k} label={p?.label ?? k} size="small" />;
                      })}
                    </Box>
                  )}
                >
                  {availableParents.map(p => (
                    <MenuItem key={p.key} value={p.key}>{p.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Stack>

          {/* Časové seskupení a dimenze */}
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} flexWrap="wrap">
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Sloupce (čas)</InputLabel>
              <Select value={timeGrouping} onChange={e => setTimeGrouping(e.target.value as TimeGrouping)} label="Sloupce (čas)">
                {TIME_GROUPINGS.map(g => <MenuItem key={g.value} value={g.value}>{g.label}</MenuItem>)}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>1. dimenze řádků</InputLabel>
              <Select value={dim1} onChange={e => setDim1(e.target.value)} label="1. dimenze řádků">
                {DIMENSION_OPTIONS.map(d => <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>)}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>2. dimenze řádků</InputLabel>
              <Select value={dim2} onChange={e => setDim2(e.target.value)} label="2. dimenze řádků">
                {DIMENSION_OPTIONS.map(d => <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>)}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>3. dimenze řádků</InputLabel>
              <Select value={dim3} onChange={e => setDim3(e.target.value)} label="3. dimenze řádků">
                <MenuItem value={NONE}><em>Nevybráno</em></MenuItem>
                {DIMENSION_OPTIONS.map(d => <MenuItem key={d.value} value={d.value}>{d.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>

          <Box sx={{ mt: 3 }}>
            <Button
              variant="contained"
              size="large"
              onClick={handleBuild}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={18} /> : <AutoAwesome />}
            >
              {loading ? 'AI pracuje…' : 'Sestavit přehled'}
            </Button>
            {loading && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Claude analyzuje data, může trvat 10–30 sekund…
              </Typography>
            )}
          </Box>
        </Paper>
      )}

      {/* ── Chyba ── */}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* ── Výsledná tabulka ── */}
      {result && (
        <Paper sx={{ p: 3, overflow: 'hidden' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={600}>
              Výsledek · {result.rows.length} řádků
            </Typography>
            <ExportButtons rows={exportRows} filename={exportFilename} title={exportTitle} />
          </Stack>

          <TableContainer sx={{ maxHeight: 600, overflowX: 'auto', overflowY: 'auto' }}>
            <Table size="small" stickyHeader sx={{ minWidth: 'max-content' }}>
              <TableHead>
                <TableRow>
                  {Object.keys(result.rows[0] ?? {}).filter(k => k !== '_values').map(k => {
                    const dim = DIMENSION_OPTIONS.find(d => d.value === k);
                    return (
                      <TableCell key={k} sx={{ fontWeight: 700, whiteSpace: 'nowrap', bgcolor: '#2d5f8a', color: '#fff' }}>
                        {dim?.label ?? k}
                      </TableCell>
                    );
                  })}
                  {result.columns.map(col => (
                    <TableCell key={col.key} align="right" sx={{ fontWeight: 700, whiteSpace: 'nowrap', bgcolor: '#2d5f8a', color: '#fff' }}>
                      {col.label}
                    </TableCell>
                  ))}
                  <TableCell align="right" sx={{ fontWeight: 700, whiteSpace: 'nowrap', bgcolor: '#1a3f5c', color: '#fff' }}>
                    Celkem
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {result.rows.map((row, i) => {
                  const dimKeys = Object.keys(row).filter(k => k !== '_values');
                  const total   = Object.values(row._values).reduce((s, v) => s + v, 0);
                  return (
                    <TableRow key={i} sx={{ bgcolor: i % 2 === 0 ? '#fff' : '#f5f8fb' }}>
                      {dimKeys.map(k => (
                        <TableCell key={k} sx={{ whiteSpace: 'nowrap' }}>{row[k]}</TableCell>
                      ))}
                      {result.columns.map(col => (
                        <TableCell key={col.key} align="right">
                          {row._values[col.key] ? `${row._values[col.key]}h` : '—'}
                        </TableCell>
                      ))}
                      <TableCell align="right" sx={{ fontWeight: 600 }}>
                        {total.toFixed(2)}h
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
}
