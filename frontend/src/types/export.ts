export type ExportFormat = 'csv' | 'xlsx' | 'pdf';
export type ColumnId = 'user' | 'date' | 'from' | 'to' | 'issue' | 'name' | 'parentKey' | 'parentName' | 'sprint' | 'component' | 'hours' | 'comment' | 'overtime';
export type ExportLang = 'cs' | 'de' | 'en';
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

export const EXPORT_COLUMN_LABELS: Record<ExportLang, Record<ColumnId, string>> = {
  cs: {
    user: 'Uživatel', date: 'Datum', from: 'Od', to: 'Do', issue: 'Issue', name: 'Název',
    parentKey: 'Parent - klíč', parentName: 'Parent - název',
    sprint: 'Sprint', component: 'Komponenta', hours: 'Hodiny', comment: 'Komentář', overtime: 'Přesčas',
  },
  de: {
    user: 'Benutzer', date: 'Datum', from: 'Von', to: 'Bis', issue: 'Issue', name: 'Name',
    parentKey: 'Übergeordnet - Schlüssel', parentName: 'Übergeordnet - Name',
    sprint: 'Sprint', component: 'Komponente', hours: 'Stunden', comment: 'Kommentar', overtime: 'Überstunden',
  },
  en: {
    user: 'User', date: 'Date', from: 'From', to: 'To', issue: 'Issue', name: 'Name',
    parentKey: 'Parent - key', parentName: 'Parent - name',
    sprint: 'Sprint', component: 'Component', hours: 'Hours', comment: 'Comment', overtime: 'Overtime',
  },
};

export const EXPORT_FILENAME_PREFIX: Record<ExportLang, string> = {
  cs: 'vykaz',
  de: 'bericht',
  en: 'report',
};
