import { Box, MenuItem, TextField } from '@mui/material';
import { MONTHS_CZ } from '../../utils/dateUtils';

interface Props { year: number; month: number; onChange: (y: number, m: number) => void; }

export function MonthSelect({ year, month, onChange }: Props) {
  const years = [year - 1, year, year + 1];
  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      <TextField select size="small" label="Měsíc" value={month} onChange={e => onChange(year, Number(e.target.value))} sx={{ minWidth: 130 }}>
        {MONTHS_CZ.map((label, idx) => <MenuItem key={idx} value={idx + 1}>{label}</MenuItem>)}
      </TextField>
      <TextField select size="small" label="Rok" value={year} onChange={e => onChange(Number(e.target.value), month)} sx={{ minWidth: 90 }}>
        {years.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
      </TextField>
    </Box>
  );
}
