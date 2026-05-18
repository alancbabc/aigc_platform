const typeConfig = {
  image: { icon: '🖼', label: '图片' },
  video: { icon: '🎬', label: '视频' },
  audio: { icon: '🎵', label: '音频' },
};

export default function HistoryCard({ item, onClick, onDelete }) {
  const config = typeConfig[item.type] || { icon: '📄', label: '未知' };
  const resultUrl = item.results?.[0]?.url || '';

  return (
    <div
      onClick={onClick}
      className="group relative aspect-square rounded-xl overflow-hidden border border-border bg-white/[0.01] cursor-pointer hover:border-white/20 transition-all hover:scale-[1.02]"
    >
      {item.type === 'image' ? (
        <img src={resultUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
      ) : item.type === 'video' ? (
        <div className="w-full h-full relative bg-black/40">
          <video src={resultUrl} className="w-full h-full object-cover" muted />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-primary/10 to-purple-500/10 flex items-center justify-center text-4xl">
          {config.icon}
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-xs text-white/90 truncate font-medium">{item.prompt || '(无 Prompt)'}</p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-white/40 truncate max-w-[60%]">{item.model}</span>
          <span className="text-[10px] text-white/30">
            {formatDate(item.createdAt)}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="absolute top-2 right-2 w-6 h-6 bg-red-500/80 hover:bg-red-500 rounded-full flex items-center justify-center text-white text-xs opacity-0 group-hover:opacity-100 transition-all"
        title="删除"
      >
        ✕
      </button>

      <div className="absolute top-2 left-2">
        <span className="px-1.5 py-0.5 rounded-md bg-black/60 text-[10px] font-bold text-white/80 backdrop-blur-sm">
          {config.label}
        </span>
      </div>
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
