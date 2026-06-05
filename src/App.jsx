import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/5 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route
        path="/dashboard/*"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="image" replace />} />
        <Route path="image" element={<DashboardPage type="image" />} />
        <Route path="image-edit" element={<DashboardPage type="image-edit" />} />
        <Route path="video" element={<DashboardPage type="video" />} />
        <Route path="image2video" element={<DashboardPage type="image2video" />} />
        <Route path="audio" element={<DashboardPage type="audio" />} />
        <Route path="clone" element={<DashboardPage type="clone" />} />
        <Route path="interpolation" element={<DashboardPage type="interpolation" />} />
        <Route path="history" element={<DashboardPage type="history" />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
