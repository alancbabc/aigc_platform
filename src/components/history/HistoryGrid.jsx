import { useState, useEffect, useCallback, useRef } from 'react';
import { historyAPI } from '../../api/client';
import HistoryCard from './HistoryCard';
import HistoryDetail from './HistoryDetail';
import LoadingSpinner from '../common/LoadingSpinner';
import EmptyState from '../common/EmptyState';
import ConfirmModal from '../common/ConfirmModal';

const PAGE_SIZE = 60;
const FILTER_TYPES = {
  image: ['image', 'image-edit'],
  video: ['video', 'image2video', 'a2v', 'interpolation'],
  audio: ['audio', 'clone'],
};

export default function HistoryGrid() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState('all');
  const [selectedItem, setSelectedItem] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [error, setError] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const requestIdRef = useRef(0);

  const fetchHistory = useCallback(async ({ cursor = null, append = false, force = false } = {}) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const type = filter === 'all' ? null : FILTER_TYPES[filter]?.join(',');
      const data = await historyAPI.getAll(
        { limit: PAGE_SIZE, ...(cursor ? { cursor } : {}), ...(type ? { type } : {}) },
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
  }, [filter]);

  useEffect(() => { fetchHistory({ force: true }); }, [fetchHistory]);

  const handleDelete = async (id) => {
    try {
      await historyAPI.delete(id);
      setHistory(prev => prev.filter(h => h.id !== id));
      setTotal(prev => Math.max(prev - 1, 0));
      if (selectedItem?.id === id) setSelectedItem(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleteConfirm(null);
    }
  };

  const filters = [
    { id: 'all', label: '全部' },
    { id: 'image', label: '图片' },
    { id: 'video', label: '视频' },
    { id: 'audio', label: '音频' },
  ];

  if (loading) return <LoadingSpinner size="large" />;

  return (
    <div className="h-full flex flex-col p-6 overflow-hidden">
      <div className="flex-shrink-0 flex items-center gap-4 mb-6">
        <h2 className="text-lg font-bold text-white">我的作品</h2>
        <div className="flex gap-1.5 bg-white/[0.03] rounded-lg p-1 border border-border">
          {filters.map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                filter === f.id
                  ? 'bg-primary/20 text-primary'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-white/30 ml-auto">{history.length}/{total} 条记录</span>
      </div>

      {deleteConfirm && (
        <ConfirmModal
          title="确认删除"
          message="删除后将无法恢复，包括生成的图片/视频/音频文件。确定要删除吗？"
          confirmLabel="删除"
          onConfirm={() => handleDelete(deleteConfirm)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {error && (
        <div className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg mb-4">
          <p className="text-red-400 text-xs">{error}</p>
        </div>
      )}

      {history.length === 0 ? (
        <EmptyState
          icon="📭"
          title="暂无作品"
          description="生成图片、视频或音频后，作品会在这里显示"
        />
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {history.map(item => (
              <HistoryCard
                key={item.id}
                item={item}
                onClick={() => setSelectedItem(item)}
                onDelete={() => setDeleteConfirm(item.id)}
              />
            ))}
          </div>
          {hasMore && (
            <button
              onClick={() => fetchHistory({ cursor: nextCursor, append: true })}
              disabled={loadingMore}
              className="w-full mt-4 py-2 text-xs text-white/40 hover:text-white/70 rounded-lg hover:bg-white/[0.03] transition-colors disabled:opacity-40"
            >
              {loadingMore ? '加载中...' : `加载更多 (${Math.max(total - history.length, 0)} 项剩余)`}
            </button>
          )}
        </div>
      )}

      {selectedItem && (
        <HistoryDetail
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onDelete={() => setDeleteConfirm(selectedItem.id)}
        />
      )}
    </div>
  );
}
