import { useMemo, useState } from 'react';
import { Box, Typography, Paper, Stack, Table, TableHead, TableBody, TableRow, TableCell, IconButton, Chip, Button, Dialog, DialogTitle, DialogContent, DialogActions, Alert } from '@mui/material';
import { Check, Block, LockOpen, Delete, ArrowUpward, ArrowDownward } from '@mui/icons-material';
import { useUsers } from '../hooks/useUsers';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import type { UserProfile } from '../types/user';
import dayjs from 'dayjs';

export function UsersAdminPage() {
  const { profile } = useAuth();
  const { users } = useUsers();
  const [confirm, setConfirm] = useState<{ user: UserProfile; action: string; run: () => Promise<void> } | null>(null);

  const adminCount = useMemo(
    () => users.filter(u => u.role === 'admin' && u.status === 'active').length,
    [users]
  );

  const pending = users.filter(u => u.status === 'pending');
  const active = users.filter(u => u.status === 'active');
  const blocked = users.filter(u => u.status === 'blocked');

  const updateUser = async (uid: string, patch: { role?: string; status?: string }) => {
    await api(`/users/${uid}`, { method: 'PATCH', body: JSON.stringify(patch) });
  };

  const deleteUser = async (uid: string) => {
    await api(`/users/${uid}`, { method: 'DELETE' });
  };

  const askConfirm = (user: UserProfile, action: string, run: () => Promise<void>) => {
    setConfirm({ user, action, run });
  };

  const lastAdminWarning = (user: UserProfile) =>
    user.role === 'admin' && user.status === 'active' && adminCount === 1;

  const renderRow = (u: UserProfile, sectionType: 'pending' | 'active' | 'blocked') => (
    <TableRow key={u.uid}>
      <TableCell>{u.email}</TableCell>
      <TableCell>{u.displayName}</TableCell>
      <TableCell>{dayjs(u.createdAt).format('DD. MM. YYYY')}</TableCell>
      <TableCell><Chip size="small" label={u.role === 'admin' ? 'Admin' : 'User'} color={u.role === 'admin' ? 'secondary' : 'default'} /></TableCell>
      <TableCell align="right">
        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
          {sectionType === 'pending' && (
            <>
              <Button size="small" startIcon={<Check />} variant="contained" onClick={() => updateUser(u.uid, { status: 'active' })}>Schválit</Button>
              <Button size="small" color="error" startIcon={<Block />} onClick={() => updateUser(u.uid, { status: 'blocked' })}>Zamítnout</Button>
            </>
          )}
          {sectionType === 'active' && (
            <>
              <IconButton size="small" title="Přepnout roli" onClick={() => {
                const newRole = u.role === 'admin' ? 'user' : 'admin';
                const isLast = lastAdminWarning(u) && newRole === 'user';
                const run = async () => updateUser(u.uid, { role: newRole });
                if (isLast || u.uid === profile?.uid) askConfirm(u, `změnit roli na ${newRole}`, run);
                else run();
              }}>
                {u.role === 'admin' ? <ArrowDownward fontSize="small" /> : <ArrowUpward fontSize="small" />}
              </IconButton>
              <IconButton size="small" title="Zablokovat" color="warning" onClick={() => {
                const isLast = lastAdminWarning(u);
                const run = async () => updateUser(u.uid, { status: 'blocked' });
                if (isLast || u.uid === profile?.uid) askConfirm(u, 'zablokovat', run);
                else run();
              }}>
                <Block fontSize="small" />
              </IconButton>
            </>
          )}
          {sectionType === 'blocked' && (
            <IconButton size="small" title="Odblokovat" color="success" onClick={() => updateUser(u.uid, { status: 'active' })}>
              <LockOpen fontSize="small" />
            </IconButton>
          )}
          <IconButton size="small" title="Smazat" color="error" onClick={() => {
            const isLast = lastAdminWarning(u);
            const run = async () => deleteUser(u.uid);
            if (isLast || u.uid === profile?.uid) askConfirm(u, 'smazat účet', run);
            else run();
          }}>
            <Delete fontSize="small" />
          </IconButton>
        </Stack>
      </TableCell>
    </TableRow>
  );

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 1 }}>Správa uživatelů</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Schvalování registrací, role a blokování přístupu.
      </Typography>

      {pending.length > 0 && (
        <Paper sx={{ p: 3, mb: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Čekající na schválení ({pending.length})</Typography>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>Email</TableCell><TableCell>Jméno</TableCell><TableCell>Registrace</TableCell><TableCell>Role</TableCell><TableCell align="right">Akce</TableCell>
            </TableRow></TableHead>
            <TableBody>{pending.map(u => renderRow(u, 'pending'))}</TableBody>
          </Table>
        </Paper>
      )}

      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Aktivní uživatelé ({active.length})</Typography>
        <Table size="small">
          <TableHead><TableRow>
            <TableCell>Email</TableCell><TableCell>Jméno</TableCell><TableCell>Registrace</TableCell><TableCell>Role</TableCell><TableCell align="right">Akce</TableCell>
          </TableRow></TableHead>
          <TableBody>{active.map(u => renderRow(u, 'active'))}</TableBody>
        </Table>
      </Paper>

      {blocked.length > 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Zablokovaní ({blocked.length})</Typography>
          <Table size="small">
            <TableHead><TableRow>
              <TableCell>Email</TableCell><TableCell>Jméno</TableCell><TableCell>Registrace</TableCell><TableCell>Role</TableCell><TableCell align="right">Akce</TableCell>
            </TableRow></TableHead>
            <TableBody>{blocked.map(u => renderRow(u, 'blocked'))}</TableBody>
          </Table>
        </Paper>
      )}

      <Dialog open={Boolean(confirm)} onClose={() => setConfirm(null)}>
        <DialogTitle>Potvrzení akce</DialogTitle>
        <DialogContent>
          {confirm && (
            <>
              {confirm.user.uid === profile?.uid && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Pokoušíš se {confirm.action} svůj vlastní účet.
                </Alert>
              )}
              {lastAdminWarning(confirm.user) && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  Toto je poslední admin v systému. Bez admina nebude možné spravovat uživatele ani spouštět sync.
                </Alert>
              )}
              <Typography>
                Opravdu chceš {confirm.action} účet <strong>{confirm.user.email}</strong>?
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Zrušit</Button>
          <Button color="warning" variant="contained" onClick={async () => { if (confirm) { await confirm.run(); setConfirm(null); } }}>
            Potvrdit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
