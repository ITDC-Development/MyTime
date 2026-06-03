import { useState } from 'react';
import { Button, Menu, MenuItem, Checkbox, ListItemText } from '@mui/material';
import { ViewColumn, LockOutlined } from '@mui/icons-material';
import { ALL_COLUMNS, ColumnId } from '../../types/export';

interface Props {
  selected: ColumnId[];
  onChange: (cols: ColumnId[]) => void;
  exclude?: ColumnId[];
  locked?: ColumnId[];
}

export function ColumnPickerDropdown({ selected, onChange, exclude = [], locked = [] }: Props) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const available = ALL_COLUMNS.filter(c => !exclude.includes(c.id));

  const toggle = (id: ColumnId) => {
    if (locked.includes(id)) return;
    onChange(selected.includes(id) ? selected.filter(c => c !== id) : [...selected, id]);
  };

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={<ViewColumn />}
        onClick={e => setAnchor(e.currentTarget)}
      >
        Sloupce ({new Set([...selected, ...locked]).size - exclude.filter(c => locked.includes(c)).length})
      </Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {available.map(c => {
          const isLocked = locked.includes(c.id);
          return (
            <MenuItem key={c.id} onClick={() => toggle(c.id)} dense
              sx={isLocked ? { pointerEvents: 'none', opacity: 0.65 } : undefined}>
              <Checkbox checked={selected.includes(c.id) || isLocked} size="small" sx={{ py: 0 }} />
              <ListItemText primary={c.label} />
              {isLocked && <LockOutlined sx={{ fontSize: 14, ml: 0.5, color: 'text.disabled' }} />}
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
