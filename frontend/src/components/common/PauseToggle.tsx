import { FormControlLabel, Switch } from '@mui/material';

export function PauseToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <FormControlLabel
      control={<Switch size="small" checked={checked} onChange={(_, v) => onChange(v)} />}
      label="Zobrazit pauzy"
      sx={{ ml: 0, '& .MuiFormControlLabel-label': { fontSize: 14 } }}
    />
  );
}
