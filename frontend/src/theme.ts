import { createTheme } from '@mui/material';
import { csCZ } from '@mui/material/locale';

export const BRAND = {
  navy: '#002449',
  navyLight: '#1a3a63',
  teal: '#8BAA45',
  cream: '#f8f9f9',
  border: '#e9e9e9',
};

const HEADING_FONT = '"Raleway", "Open Sans", system-ui, sans-serif';
const BODY_FONT = '"Open Sans", "Segoe UI", system-ui, sans-serif';

export const theme = createTheme(
  {
    palette: {
      mode: 'light',
      primary: { main: BRAND.navy, contrastText: '#FFFFFF' },
      secondary: { main: BRAND.teal },
      background: { default: BRAND.cream, paper: '#FFFFFF' },
      text: { primary: '#333333', secondary: '#777777' },
      divider: BRAND.border,
      success: { main: '#2D6A3F', light: '#E5F0E8' },
      warning: { main: '#8B5A0F', light: '#F7EBD5' },
      error: { main: '#8B2D26', light: '#F5E0DD' },
    },
    typography: {
      fontFamily: BODY_FONT,
      h1: { fontFamily: HEADING_FONT, fontWeight: 700 },
      h2: { fontFamily: HEADING_FONT, fontWeight: 700 },
      h3: { fontFamily: HEADING_FONT, fontWeight: 600 },
      h4: { fontFamily: HEADING_FONT, fontWeight: 600 },
      h5: { fontFamily: HEADING_FONT, fontWeight: 600 },
      h6: { fontFamily: HEADING_FONT, fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 600, fontFamily: BODY_FONT },
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
          head: { backgroundColor: BRAND.cream, color: '#555555', fontWeight: 600, fontSize: '0.78rem' },
          body: { fontSize: '0.85rem' },
        },
      },
    },
  },
  csCZ
);
