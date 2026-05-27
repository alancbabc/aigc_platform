import { useEffect } from 'react';

export default function ConfirmModal({ title, message, confirmLabel = '确认', onConfirm, onCancel }) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  return (
    <div onClick={onCancel} className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-8 animate-fade-in">
      <div onClick={e => e.stopPropagation()} className="bg-[#111] border border-border rounded-2xl p-6 max-w-sm w-full shadow-4xl">
        <h3 className="text-sm font-bold text-white mb-2">{title}</h3>
        <p className="text-xs text-white/50 mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-xs text-white/50 hover:text-white hover:bg-white/5 border border-border transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
