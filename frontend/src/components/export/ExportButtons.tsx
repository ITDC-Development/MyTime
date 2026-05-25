import { Box, Button } from '@mui/material';
import { GridOn, Description, PictureAsPdf } from '@mui/icons-material';
import { exportCsv } from '../../services/exporters/csvExporter';
import { exportXlsx } from '../../services/exporters/xlsxExporter';
import { exportPdf } from '../../services/exporters/pdfExporter';

interface Props { rows: Record<string, unknown>[]; filename: string; title: string; onExport?: () => Promise<void>; }

export function ExportButtons({ rows, filename, title, onExport }: Props) {
  const run = async (fn: () => void) => {
    if (onExport) await onExport();
    fn();
  };
  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      <Button size="small" variant="outlined" startIcon={<GridOn />} onClick={() => run(() => exportXlsx(rows, filename))}>
        Excel
      </Button>
      <Button size="small" variant="outlined" startIcon={<Description />} onClick={() => run(() => exportCsv(rows, filename))}>
        CSV
      </Button>
      <Button size="small" variant="outlined" startIcon={<PictureAsPdf />} onClick={() => run(() => exportPdf(rows, filename, title))}>
        PDF
      </Button>
    </Box>
  );
}
