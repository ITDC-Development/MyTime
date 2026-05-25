import { useState } from 'react';
import { Button, Dialog, DialogTitle, DialogContent, DialogActions, Typography } from '@mui/material';
import { LockOutlined, LockOpenOutlined } from '@mui/icons-material';

interface Props {
  locked: boolean;
  onToggle: () => Promise<void>;
  monthLabel: string;
  isOwn?: boolean;
  isLastAdminWarning?: boolean;
}

export function LockButton({ locked, onToggle, monthLabel }: Props) {
  const [confirm, setConfirm] = useState(false);

  const handle = async () => { await onToggle(); setConfirm(false); };

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={locked ? <LockOpenOutlined /> : <LockOutlined />}
        onClick={() => setConfirm(true)}
      >
        {locked ? 'Odemknout měsíc' : 'Zamknout měsíc'}
      </Button>
      <Dialog open={confirm} onClose={() => setConfirm(false)}>
        <DialogTitle>{locked ? 'Odemknout měsíc' : 'Zamknout měsíc'}</DialogTitle>
        <DialogContent>
          <Typography>
            {locked
              ? `Odemčením povolíš editace a sync pro ${monthLabel}. Pokračovat?`
              : `Zamčení zabrání další synchronizaci i editacím pro ${monthLabel}. Pokračovat?`}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(false)}>Zrušit</Button>
          <Button onClick={handle} variant="contained" color={locked ? 'primary' : 'warning'}>
            {locked ? 'Odemknout' : 'Zamknout'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
