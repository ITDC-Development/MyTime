import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

export interface SmartReportRequest {
  worklogs: {
    worklogId: string;
    user: string;
    accountId: string;
    date: string;
    seconds: number;
    issueKey: string;
    summary: string;
    parentKey: string;
    parentSummary: string;
    components: string[];
    sprint: string;
    issueType: string;
    priority: string;
  }[];
  dimensions: string[];
  timeGrouping: 'day' | 'week' | 'month' | 'quarter' | 'year';
  dateRange: { from: string; to: string };
}

export type SmartReportRow = Record<string, string> & { _values: Record<string, number> };

export interface SmartReportResponse {
  columns: { key: string; label: string }[];
  rows: SmartReportRow[];
}

type TimeGrouping = SmartReportRequest['timeGrouping'];

const CZECH_MONTHS = [
  'Leden','Únor','Březen','Duben','Květen','Červen',
  'Červenec','Srpen','Září','Říjen','Listopad','Prosinec',
];

function isoWeekData(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { week, year: d.getUTCFullYear() };
}

function getTimePeriodKey(dateStr: string, grouping: TimeGrouping): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  switch (grouping) {
    case 'day': return dateStr;
    case 'week': {
      const { week, year } = isoWeekData(d);
      return `${year}-W${String(week).padStart(2, '0')}`;
    }
    case 'month': return `${y}-${String(m).padStart(2, '0')}`;
    case 'quarter': return `${y}-Q${Math.ceil(m / 3)}`;
    case 'year': return String(y);
  }
}

function getTimePeriodLabel(key: string, grouping: TimeGrouping): string {
  switch (grouping) {
    case 'day': {
      const [, m, d] = key.split('-');
      return `${parseInt(d)}. ${parseInt(m)}.`;
    }
    case 'week': {
      const [y, w] = key.split('-W');
      return `T${parseInt(w)} '${y.slice(2)}`;
    }
    case 'month': {
      const [y, m] = key.split('-');
      return `${CZECH_MONTHS[parseInt(m) - 1]} '${y.slice(2)}`;
    }
    case 'quarter': {
      const [y, q] = key.split('-Q');
      return `Q${q} ${y}`;
    }
    case 'year': return key;
  }
}

function generateColumns(from: string, to: string, grouping: TimeGrouping): { key: string; label: string }[] {
  const result: { key: string; label: string }[] = [];
  const seen = new Set<string>();
  const cur = new Date(from + 'T00:00:00Z');
  const end = new Date(to + 'T00:00:00Z');
  while (cur <= end) {
    const key = getTimePeriodKey(cur.toISOString().slice(0, 10), grouping);
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ key, label: getTimePeriodLabel(key, grouping) });
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return result;
}

function getDimensionValue(w: SmartReportRequest['worklogs'][0], dim: string): string {
  switch (dim) {
    case 'user':          return w.user || '—';
    case 'issueKey':      return w.issueKey || '—';
    case 'parentKey':     return w.parentKey || '—';
    case 'parentSummary': return w.parentSummary || '—';
    case 'sprint':        return w.sprint || '—';
    case 'components':    return w.components.join(', ') || '—';
    case 'issueType':     return w.issueType || '—';
    case 'priority':      return w.priority || '—';
    default:              return '—';
  }
}

function aggregate(body: SmartReportRequest): SmartReportResponse {
  const { worklogs, dimensions, timeGrouping, dateRange } = body;
  const columns = generateColumns(dateRange.from, dateRange.to, timeGrouping);
  const colKeySet = new Set(columns.map(c => c.key));

  const rowMap = new Map<string, { dimValues: Record<string, string>; totals: Map<string, number> }>();

  for (const w of worklogs) {
    const colKey = getTimePeriodKey(w.date, timeGrouping);
    if (!colKeySet.has(colKey)) continue;

    const dimValues: Record<string, string> = {};
    for (const dim of dimensions) dimValues[dim] = getDimensionValue(w, dim);

    const rowKey = dimensions.map(d => dimValues[d]).join('\x00');
    if (!rowMap.has(rowKey)) rowMap.set(rowKey, { dimValues, totals: new Map() });

    const entry = rowMap.get(rowKey)!;
    entry.totals.set(colKey, (entry.totals.get(colKey) ?? 0) + w.seconds);
  }

  const rows: SmartReportRow[] = Array.from(rowMap.values())
    .map(({ dimValues, totals }) => {
      const _values: Record<string, number> = {};
      for (const [colKey, seconds] of totals.entries()) {
        _values[colKey] = Math.round(seconds / 36) / 100; // sekund → hodiny, 2 des. místa
      }
      return { ...dimValues, _values } as SmartReportRow;
    })
    .sort((a, b) => {
      for (const dim of dimensions) {
        const cmp = (a[dim] ?? '').localeCompare(b[dim] ?? '', 'cs');
        if (cmp !== 0) return cmp;
      }
      return 0;
    });

  return { columns, rows };
}

router.post('/', authenticate, async (req, res) => {
  const body = req.body as SmartReportRequest;
  if (!body.worklogs || !body.dimensions || !body.timeGrouping || !body.dateRange) {
    return res.status(400).json({ error: 'Chybí povinná pole' });
  }
  try {
    const result = aggregate(body);
    logger.info('Smart report sestaven', { worklogs: body.worklogs.length, rows: result.rows.length });
    return res.json(result);
  } catch (err: any) {
    logger.error('Smart report chyba', { err: err.message });
    return res.status(500).json({ error: err.message });
  }
});

export default router;
