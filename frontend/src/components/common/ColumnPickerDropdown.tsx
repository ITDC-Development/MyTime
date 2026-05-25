import { useState } from 'react';
import { Button, Menu, MenuItem, Checkbox, ListItemText } from '@mui/material';
import { ViewColumn } from '@mui/icons-material';
import { ALL_COLUMNS, ColumnId } from '../../types/export';

interface Props {
  selected: ColumnId[];
  onChange: (cols: ColumnId[]) => void;
  exclude?: ColumnId[];
}

export function ColumnPickerDropdown({ selected, onChange, exclude = [] }: Props) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const available = ALL_COLUMNS.filter(c => !exclude.includes(c.id));

  const toggle = (id: ColumnId) => {
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
        Sloupce ({selected.filter(c => !exclude.includes(c)).length})
      </Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {available.map(c => (
          <MenuItem key={c.id} onClick={() => toggle(c.id)} dense>
            <Checkbox checked={selected.includes(c.id)} size="small" sx={{ py: 0 }} />
            <ListItemText primary={c.label} />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
