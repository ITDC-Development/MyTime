import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress, Typography, Button } from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';

export function ProtectedRoute({ children, requireAdmin }: { children: ReactNode; requireAdmin?: boolean }) {
  const { firebaseUser, profile, loading, logout } = useAuth();
  const location = useLocation();

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;
  }
  if (!firebaseUser || !profile) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (profile.status === 'pending') {
    return <StatusScreen title="Účet čeká na schválení"
      message="Tvůj účet je vytvořen, ale ještě nebyl schválen administrátorem. Vyčkej prosím, než ti přístup povolí."
      onLogout={logout} />;
  }
  if (profile.status === 'blocked') {
    return <StatusScreen title="Účet zablokován"
      message="Tvůj účet byl zablokován. Pro obnovení přístupu kontaktuj administrátora."
      onLogout={logout} />;
  }
  if (requireAdmin && profile.role !== 'admin') {
    return <Navigate to="/company" replace />;
  }
  return <>{children}</>;
}

function StatusScreen({ title, message, onLogout }: { title: string; message: string; onLogout: () => void }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 2, p: 3, textAlign: 'center' }}>
      <Typography variant="h4">{title}</Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 480 }}>{message}</Typography>
      <Button variant="outlined" onClick={() => onLogout()}>Odhlásit se</Button>
    </Box>
  );
}
