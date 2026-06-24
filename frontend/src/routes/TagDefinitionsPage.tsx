import { useState } from 'react';
import {
  Box, Typography, Paper, Stack, Button, Table, TableContainer,
  TableHead, TableBody, TableRow, TableCell, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Chip, Alert,
} from '@mui/material';
import { Add, Delete } from '@mui/icons-material';
import { collection, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { firestore } from '../services/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useTagDefinitions } from '../hooks/useTagDefinitions';
import { TAG_COLUMN_LABELS, TAG_COLUMN_OPTIONS, type TagColumn } from '../types/tagDefinition';

export function TagDefinitionsPage() {
  const { profile } = useAuth();
  const { tagDefinitions, loading } = useTagDefinitions();
  const [open, setOpen] = useState(false);
  const [tagName, setTagName] = useState('');
  const [column, setColumn] = useState<TagColumn | ''>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = () => {
    setTagName('');
    setColumn('');
    setError(null);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!tagName.trim()) { setError('Zadej název tagu.'); return; }
    if (!column) { setError('Vyber sloupec.'); return; }
    if (tagDefinitions.some(td => td.tagName.toLowerCase() === tagName.trim().toLowerCase())) {
      setError(`Tag s názvem „${tagName.trim()}" již existuje.`); return;
    }
    if (tagDefinitions.some(td => td.column === column)) {
      setError(`Sloupec „${TAG_COLUMN_LABELS[column]}" je již přiřazen jinému tagu.`); return;
    }
    setSaving(true);
    try {
      await addDoc(collection(firestore, 'tag_definitions'), {
        tagName: tagName.trim(),
        column,
        createdAt: new Date().toISOString(),
        createdBy: profile?.uid ?? '',
      });
      setOpen(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(firestore, 'tag_definitions', id));
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 1 }}>Definovat tagy</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Vlastní mapování tagů z Activity Timeline termínů na sloupce. Formát tagu v AT: <code>[NázevTagu: hodnota]</code>.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      <Paper sx={{ p: 3 }}>
        <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
          <Button variant="contained" startIcon={<Add />} onClick={handleOpen}>
            Přidat nový tag
          </Button>
        </Stack>

        {!loading && tagDefinitions.length === 0 ? (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            Zatím nejsou definovány žádné tagy.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Název tagu</TableCell>
                  <TableCell>Mapování na sloupec</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {tagDefinitions.map(td => (
                  <TableRow key={td.id}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        [{td.tagName}]
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={TAG_COLUMN_LABELS[td.column]} />
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" color="error" onClick={() => handleDelete(td.id)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Přidat nový tag</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Název tagu"
              value={tagName}
              onChange={e => setTagName(e.target.value)}
              placeholder="např. ParentEpic"
              size="small"
              fullWidth
              helperText="Přesný název tagu jak se objevuje v AT, bez závorek."
            />
            <TextField
              select
              label="Mapování na sloupec"
              value={column}
              onChange={e => setColumn(e.target.value as TagColumn)}
              size="small"
              fullWidth
            >
              {TAG_COLUMN_OPTIONS.map(opt => {
                const taken = tagDefinitions.some(td => td.column === opt.value);
                return (
                  <MenuItem key={opt.value} value={opt.value} disabled={taken}>
                    {opt.label}{taken ? ' (již obsazeno)' : ''}
                  </MenuItem>
                );
              })}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Zrušit</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Ukládám…' : 'Uložit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
