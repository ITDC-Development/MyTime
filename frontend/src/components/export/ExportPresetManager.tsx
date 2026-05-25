import { useState } from 'react';
import {
  Stack, Button, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Typography, Tooltip,
} from '@mui/material';
import { BookmarkAdd } from '@mui/icons-material';
import type { ColumnId } from '../../types/export';
import type { ExportPreset } from '../../types/user';

interface Props {
  currentColumns: ColumnId[];
  presets: ExportPreset[];
  onLoad: (columns: ColumnId[]) => void;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
}

export function ExportPresetManager({ currentColumns, presets, onLoad, onSave, onDelete }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setName('');
    setDialogOpen(false);
  };

  return (
    <>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 1.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
          Předvolby:
        </Typography>

        {presets.length === 0 && (
          <Typography variant="caption" color="text.disabled">žádné uložené</Typography>
        )}

        {presets.map(p => (
          <Tooltip key={p.id} title={p.columns.join(', ')} placement="top">
            <Chip
              size="small"
              label={p.name}
              onClick={() => onLoad(p.columns as ColumnId[])}
              onDelete={() => onDelete(p.id)}
              variant="outlined"
              color="secondary"
            />
          </Tooltip>
        ))}

        <Button
          size="small"
          startIcon={<BookmarkAdd />}
          onClick={() => { setName(''); setDialogOpen(true); }}
          disabled={currentColumns.length === 0}
        >
          Uložit aktuální
        </Button>
      </Stack>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Uložit předvolbu</DialogTitle>
        <DialogContent>
          <Stack spacing={1} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Sloupce: <strong>{currentColumns.join(', ')}</strong>
            </Typography>
            <TextField
              label="Název předvolby"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              size="small"
              fullWidth
              autoFocus
              placeholder="např. Měsíční report"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Zrušit</Button>
          <Button onClick={handleSave} variant="contained" disabled={!name.trim()}>Uložit</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
