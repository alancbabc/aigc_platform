import { useEffect } from 'react';

export default function FullscreenModal({ children, onClose }) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div onClick={onClose}
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-8 animate-fade-in">
      <div onClick={e => e.stopPropagation()} className="max-w-full max-h-full">
        {children}
      </div>
    </div>
  );
}
