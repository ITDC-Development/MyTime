import { Table, TableBody, TableCell, TableHead, TableRow, IconButton, Box, Typography, Chip } from '@mui/material';
import { Edit, History as HistoryIcon } from '@mui/icons-material';
import { LinearWorklog } from '../../types/worklog';
import { formatDateShort } from '../../utils/dateUtils';
import { formatPeriod, formatHours } from '../../utils/formatters';
import { OvertimeBadge } from '../common/OvertimeBadge';
import { BRAND } from '../../theme';
import { ColumnId } from '../../types/export';

interface Props {
  rows: LinearWorklog[];
  columns: ColumnId[];
  isLocked: boolean;
  showOvertime?: boolean;
  onEdit?: (row: LinearWorklog) => void;
  onHistory?: (row: LinearWorklog) => void;
}

const LABELS: Record<ColumnId, string> = {
  user: 'Uživatel', date: 'Datum', period: 'Období', issue: 'Issue', name: 'Název', parent: 'Parent',
  sprint: 'Sprint', component: 'Komponenta', hours: 'Hodiny', comment: 'Komentář', overtime: 'Přesčas',
};

export function WorklogTable({ rows, columns, isLocked, showOvertime = false, onEdit, onHistory }: Props) {
  if (rows.length === 0) {
    return <Typography color="text.secondary" sx={{ py: 3 }}>Žádné worklogy v tomto období.</Typography>;
  }
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          {columns.map(c => <TableCell key={c}>{LABELS[c]}</TableCell>)}
          {(onEdit || onHistory) && <TableCell align="right">Akce</TableCell>}
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row, idx) => {
          const bg = row.isAbsence && row.absenceType === 'SICK_LEAVE' ? 'rgba(76,175,80,0.15)'
            : row.isAbsence ? 'rgba(33,150,243,0.13)'
            : row.isPause ? BRAND.cream
            : (showOvertime && row.isOvertime) ? 'rgba(186,117,23,0.10)'
            : row.isEdited ? 'rgba(44,140,153,0.06)' : 'inherit';
          return (
            <TableRow key={`${row.worklogId}-${idx}`} sx={{ backgroundColor: bg }}>
              {columns.map(c => <TableCell key={c}>{cellValue(row, c, showOvertime)}</TableCell>)}
              {(onEdit || onHistory) && (
                <TableCell align="right">
                  {!row.isPause && !row.isAbsence && !isLocked && onEdit && (
                    <IconButton size="small" onClick={() => onEdit(row)}>
                      <Edit fontSize="small" />
                    </IconButton>
                  )}
                  {!row.isPause && !row.isAbsence && onHistory && (
                    <IconButton size="small" onClick={() => onHistory(row)}>
                      <HistoryIcon fontSize="small" />
                    </IconButton>
                  )}
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function cellValue(row: LinearWorklog, col: ColumnId, showOvertime = false) {
  switch (col) {
    case 'user': return row.user;
    case 'date': return formatDateShort(row.date);
    case 'period': {
      const period = formatPeriod(row.startMinutes, row.endMinutes);
      if (row.isAbsence) {
        const isSick = row.absenceType === 'SICK_LEAVE';
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <span>{period}</span>
            <Chip size="small" label={isSick ? 'Nemoc' : 'Dovolená'}
              sx={{ height: 18, fontSize: 11, fontWeight: 600,
                backgroundColor: isSick ? 'rgba(76,175,80,0.25)' : 'rgba(33,150,243,0.22)',
                color: isSick ? '#2e7d32' : '#1565c0' }} />
          </Box>
        );
      }
      if (showOvertime && row.isOvertime) {
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <span>{period}</span>
            <OvertimeBadge />
          </Box>
        );
      }
      return period;
    }
    case 'issue':
      if (row.isPause) return <Box component="span" sx={{ fontStyle: 'italic' }}>{row.summary}</Box>;
      return (
        <Box component="span">
          {row.issueKey || '—'}
          {row.isEdited && <Box component="span" sx={{ ml: 1, fontSize: 11, color: 'secondary.main' }}>(upraveno)</Box>}
          {row.isManual && <Box component="span" sx={{ ml: 1, fontSize: 11, color: 'text.secondary' }}>(ruční)</Box>}
          {showOvertime && row.isOvertime && <OvertimeBadge />}
        </Box>
      );
    case 'name': return row.isPause ? '—' : (row.summary || '—');
    case 'parent': return row.parentKey ? `${row.parentKey} · ${row.parentSummary}` : '—';
    case 'sprint': return row.sprint || '—';
    case 'component': return row.components.join(', ') || '—';
    case 'hours': return row.isPause ? '—' : formatHours(row.hours);
    case 'comment': return row.comment || '—';
    case 'overtime': return row.isOvertime ? formatHours(row.hours) : '—';
  }
}
