import { Box } from '@mui/material';
import { ReactNode } from 'react';
import { Sidebar, SIDEBAR_WIDTH } from './Sidebar';

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <Box component="main" sx={{ flex: 1, ml: '24px', pl: 0.5, pr: 2, py: 2 }}>
        {children}
      </Box>
    </Box>
  );
}
