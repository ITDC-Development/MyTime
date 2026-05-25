# Datový model

## Firestore kolekce

### `users/{uid}`
```ts
{
  email: string;          // lowercase
  displayName: string;
  role: 'admin' | 'user';
  status: 'pending' | 'active' | 'blocked';
  jiraAccountId: string | null;
  createdAt: ISO string;
  approvedAt: ISO string | null;
  approvedBy: uid | null;
  preferences: {
    showPauses: boolean;
    columns: { projectReport: string[]; companyReport: string[]; overview: string[] };
    lastSelectedUser: string | null;
  }
}
```

### `worklogs_raw/{worklogId}` (1:1 z Jira, read-only)
```ts
{
  worklogId, user, accountId, summary, parentKey, parentSummary,
  components: string[], sprint, comment, seconds, started, issueKey,
  date: 'YYYY-MM-DD'  // pro indexaci
}
```

### `worklogs_edited/{worklogId}`
Uživatelské úpravy. Pokud existuje, přepíše hodnoty raw.

### `manual_worklogs/{id}`
Ručně přidané worklogy mimo Jira.

### `absences/{id}`
```ts
{ id, user, accountId, type: 'VACATION' | 'SICK_LEAVE' | 'DAY_OFF' | 'HOLIDAY', date, hours }
```

### `locks/{year-month-accountId}`
Per-uživatel per-měsíc zámek.

### `audit_log/{id}`
Diff každé editace worklogu.

### `sync_log/{id}`
Historie syncovů.

### `sync_settings/default`
Konfigurace plánovaného syncu (frequency, hour, dayOfWeek/Month, period).
