import { createTheme } from '@mui/material';
import { csCZ } from '@mui/material/locale';

export const BRAND = {
  navy: '#1F2A44',
  navyLight: '#2D3D5F',
  teal: '#2C8C99',
  cream: '#FAF7F0',
  border: '#E5E0D5',
};

export const theme = createTheme(
  {
    palette: {
      mode: 'light',
      primary: { main: BRAND.navy, contrastText: '#FFFFFF' },
      secondary: { main: BRAND.teal },
      background: { default: BRAND.cream, paper: '#FFFFFF' },
      text: { primary: BRAND.navy, secondary: '#5F5E5A' },
      divider: BRAND.border,
      success: { main: '#2D6A3F', light: '#E5F0E8' },
      warning: { main: '#8B5A0F', light: '#F7EBD5' },
      error: { main: '#8B2D26', light: '#F5E0DD' },
    },
    typography: {
      fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif',
      h4: { fontWeight: 500 },
      h5: { fontWeight: 500 },
      h6: { fontWeight: 500 },
      button: { textTransform: 'none', fontWeight: 500 },
    },
    shape: { borderRadius: 8 },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { borderRadius: 8 } },
      },
      MuiCard: { styleOverrides: { root: { boxShadow: 'none', border: `1px solid ${BRAND.border}` } } },
      MuiPaper: { styleOverrides: { rounded: { borderRadius: 12 } } },
      MuiTableCell: {
        styleOverrides: {
          head: { backgroundColor: BRAND.cream, color: '#5F5E5A', fontWeight: 500, fontSize: '0.78rem' },
          body: { fontSize: '0.85rem' },
        },
      },
    },
  },
  csCZ
);
