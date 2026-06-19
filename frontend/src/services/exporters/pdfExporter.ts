import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface PdfSummaryItem { label: string; value: string; }
export interface PdfSection { name: string; summary?: PdfSummaryItem[]; rows: Record<string, unknown>[]; }

const HC_SCALE = 2;
const PAGE_W = 297; // A4 landscape mm
const PAGE_H = 210;
const MARGIN = 10;
const MAX_W = PAGE_W - MARGIN * 2;
const MAX_H = PAGE_H - MARGIN * 2;

// Měří spodní hranice všech <tr> v canvas pixelech (musí být voláno, dokud je container v DOM)
function measureRowBottoms(container: HTMLDivElement): number[] {
  const containerTop = container.getBoundingClientRect().top;
  return Array.from(container.querySelectorAll('tr')).map(tr => {
    const rect = tr.getBoundingClientRect();
    return Math.round((rect.bottom - containerTop) * HC_SCALE);
  });
}

// Vykreslí canvas do PDF s inteligentním dělením stránek – nikdy nerozřízne řádek napůl
function addCanvasToDoc(
  doc: jsPDF,
  canvas: HTMLCanvasElement,
  rowBottoms: number[],
  addPageBefore: boolean,
) {
  const displayScale = MAX_W / (canvas.width / HC_SCALE);
  const displayH = (canvas.height / HC_SCALE) * displayScale;

  if (addPageBefore) doc.addPage();

  if (displayH <= MAX_H) {
    doc.addImage(canvas.toDataURL('image/png'), 'PNG', MARGIN, MARGIN, MAX_W, displayH);
    return;
  }

  // Kolik canvas pixelů se vejde na jednu stránku
  const pageCanvasH = Math.floor((canvas.height * MAX_H) / displayH);
  let pageStart = 0;
  let firstSlice = true;

  while (pageStart < canvas.height) {
    const idealEnd = pageStart + pageCanvasH;

    let splitAt: number;
    if (idealEnd >= canvas.height) {
      splitAt = canvas.height;
    } else {
      // Najdi poslední spodní hranici řádku, která se vejde na tuto stránku
      const fitting = rowBottoms.filter(b => b > pageStart && b <= idealEnd);
      splitAt = fitting.length > 0 ? fitting[fitting.length - 1] : idealEnd;
    }

    const sliceH = splitAt - pageStart;
    if (sliceH <= 0) break;

    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = sliceH;
    slice.getContext('2d')!.drawImage(
      canvas, 0, pageStart, canvas.width, sliceH,
      0, 0, canvas.width, sliceH,
    );

    const sliceDisplayH = (sliceH / canvas.height) * displayH;
    if (!firstSlice) doc.addPage();
    firstSlice = false;
    doc.addImage(slice.toDataURL('image/png'), 'PNG', MARGIN, MARGIN, MAX_W, sliceDisplayH);

    pageStart = splitAt;
  }
}

// Sestaví HTML kontejner s nadpisem, souhrnem a tabulkou
function buildContainer(
  title: string,
  rows: Record<string, unknown>[],
  summary?: PdfSummaryItem[],
): HTMLDivElement {
  const container = document.createElement('div');
  container.style.cssText = [
    'position:fixed', 'left:-9999px', 'top:0',
    'background:#fff', 'font-family:Arial,sans-serif', 'font-size:11px',
    'display:inline-block', 'min-width:600px', 'padding:16px',
  ].join(';');

  const titleEl = document.createElement('div');
  titleEl.style.cssText = 'font-size:15px;font-weight:bold;margin-bottom:10px;color:#1a1a1a;white-space:pre-line';
  titleEl.textContent = title;
  container.appendChild(titleEl);

  if (summary && summary.length > 0) {
    const summaryRow = document.createElement('div');
    summaryRow.style.cssText = 'display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap';
    for (const item of summary) {
      const card = document.createElement('div');
      card.style.cssText = 'background:#faf7f0;border:1px solid #e0dcd0;border-radius:6px;padding:8px 14px;min-width:140px';
      const lbl = document.createElement('div');
      lbl.style.cssText = 'font-size:10px;color:#888;margin-bottom:2px';
      lbl.textContent = item.label;
      const val = document.createElement('div');
      val.style.cssText = 'font-size:14px;font-weight:bold;color:#1a1a1a';
      val.textContent = item.value;
      card.appendChild(lbl);
      card.appendChild(val);
      summaryRow.appendChild(card);
    }
    container.appendChild(summaryRow);
  }

  if (rows.length > 0) {
    const cols = Object.keys(rows[0]);
    const table = document.createElement('table');
    table.style.cssText = 'border-collapse:collapse;width:auto';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    for (const col of cols) {
      const th = document.createElement('th');
      th.style.cssText = [
        'background:#2d5f8a', 'color:#fff', 'font-weight:bold',
        'padding:5px 8px', 'border:1px solid #1a3f5c',
        'text-align:left', 'white-space:nowrap',
      ].join(';');
      th.textContent = col;
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    rows.forEach((row, i) => {
      const tr = document.createElement('tr');
      tr.style.background = i % 2 === 0 ? '#ffffff' : '#f5f8fb';
      for (const col of cols) {
        const td = document.createElement('td');
        td.style.cssText = 'padding:4px 8px;border:1px solid #ddd;white-space:nowrap';
        td.textContent = String(row[col] ?? '');
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
  }

  return container;
}

// Vykreslí jeden kontejner do doc; měří řádky před html2canvas
async function renderContainerToDoc(
  doc: jsPDF,
  container: HTMLDivElement,
  addPageBefore: boolean,
) {
  document.body.appendChild(container);
  try {
    const fullW = container.scrollWidth;
    const fullH = container.scrollHeight;

    // Měř PŘED renderingem, dokud je container v DOM
    const rowBottoms = measureRowBottoms(container);

    const canvas = await html2canvas(container, {
      scale: HC_SCALE,
      useCORS: true,
      logging: false,
      width: fullW,
      height: fullH,
      windowWidth: fullW,
    });

    addCanvasToDoc(doc, canvas, rowBottoms, addPageBefore);
  } finally {
    document.body.removeChild(container);
  }
}

export async function exportPdf(
  rows: Record<string, unknown>[],
  filename: string,
  title: string,
  summary?: PdfSummaryItem[],
) {
  if (rows.length === 0) return;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  await renderContainerToDoc(doc, buildContainer(title, rows, summary), false);
  doc.save(`${filename}.pdf`);
}

/** Vrátí PDF jako base64 string (bez triggeru downloadu). */
export async function generatePdfBase64(
  rows: Record<string, unknown>[],
  title: string,
  summary?: PdfSummaryItem[],
): Promise<string> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  if (rows.length > 0) {
    await renderContainerToDoc(doc, buildContainer(title, rows, summary), false);
  }
  return doc.output('datauristring').split(',')[1]; // base64 část
}

/** Vrátí pole { name, base64 } — jeden soubor za sekci. */
export async function generatePdfSectionsAsFiles(
  sections: PdfSection[],
  filenameFor: (name: string) => string,
  titlePrefix: string,
): Promise<{ name: string; contentBase64: string }[]> {
  const results: { name: string; contentBase64: string }[] = [];
  for (const s of sections) {
    if (s.rows.length === 0) continue;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const sectionTitle = `${titlePrefix}\n${s.name}`;
    await renderContainerToDoc(doc, buildContainer(sectionTitle, s.rows, s.summary), false);
    results.push({ name: filenameFor(s.name), contentBase64: doc.output('datauristring').split(',')[1] });
  }
  return results;
}

export async function exportPdfBulk(sections: PdfSection[], filename: string, title: string) {
  const nonEmpty = sections.filter(s => s.rows.length > 0);
  if (nonEmpty.length === 0) return;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  for (let i = 0; i < nonEmpty.length; i++) {
    const s = nonEmpty[i];
    const sectionTitle = i === 0 ? `${title}\n${s.name}` : s.name;
    await renderContainerToDoc(doc, buildContainer(sectionTitle, s.rows, s.summary), i > 0);
  }

  doc.save(`${filename}.pdf`);
}
