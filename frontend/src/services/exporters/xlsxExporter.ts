import ExcelJS from 'exceljs';

const HEADER_BG = 'FF2D5F8A';    // tmavě modrá
const HEADER_FG = 'FFFFFFFF';    // bílý text
const BORDER_COLOR = 'FFCCCCCC'; // světle šedé ohraničení dat
const HEADER_BORDER = 'FF1A3F5C';

export async function exportXlsx(rows: Record<string, unknown>[], filename: string) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Výkaz');

  if (rows.length === 0) {
    const buf = await wb.xlsx.writeBuffer();
    triggerDownload(buf, `${filename}.xlsx`);
    return;
  }

  const cols = Object.keys(rows[0]);

  // Vypočítej šířku každého sloupce (max délka hodnoty nebo hlavičky)
  const widths = cols.map(col => {
    const maxData = rows.reduce((m, r) => Math.max(m, String(r[col] ?? '').length), 0);
    return Math.min(Math.max(col.length, maxData) + 4, 60);
  });

  ws.columns = cols.map((col, i) => ({ header: col, key: col, width: widths[i] }));

  // Nastyluj hlavičkový řádek
  for (let c = 1; c <= cols.length; c++) {
    const cell = ws.getCell(1, c);
    cell.font = { bold: true, color: { argb: HEADER_FG }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
    cell.border = {
      top: { style: 'thin', color: { argb: HEADER_BORDER } },
      left: { style: 'thin', color: { argb: HEADER_BORDER } },
      bottom: { style: 'medium', color: { argb: HEADER_BORDER } },
      right: { style: 'thin', color: { argb: HEADER_BORDER } },
    };
  }
  ws.getRow(1).height = 22;

  // Přidej datové řádky
  rows.forEach(row => ws.addRow(row));

  // Nastyluj datové řádky – tenké ohraničení
  for (let r = 2; r <= rows.length + 1; r++) {
    for (let c = 1; c <= cols.length; c++) {
      const cell = ws.getCell(r, c);
      cell.alignment = { vertical: 'middle', wrapText: false };
      cell.border = {
        top: { style: 'thin', color: { argb: BORDER_COLOR } },
        left: { style: 'thin', color: { argb: BORDER_COLOR } },
        bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
        right: { style: 'thin', color: { argb: BORDER_COLOR } },
      };
    }
  }

  // Auto-filtr na celou hlavičku
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };

  // Zmraz první řádek (hlavičku)
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: 1, topLeftCell: 'A2', activeCell: 'A2' }];

  const buf = await wb.xlsx.writeBuffer();
  triggerDownload(buf, `${filename}.xlsx`);
}

function triggerDownload(buf: ArrayBuffer | Buffer<ArrayBufferLike>, filename: string) {
  const blob = new Blob([buf as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
