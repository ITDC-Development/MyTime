export type ExportFormat = 'csv' | 'xlsx' | 'pdf';
export type ColumnId = 'user' | 'date' | 'period' | 'issue' | 'parent' | 'sprint' | 'component' | 'hours' | 'comment' | 'overtime';
export const ALL_COLUMNS: { id: ColumnId; label: string }[] = [
  { id: 'date', label: 'Datum' },
  { id: 'period', label: 'Období' },
  { id: 'issue', label: 'Issue' },
  { id: 'hours', label: 'Hodiny' },
  { id: 'user', label: 'Uživatel' },
  { id: 'parent', label: 'Parent' },
  { id: 'sprint', label: 'Sprint' },
  { id: 'component', label: 'Komponenta' },
  { id: 'comment', label: 'Komentář' },
  { id: 'overtime', label: 'Přesčas' },
];
