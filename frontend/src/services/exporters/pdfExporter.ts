import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function exportPdf(rows: Record<string, unknown>[], filename: string, title: string) {
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(14);
  doc.text(title, 14, 14);
  doc.setFontSize(10);
  const head = rows.length ? [Object.keys(rows[0])] : [[]];
  const body = rows.map(r => Object.values(r).map(v => String(v ?? '')));
  autoTable(doc, { head, body, startY: 20, styles: { fontSize: 8 } });
  doc.save(`${filename}.pdf`);
}
