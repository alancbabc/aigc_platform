import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function AuthLayout() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/5 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) return <Navigate to="/dashboard/image" replace />;

  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 mb-4 group hover:border-primary/40 transition-colors">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="1.5" className="group-hover:scale-110 transition-transform">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">AIGC Platform</h1>
          <p className="text-white/30 text-[13px] mt-1">AI 图片 · 视频 · 音频生成平台</p>
        </div>
        <Outlet />
      </div>
    </div>
  );
}
