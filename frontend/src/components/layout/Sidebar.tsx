import { Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Box, Avatar, Typography, Divider, Badge } from '@mui/material';
import {
  CloudDownload, FolderSpecial, Business, Assessment,
  History as HistoryIcon, Person, ManageAccounts, Logout, AccessTime, HelpOutline, AutoAwesome,
} from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useUsers } from '../../hooks/useUsers';
import { BRAND } from '../../theme';

interface MenuItem { path: string; label: string; icon: JSX.Element; }

const ADMIN_MENU: MenuItem[] = [
  { path: '/download', label: 'Stažení dat', icon: <CloudDownload /> },
  { path: '/project', label: 'Projektový výkaz', icon: <FolderSpecial /> },
  { path: '/company', label: 'Docházka', icon: <Business /> },
  { path: '/overview', label: 'Přehledy', icon: <Assessment /> },
  { path: '/smart-reports', label: 'Chytré přehledy', icon: <AutoAwesome /> },
  { path: '/history', label: 'Historie změn', icon: <HistoryIcon /> },
  { path: '/employee', label: 'Přehled zaměstnance', icon: <Person /> },
  { path: '/admin/users', label: 'Správa uživatelů', icon: <ManageAccounts /> },
];

const USER_MENU: MenuItem[] = [
  { path: '/company', label: 'Docházka', icon: <Business /> },
  { path: '/employee', label: 'Přehled zaměstnance', icon: <Person /> },
  { path: '/smart-reports', label: 'Chytré přehledy', icon: <AutoAwesome /> },
];

const FREELANCER_MENU: MenuItem[] = [
  { path: '/project', label: 'Projektový výkaz', icon: <FolderSpecial /> },
  { path: '/smart-reports', label: 'Chytré přehledy', icon: <AutoAwesome /> },
];

export const SIDEBAR_WIDTH = 240;

export function Sidebar() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { users } = useUsers();
  const pendingCount = profile?.role === 'admin' ? users.filter(u => u.status === 'pending').length : 0;

  const menu = profile?.role === 'admin' ? ADMIN_MENU : profile?.role === 'freelancer' ? FREELANCER_MENU : USER_MENU;

  const initials = (profile?.displayName ?? profile?.email ?? '?')
    .split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        [`& .MuiDrawer-paper`]: {
          width: SIDEBAR_WIDTH, boxSizing: 'border-box',
          backgroundColor: '#FFFFFF', borderRight: `1px solid ${BRAND.border}`,
        },
      }}
    >
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{
          width: 36, height: 36, borderRadius: 1,
          background: BRAND.navy, color: BRAND.cream,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 14,
        }}>T·D</Box>
        <Box>
          <Typography variant="h6" sx={{ lineHeight: 1, color: BRAND.navy }}>MyTime</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>IT-DC</Typography>
        </Box>
      </Box>
      <Divider />

      <List sx={{ flex: 1, py: 1 }}>
        {menu.map((item) => {
          const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          const showBadge = item.path === '/admin/users' && pendingCount > 0;
          return (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                onClick={() => navigate(item.path)}
                selected={active}
                sx={{
                  mx: 1, borderRadius: 1.5,
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(139,170,69,0.1)',
                    color: BRAND.teal,
                    borderLeft: `3px solid ${BRAND.teal}`,
                    pl: 1.6,
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: active ? BRAND.teal : 'text.secondary' }}>
                  {showBadge ? <Badge color="warning" badgeContent={pendingCount}>{item.icon}</Badge> : item.icon}
                </ListItemIcon>
                <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14 }} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      {profile?.role === 'admin' && (
        <>
          <Divider />
          <List sx={{ py: 0.5 }}>
            <ListItem disablePadding>
              <ListItemButton
                onClick={() => navigate('/napoveda')}
                selected={location.pathname === '/napoveda'}
                sx={{
                  mx: 1, borderRadius: 1.5,
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(139,170,69,0.1)',
                    color: BRAND.teal,
                    borderLeft: `3px solid ${BRAND.teal}`,
                    pl: 1.6,
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: location.pathname === '/napoveda' ? BRAND.teal : 'text.secondary' }}>
                  <HelpOutline />
                </ListItemIcon>
                <ListItemText primary="Nápověda" primaryTypographyProps={{ fontSize: 14 }} />
              </ListItemButton>
            </ListItem>
          </List>
        </>
      )}

      <Divider />
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ width: 32, height: 32, bgcolor: 'rgba(139,170,69,0.15)', color: BRAND.teal, fontSize: 12 }}>
          {initials}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" noWrap>{profile?.displayName}</Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }} noWrap>
            {profile?.email}
          </Typography>
        </Box>
        <ListItemButton onClick={() => logout()} sx={{ minWidth: 36, p: 1, borderRadius: 1 }}>
          <Logout fontSize="small" />
        </ListItemButton>
      </Box>
    </Drawer>
  );
}
