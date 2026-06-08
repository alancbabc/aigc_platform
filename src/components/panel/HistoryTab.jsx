import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { historyAPI, getMediaUrl } from '../../api/client';
import { downloadResult } from '../../utils/download';
import { useTasks } from '../../contexts/TaskContext';
import ConfirmModal from '../common/ConfirmModal';
import LoadingSpinner from '../common/LoadingSpinner';
import VideoThumbnail from '../common/VideoThumbnail';

const TYPE_CONFIG = {
  image: { label: '图片', route: '/dashboard/image' },
  'image-edit': { label: '图片编辑', route: '/dashboard/image-edit' },
  video: { label: '视频', route: '/dashboard/video' },
  image2video: { label: '图生音视频', route: '/dashboard/image2video' },
  text2video: { label: '文生音视频', route: '/dashboard/video' },
  audio: { label: '音频', route: '/dashboard/audio' },
  clone: { label: '语音克隆', route: '/dashboard/clone' },
  interpolation: { label: '插帧生音视频', route: '/dashboard/interpolation' },
};

const OUTPUT_EXT = {
  image: 'png', 'image-edit': 'png', video: 'mp4', image2video: 'mp4', a2v: 'mp4', audio: 'wav', clone: 'wav', interpolation: 'mp4',
};

const PAGE_SIZE = 30;

export default function HistoryTab() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const requestIdRef = useRef(0);
  const navigate = useNavigate();
  const { historyVersion, notifyHistoryChange } = useTasks();

  const fetchHistory = useCallback(async ({ cursor = null, append = false, force = false } = {}) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await historyAPI.getAll(
        { limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) },
        { force }
      );
      if (requestId !== requestIdRef.current) return;
      const items = data.history || [];
      setHistory(prev => {
        if (!append) return items;
        const seen = new Set(prev.map(item => item.id));
        return [...prev, ...items.filter(item => !seen.has(item.id))];
      });
      setNextCursor(data.nextCursor || null);
      setHasMore(Boolean(data.hasMore));
      setTotal(data.total || 0);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(err.message);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => { fetchHistory({ force: historyVersion > 0 }); }, [fetchHistory, historyVersion]);

  const handleDelete = async (id) => {
    try {
      await historyAPI.delete(id);
      setHistory(prev => prev.filter(h => h.id !== id));
      setTotal(prev => Math.max(prev - 1, 0));
      notifyHistoryChange();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleReuse = (item) => {
    const config = TYPE_CONFIG[item.type];
    if (config) {
      navigate(config.route, { state: { reusePrompt: item.prompt } });
    }
  };

  if (loading) return <div className="flex items-center justify-center h-32"><LoadingSpinner size="small" /></div>;
  if (error) return (
    <div className="p-4 text-center">
      <p className="text-xs text-red-400 mb-2">{error}</p>
      <button onClick={() => fetchHistory({ force: true })} className="text-xs text-white/40 hover:text-white/80">重试</button>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto p-3 space-y-2 custom-scrollbar">
      {deleteTarget && (
        <ConfirmModal
          title="确认删除"
          message="删除后将无法恢复。确定要删除吗？"
          confirmLabel="删除"
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {history.map(item => {
        const config = TYPE_CONFIG[item.type] || { label: item.type };
        const resultUrl = getMediaUrl(item.results?.[0]?.url || '');
        const ext = OUTPUT_EXT[item.type] || 'png';

        return (
          <div key={item.id} className="bg-white/[0.02] border border-border rounded-xl p-3 hover:border-white/10 transition-colors group">
            <div className="flex items-start gap-2.5">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/[0.03] border border-border flex-shrink-0 flex items-center justify-center">
                {(item.type === 'image' || item.type === 'image-edit' || item.type === 'text2image') && resultUrl ? (
                  <img src={resultUrl} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                ) : (item.type === 'video' || item.type === 'interpolation' || item.type === 'image2video' || item.type === 'a2v' || item.type === 'text2video') && resultUrl ? (
                  <VideoThumbnail src={resultUrl} className="w-full h-full" iconSize={10} iconClassName="w-6 h-6" />
                ) : item.type === 'audio' || item.type === 'clone' || item.type === 'speech' ? (
                  <span className="text-sm opacity-40">🎵</span>
                ) : (
                  <span className="text-sm opacity-30">📄</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[9px] text-white/30">{config.label}</span>
                  <span className="text-[9px] text-white/15">{formatTime(item.createdAt)}</span>
                </div>
                <p className="text-[11px] text-white/50 truncate">{item.prompt || '(无 Prompt)'}</p>
                <div className="flex items-center gap-2 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.results?.[0] && (
                    <button onClick={() => downloadResult(item.results[0].url, `generated.${ext}`)} className="text-[10px] text-white/40 hover:text-white/80 transition-colors">下载</button>
                  )}
                  <button onClick={() => handleReuse(item)} className="text-[10px] text-primary/60 hover:text-primary transition-colors">复用 Prompt</button>
                  <button onClick={() => setDeleteTarget(item.id)} className="text-[10px] text-red-400/40 hover:text-red-400 transition-colors">删除</button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {hasMore && (
        <button
          onClick={() => fetchHistory({ cursor: nextCursor, append: true })}
          disabled={loadingMore}
          className="w-full py-2 text-xs text-white/30 hover:text-white/60 transition-colors rounded-lg hover:bg-white/[0.02] disabled:opacity-40"
        >
          {loadingMore ? '加载中...' : `加载更多 (${Math.max(total - history.length, 0)} 项剩余)`}
        </button>
      )}
    </div>
  );
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
