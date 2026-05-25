import { Box, Chip, Typography } from '@mui/material';
import { Check } from '@mui/icons-material';
import { ALL_COLUMNS, ColumnId } from '../../types/export';

interface Props { selected: ColumnId[]; onChange: (cols: ColumnId[]) => void; }

export function ColumnPicker({ selected, onChange }: Props) {
  const toggle = (id: ColumnId) => {
    onChange(selected.includes(id) ? selected.filter(c => c !== id) : [...selected, id]);
  };
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.8 }}>
        Sloupce v tabulce a exportu
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
        {ALL_COLUMNS.map(c => {
          const on = selected.includes(c.id);
          return (
            <Chip
              key={c.id}
              size="small"
              icon={on ? <Check sx={{ fontSize: 14 }} /> : undefined}
              label={c.label}
              onClick={() => toggle(c.id)}
              color={on ? 'secondary' : 'default'}
              variant={on ? 'filled' : 'outlined'}
            />
          );
        })}
      </Box>
    </Box>
  );
}
