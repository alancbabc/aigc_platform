import { useState, useRef, useEffect } from 'react';

export default function ModelDropdown({ models, selectedModel, onSelect }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  const selected = models.find(m => m.id === selectedModel);
  const filtered = models.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2 bg-white/[0.03] border border-border rounded-xl hover:border-white/20 transition-colors text-sm"
      >
        <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-[10px] font-bold text-primary">
          {selected?.name?.charAt(0) || '?'}
        </div>
        <span className="text-white font-medium text-xs">{selected?.name || '选择模型'}</span>
        <svg className={`w-3 h-3 text-white/30 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-[#111] border border-border rounded-xl p-3 shadow-4xl z-50 max-h-[50vh] flex flex-col">
          <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 border border-border mb-3">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-white/30">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索模型..."
              className="bg-transparent text-xs text-white outline-none w-full placeholder:text-white/20"
            />
          </div>

          <div className="text-[10px] font-medium text-white/30 mb-2 px-1 uppercase tracking-wider">
            可用模型
          </div>

          <div className="overflow-y-auto custom-scrollbar flex flex-col gap-1">
            {filtered.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => { onSelect(m); setOpen(false); }}
                className={`flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 transition-colors ${
                  m.id === selectedModel ? 'bg-white/5 border border-border' : 'border border-transparent'
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shadow-inner">
                  {m.name.charAt(0)}
                </div>
                <div className="text-left flex-1 min-w-0">
                  <div className="text-xs font-bold text-white truncate">{m.name}</div>
                  {m.description && (
                    <div className="text-[10px] text-white/30 mt-0.5 truncate">{m.description}</div>
                  )}
                </div>
                {m.id === selectedModel && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="4" className="flex-shrink-0">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="text-xs text-white/20 text-center py-4">未找到匹配模型</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
