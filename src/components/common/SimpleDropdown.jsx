import { useState, useRef, useEffect } from 'react';

export default function SimpleDropdown({ title, options, selected, onSelect }) {
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

  if (!options || options.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.03] border border-border rounded-lg text-xs hover:border-white/20 transition-colors"
      >
        <span className="text-white/40">{title}{title ? ' ' : ''}</span>
        <span className="font-medium text-white">{selected}</span>
        <svg className={`w-3 h-3 text-white/30 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-[#111] border border-border rounded-xl p-2 shadow-4xl z-50 min-w-[140px]">
          {options.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => { onSelect(opt); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors ${
                opt === selected ? 'bg-primary/10 text-primary font-medium' : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
