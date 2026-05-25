import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './routes/LoginPage';
import { RegisterPage } from './routes/RegisterPage';
import { DownloadDataPage } from './routes/DownloadDataPage';
import { ProjectReportPage } from './routes/ProjectReportPage';
import { CompanyReportPage } from './routes/CompanyReportPage';
import { OverviewPage } from './routes/OverviewPage';
import { HistoryPage } from './routes/HistoryPage';
import { EmployeeSummaryPage } from './routes/EmployeeSummaryPage';
import { UsersAdminPage } from './routes/UsersAdminPage';
import { useAuth } from './contexts/AuthContext';

function RootRedirect() {
  const { profile } = useAuth();
  if (!profile) return <Navigate to="/login" replace />;
  if (profile.role === 'admin') return <Navigate to="/download" replace />;
  return <Navigate to="/company" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route path="/" element={<ProtectedRoute><AppLayout><RootRedirect /></AppLayout></ProtectedRoute>} />
          <Route path="/download" element={<ProtectedRoute requireAdmin><AppLayout><DownloadDataPage /></AppLayout></ProtectedRoute>} />
          <Route path="/project" element={<ProtectedRoute requireAdmin><AppLayout><ProjectReportPage /></AppLayout></ProtectedRoute>} />
          <Route path="/company" element={<ProtectedRoute><AppLayout><CompanyReportPage /></AppLayout></ProtectedRoute>} />
          <Route path="/overview" element={<ProtectedRoute requireAdmin><AppLayout><OverviewPage /></AppLayout></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute requireAdmin><AppLayout><HistoryPage /></AppLayout></ProtectedRoute>} />
          <Route path="/employee" element={<ProtectedRoute><AppLayout><EmployeeSummaryPage /></AppLayout></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute requireAdmin><AppLayout><UsersAdminPage /></AppLayout></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
