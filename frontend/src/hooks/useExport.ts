import { exportCsv } from '../services/exporters/csvExporter';
import { exportXlsx } from '../services/exporters/xlsxExporter';
import { exportPdf } from '../services/exporters/pdfExporter';

export function useExport() {
  return { exportCsv, exportXlsx, exportPdf };
}
