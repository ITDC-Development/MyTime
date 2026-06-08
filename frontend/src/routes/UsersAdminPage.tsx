import { useMemo, useState } from 'react';
import { Box, Typography, Paper, Stack, Table, TableContainer, TableHead, TableBody, TableRow, TableCell, IconButton, Chip, Button, Dialog, DialogTitle, DialogContent, DialogActions, Alert, Snackbar } from '@mui/material';
import { Check, Block, LockOpen, Delete, ArrowUpward, ArrowDownward, PersonAdd, ManageAccounts } from '@mui/icons-material';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useUsers } from '../hooks/useUsers';
import { useAuth } from '../contexts/AuthContext';
import { firestore } from '../services/firebase';
import { InviteUserDialog } from '../components/admin/InviteUserDialog';
import { AssignJiraDialog } from '../components/admin/AssignJiraDialog';
import type { UserProfile } from '../types/user';
import dayjs from 'dayjs';

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', user: 'User', freelancer: 'User' };
const ROLE_COLOR: Record<string, string> = { admin: 'secondary', user: 'default', freelancer: 'default' };
const ROLE_CYCLE: Record<string, string> = { admin: 'user', user: 'admin', freelancer: 'admin' };

export function UsersAdminPage() {
  const { profile } = useAuth();
  const { users } = useUsers();
  const [confirm, setConfirm] = useState<{ user: UserProfile; action: string; run: () => Promise<void> } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [jiraTarget, setJiraTarget] = useState<UserProfile | null>(null);

  const adminCount = useMemo(
    () => users.filter(u => u.role === 'admin' && u.status === 'active').length,
    [users]
  );

  const pending = users.filter(u => u.status === 'pending');
  const active = users.filter(u => u.status === 'active');
  const blocked = users.filter(u => u.status === 'blocked');

  const updateUser = async (uid: string, patch: { role?: string; status?: string }) => {
    try {
      const data: Record<string, unknown> = { ...patch };
      if (patch.status === 'active') {
        data.approvedAt = new Date().toISOString();
        data.approvedBy = profile?.uid ?? null;
      }
      await updateDoc(doc(firestore, 'users', uid), data);
    } catch (e) {
      setError(String(e));
    }
  };

  const deleteUser = async (uid: string) => {
    try {
      await deleteDoc(doc(firestore, 'users', uid));
    } catch (e) {
      setError(String(e));
    }
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
      <TableCell><Chip size="small" label={ROLE_LABEL[u.role] ?? u.role} color={(ROLE_COLOR[u.role] ?? 'default') as any} /></TableCell>
      <TableCell>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          {u.jiraAccountId
            ? <Chip size="small" label={u.jiraAccountId} variant="outlined" sx={{ fontFamily: 'monospace', fontSize: 11 }} />
            : <Typography variant="caption" color="text.disabled">—</Typography>
          }
          <IconButton size="small" title="Přiřadit Jira účet" onClick={() => setJiraTarget(u)}>
            <ManageAccounts fontSize="small" />
          </IconButton>
        </Stack>
      </TableCell>
      <TableCell>
        <Stack direction="row" spacing={0.5}>
          {sectionType === 'pending' && (
            <>
              <Button size="small" startIcon={<Check />} variant="contained"
                onClick={() => askConfirm(u, 'schválit', async () => updateUser(u.uid, { status: 'active' }))}>
                Schválit
              </Button>
              <Button size="small" color="error" startIcon={<Block />}
                onClick={() => askConfirm(u, 'zamítnout', async () => updateUser(u.uid, { status: 'blocked' }))}>
                Zamítnout
              </Button>
            </>
          )}
          {sectionType === 'active' && (
            <>
              <IconButton size="small" title={`Změnit roli (aktuálně: ${ROLE_LABEL[u.role] ?? u.role})`} onClick={() => {
                const newRole = ROLE_CYCLE[u.role] ?? 'user';
                askConfirm(u, `změnit roli na ${ROLE_LABEL[newRole] ?? newRole}`, async () => updateUser(u.uid, { role: newRole }));
              }}>
                {u.role === 'admin' ? <ArrowDownward fontSize="small" /> : <ArrowUpward fontSize="small" />}
              </IconButton>
              <IconButton size="small" title="Zablokovat" color="warning"
                onClick={() => askConfirm(u, 'zablokovat', async () => updateUser(u.uid, { status: 'blocked' }))}>
                <Block fontSize="small" />
              </IconButton>
            </>
          )}
          {sectionType === 'blocked' && (
            <IconButton size="small" title="Odblokovat" color="success"
              onClick={() => askConfirm(u, 'odblokovat', async () => updateUser(u.uid, { status: 'active' }))}>
              <LockOpen fontSize="small" />
            </IconButton>
          )}
          <IconButton size="small" title="Smazat" color="error"
            onClick={() => askConfirm(u, 'odstranit účet', async () => deleteUser(u.uid))}>
            <Delete fontSize="small" />
          </IconButton>
        </Stack>
      </TableCell>
    </TableRow>
  );

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="h4">Správa uživatelů</Typography>
        <Button variant="contained" startIcon={<PersonAdd />} onClick={() => setInviteOpen(true)}>
          Pozvat uživatele
        </Button>
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Pozvánky, role a blokování přístupu.
      </Typography>

      {pending.length > 0 && (
        <Paper sx={{ p: 3, mb: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Čekající na schválení ({pending.length})</Typography>
          <TableContainer sx={{ width: '100%' }}>
            <Table size="small" sx={{ width: '100%' }}>
              <TableHead><TableRow>
                <TableCell>Email</TableCell><TableCell>Jméno</TableCell><TableCell>Registrace</TableCell><TableCell>Role</TableCell><TableCell>Jira účet</TableCell><TableCell>Akce</TableCell>
              </TableRow></TableHead>
              <TableBody>{pending.map(u => renderRow(u, 'pending'))}</TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <Paper sx={{ p: 3, mb: 2 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Aktivní uživatelé ({active.length})</Typography>
        <TableContainer sx={{ width: '100%' }}>
          <Table size="small" sx={{ width: '100%' }}>
            <TableHead><TableRow>
              <TableCell>Email</TableCell><TableCell>Jméno</TableCell><TableCell>Registrace</TableCell><TableCell>Role</TableCell><TableCell>Jira účet</TableCell><TableCell>Akce</TableCell>
            </TableRow></TableHead>
            <TableBody>{active.map(u => renderRow(u, 'active'))}</TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {blocked.length > 0 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Zablokovaní ({blocked.length})</Typography>
          <TableContainer sx={{ width: '100%' }}>
            <Table size="small" sx={{ width: '100%' }}>
              <TableHead><TableRow>
                <TableCell>Email</TableCell><TableCell>Jméno</TableCell><TableCell>Registrace</TableCell><TableCell>Role</TableCell><TableCell>Jira účet</TableCell><TableCell>Akce</TableCell>
              </TableRow></TableHead>
              <TableBody>{blocked.map(u => renderRow(u, 'blocked'))}</TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <InviteUserDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <AssignJiraDialog open={Boolean(jiraTarget)} user={jiraTarget} onClose={() => setJiraTarget(null)} />

      <Snackbar open={Boolean(error)} autoHideDuration={5000} onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>
      </Snackbar>

      <Dialog open={Boolean(confirm)} onClose={() => setConfirm(null)}>
        <DialogTitle>Potvrzení akce</DialogTitle>
        <DialogContent>
          {confirm && (
            <>
              {confirm.user.uid === profile?.uid && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Chystáte se provést tuto akci na svém vlastním účtu.
                </Alert>
              )}
              {lastAdminWarning(confirm.user) && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  Toto je poslední admin v systému. Bez admina nebude možné spravovat uživatele ani spouštět sync.
                </Alert>
              )}
              <Typography>
                Chystáte se <strong>{confirm.action}</strong> uživatele <strong>{confirm.user.displayName}</strong>.
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
