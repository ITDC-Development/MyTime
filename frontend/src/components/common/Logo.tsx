import { Box, Typography } from '@mui/material';
import { BRAND } from '../../theme';
export function Logo() {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.5 }}>
      <Box sx={{
        width: 40, height: 40, borderRadius: 1, background: BRAND.navy, color: BRAND.cream,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16,
      }}>T·D</Box>
      <Box>
        <Typography variant="h6" sx={{ lineHeight: 1, color: BRAND.navy }}>MyTime</Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>IT Delivery Center</Typography>
      </Box>
    </Box>
  );
}
