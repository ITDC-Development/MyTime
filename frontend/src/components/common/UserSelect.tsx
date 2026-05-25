import { Autocomplete, TextField, Chip } from '@mui/material';
import type { UserProfile } from '../../types/user';

interface Props {
  users: UserProfile[];
  value: string[];
  onChange: (accountIds: string[]) => void;
  multiple?: boolean;
  label?: string;
}

export function UserSelect({ users, value, onChange, multiple = false, label = 'Uživatel' }: Props) {
  const opts = users.filter(u => u.jiraAccountId && u.status === 'active');
  const sel = opts.filter(u => value.includes(u.jiraAccountId!));

  return (
    <Autocomplete
      multiple={multiple}
      size="small"
      options={opts}
      getOptionLabel={(o) => o.displayName}
      isOptionEqualToValue={(a, b) => a.uid === b.uid}
      value={multiple ? sel : (sel[0] ?? null) as any}
      onChange={(_, v) => {
        const arr = Array.isArray(v) ? v : v ? [v] : [];
        onChange(arr.map(u => u.jiraAccountId!).filter(Boolean));
      }}
      sx={{ minWidth: 220 }}
      renderInput={(params) => <TextField {...params} label={label} />}
      renderTags={(tagValue, getTagProps) =>
        tagValue.map((option, index) => (
          <Chip size="small" label={option.displayName} {...getTagProps({ index })} key={option.uid} />
        ))
      }
    />
  );
}
