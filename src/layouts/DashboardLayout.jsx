import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTasks } from '../contexts/TaskContext';
import PromptPanel from '../components/common/PromptPanel';
import RightPanel from '../components/panel/RightPanel';

const NAV_ITEMS = [
  { id: 'image',   label: '文生图片', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
    </svg>
  ), path: '/dashboard/image' },
  { id: 'image-edit', label: '图片编辑', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ), path: '/dashboard/image-edit' },
  { id: 'video',   label: '文生音视频', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  ), path: '/dashboard/video' },
  { id: 'image2video', label: '图生音视频', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" /><polygon points="10 8 16 12 10 16 10 8" />
    </svg>
  ), path: '/dashboard/image2video' },
  { id: 'interpolation', label: '插帧生音视频', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2.18" /><circle cx="8" cy="8" r="2" /><circle cx="16" cy="16" r="2" /><line x1="8" y1="8" x2="16" y2="16" /><polyline points="8 14 8 16 10 16" /><polyline points="16 10 16 8 14 8" />
    </svg>
  ), path: '/dashboard/interpolation' },
  { id: 'audio',   label: '语音合成', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
    </svg>
  ), path: '/dashboard/audio' },
  { id: 'clone', label: '语音克隆', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  ), path: '/dashboard/clone' },
  { id: 'history', label: '我的作品', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ), path: '/dashboard/history' },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { optimizeOpen, setOptimizeOpen, optimizePanel } = useTasks();
  const [collapsed, setCollapsed] = useState(false);

  const currentNav = NAV_ITEMS.find(item => location.pathname === item.path)?.id;

  return (
    <div className="h-screen bg-app-bg flex overflow-hidden">
      <aside className={`${collapsed ? 'w-16' : 'w-56'} flex-shrink-0 bg-black/30 border-r border-border flex flex-col transition-all duration-300`}>
        <div className="h-14 flex items-center gap-3 px-4 border-b border-border flex-shrink-0">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          {!collapsed && <span className="text-sm font-bold text-white tracking-tight truncate">AIGC Studio</span>}
        </div>

        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                currentNav === item.id
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!collapsed && <span className="font-medium truncate">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
              {user?.username?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            {!collapsed && (
              <span className="text-xs text-white/60 truncate flex-1">{user?.username}</span>
            )}
            <button
              onClick={logout}
              className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded-md hover:bg-red-500/10 transition-colors flex-shrink-0"
              title="退出登录"
            >
              {collapsed ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                </svg>
              ) : '退出'}
            </button>
          </div>
        </div>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="h-8 border-t border-border flex items-center justify-center text-white/30 hover:text-white/60 transition-colors flex-shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className={`transition-transform ${collapsed ? 'rotate-180' : ''}`}>
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      </aside>

      <main className="w-[45%] min-w-[420px] flex-shrink-0 overflow-hidden">
        <Outlet />
      </main>

      {optimizeOpen && optimizePanel?.source === currentNav && (
        <PromptPanel
          key={`${optimizePanel.source}:${optimizePanel.type}`}
          prompt={optimizePanel.prompt}
          type={optimizePanel.type}
          onApply={optimizePanel.onApply}
          onClose={() => setOptimizeOpen(false)}
        />
      )}

      <RightPanel />
    </div>
  );
}
