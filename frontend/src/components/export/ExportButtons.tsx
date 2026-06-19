import { Box, Button } from '@mui/material';
import { GridOn, Description, PictureAsPdf } from '@mui/icons-material';
import { exportCsv } from '../../services/exporters/csvExporter';
import { exportXlsx } from '../../services/exporters/xlsxExporter';
import { exportPdf } from '../../services/exporters/pdfExporter';
import type { ExportFormat } from '../../types/export';

interface Props {
  rows: Record<string, unknown>[];
  filename: string;
  title: string;
  /** Called before export. Return true if caller handles the export itself. */
  onExport?: (format: ExportFormat) => Promise<boolean>;
}

export function ExportButtons({ rows, filename, title, onExport }: Props) {
  const run = async (format: ExportFormat, fn: () => void | Promise<void>) => {
    if (onExport) {
      const handled = await onExport(format);
      if (handled) return;
    }
    await fn();
  };
  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      <Button size="small" variant="outlined" startIcon={<GridOn />} onClick={() => run('xlsx', () => exportXlsx(rows, filename))}>
        Excel
      </Button>
      <Button size="small" variant="outlined" startIcon={<Description />} onClick={() => run('csv', () => exportCsv(rows, filename))}>
        CSV
      </Button>
      <Button size="small" variant="outlined" startIcon={<PictureAsPdf />} onClick={() => run('pdf', () => exportPdf(rows, filename, title))}>
        PDF
      </Button>
    </Box>
  );
}
