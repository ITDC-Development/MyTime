import { Stack, TextField, MenuItem } from '@mui/material';
import { getDateRangePresets } from '../../utils/dateUtils';

interface Props {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  fromLabel?: string;
  toLabel?: string;
  size?: 'small' | 'medium';
}

export function DateRangeFields({ from, to, onChange, fromLabel = 'Od', toLabel = 'Do', size = 'small' }: Props) {
  const presets = getDateRangePresets();

  return (
    <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="center">
      <TextField
        label={fromLabel}
        type="date"
        size={size}
        value={from}
        onChange={e => onChange(e.target.value, to)}
        InputLabelProps={{ shrink: true }}
        sx={{ width: 160 }}
      />
      <TextField
        label={toLabel}
        type="date"
        size={size}
        value={to}
        onChange={e => onChange(from, e.target.value)}
        InputLabelProps={{ shrink: true }}
        sx={{ width: 160 }}
      />
      <TextField
        select
        label="Rychlá volba"
        size={size}
        value=""
        onChange={e => {
          const p = presets.find(pr => pr.label === e.target.value);
          if (p) onChange(p.from, p.to);
        }}
        SelectProps={{ displayEmpty: true }}
        InputLabelProps={{ shrink: true }}
        sx={{ width: 160 }}
      >
        <MenuItem value="" disabled>
          <em>Vyberte…</em>
        </MenuItem>
        {presets.map(p => (
          <MenuItem key={p.label} value={p.label}>{p.label}</MenuItem>
        ))}
      </TextField>
    </Stack>
  );
}
