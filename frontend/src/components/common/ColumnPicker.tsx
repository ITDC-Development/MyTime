import { Box, Chip, Typography } from '@mui/material';
import { Check, LockOutlined } from '@mui/icons-material';
import { ALL_COLUMNS, ColumnId } from '../../types/export';

interface Props { selected: ColumnId[]; onChange: (cols: ColumnId[]) => void; locked?: ColumnId[]; }

export function ColumnPicker({ selected, onChange, locked = [] }: Props) {
  const toggle = (id: ColumnId) => {
    if (locked.includes(id)) return;
    onChange(selected.includes(id) ? selected.filter(c => c !== id) : [...selected, id]);
  };
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.8 }}>
        Sloupce v tabulce a exportu
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
        {ALL_COLUMNS.map(c => {
          const isLocked = locked.includes(c.id);
          const on = selected.includes(c.id) || isLocked;
          return (
            <Chip
              key={c.id}
              size="small"
              icon={on ? (isLocked ? <LockOutlined sx={{ fontSize: 14 }} /> : <Check sx={{ fontSize: 14 }} />) : undefined}
              label={c.label}
              onClick={isLocked ? undefined : () => toggle(c.id)}
              color={on ? 'secondary' : 'default'}
              variant={on ? 'filled' : 'outlined'}
              sx={isLocked ? { cursor: 'default' } : undefined}
            />
          );
        })}
      </Box>
    </Box>
  );
}
