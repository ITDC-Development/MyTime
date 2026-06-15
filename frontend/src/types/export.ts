export type ExportFormat = 'csv' | 'xlsx' | 'pdf';
export type ColumnId = 'user' | 'date' | 'from' | 'to' | 'issue' | 'name' | 'parentKey' | 'parentName' | 'sprint' | 'component' | 'hours' | 'comment' | 'overtime';
export const LOCKED_COLUMNS: ColumnId[] = ['date', 'from', 'to', 'name'];
export const ALL_COLUMNS: { id: ColumnId; label: string }[] = [
  { id: 'date', label: 'Datum' },
  { id: 'from', label: 'Od' },
  { id: 'to', label: 'Do' },
  { id: 'name', label: 'Název' },
  { id: 'issue', label: 'Issue' },
  { id: 'hours', label: 'Hodiny' },
  { id: 'user', label: 'Uživatel' },
  { id: 'parentKey', label: 'Parent - klíč' },
  { id: 'parentName', label: 'Parent - název' },
  { id: 'sprint', label: 'Sprint' },
  { id: 'component', label: 'Komponenta' },
  { id: 'comment', label: 'Komentář' },
  { id: 'overtime', label: 'Přesčas' },
];
