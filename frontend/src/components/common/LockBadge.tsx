import { Chip } from '@mui/material';
import { LockOutlined, LockOpenOutlined } from '@mui/icons-material';

export function LockBadge({ locked }: { locked: boolean }) {
  return locked ? (
    <Chip size="small" icon={<LockOutlined sx={{ fontSize: 14 }} />} label="Zamknuto" color="warning" variant="outlined" />
  ) : (
    <Chip size="small" icon={<LockOpenOutlined sx={{ fontSize: 14 }} />} label="Otevřeno" color="success" variant="outlined" />
  );
}
