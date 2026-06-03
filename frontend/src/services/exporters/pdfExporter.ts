import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface PdfSummaryItem { label: string; value: string; }

export async function exportPdf(rows: Record<string, unknown>[], filename: string, title: string, summary?: PdfSummaryItem[]) {
  if (rows.length === 0) return;

  const cols = Object.keys(rows[0]);

  // Sestav dočasnou HTML tabulku mimo viewport
  const container = document.createElement('div');
  container.style.cssText = [
    'position:fixed', 'left:-9999px', 'top:0',
    'background:#fff', 'font-family:Arial,sans-serif', 'font-size:11px',
    'display:inline-block', 'min-width:600px', 'padding:16px',
  ].join(';');

  const titleEl = document.createElement('div');
  titleEl.style.cssText = 'font-size:15px;font-weight:bold;margin-bottom:10px;color:#1a1a1a';
  titleEl.textContent = title;
  container.appendChild(titleEl);

  if (summary && summary.length > 0) {
    const summaryRow = document.createElement('div');
    summaryRow.style.cssText = 'display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap';
    for (const item of summary) {
      const card = document.createElement('div');
      card.style.cssText = [
        'background:#faf7f0', 'border:1px solid #e0dcd0', 'border-radius:6px',
        'padding:8px 14px', 'min-width:160px',
      ].join(';');
      const lbl = document.createElement('div');
      lbl.style.cssText = 'font-size:10px;color:#888;margin-bottom:2px';
      lbl.textContent = item.label;
      const val = document.createElement('div');
      val.style.cssText = 'font-size:15px;font-weight:bold;color:#1a1a1a';
      val.textContent = item.value;
      card.appendChild(lbl);
      card.appendChild(val);
      summaryRow.appendChild(card);
    }
    container.appendChild(summaryRow);
  }

  const table = document.createElement('table');
  table.style.cssText = 'border-collapse:collapse;width:auto';

  // Hlavička
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

  // Data
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
  document.body.appendChild(container);

  try {
    const fullW = container.scrollWidth;
    const fullH = container.scrollHeight;

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      width: fullW,
      height: fullH,
      windowWidth: fullW,
    });

    const pageW = 297; // A4 landscape mm
    const pageH = 210;
    const margin = 10;
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2;

    // Škáluj tak, aby se vešel celý obsah na šířku stránky
    const scale = maxW / (fullW);
    const displayH = fullH * scale;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    if (displayH <= maxH) {
      // Vejde se na jednu stránku
      doc.addImage(canvas.toDataURL('image/png'), 'PNG', margin, margin, maxW, displayH);
    } else {
      // Rozděl vertikálně na více stránek
      const pageCanvasH = Math.floor((canvas.height * maxH) / displayH);
      let offsetY = 0;
      while (offsetY < canvas.height) {
        const sliceH = Math.min(pageCanvasH, canvas.height - offsetY);
        const slice = document.createElement('canvas');
        slice.width = canvas.width;
        slice.height = sliceH;
        const ctx = slice.getContext('2d')!;
        ctx.drawImage(canvas, 0, offsetY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        const sliceDisplayH = (sliceH / canvas.height) * displayH;
        doc.addImage(slice.toDataURL('image/png'), 'PNG', margin, margin, maxW, sliceDisplayH);
        offsetY += sliceH;
        if (offsetY < canvas.height) doc.addPage();
      }
    }

    doc.save(`${filename}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
