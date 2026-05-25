import * as XLSX from 'xlsx';

export function exportXlsx(rows: Record<string, unknown>[], filename: string) {
  const sheet = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, 'Výkaz');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
