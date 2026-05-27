let toastId = 0;
let setToastsFn = null;

export function showToast(message, type = 'info', duration = 4000) {
  if (setToastsFn) {
    const id = ++toastId;
    setToastsFn(prev => [...prev, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => {
        setToastsFn(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
  }
}

import { useState, useEffect, createContext, useContext } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    setToastsFn = setToasts;
    return () => { setToastsFn = null; };
  }, []);

  const typeStyles = {
    error: 'bg-red-500/90 text-white',
    info: 'bg-white/90 text-black',
    success: 'bg-green-500/90 text-white',
  };

  return (
    <ToastContext.Provider value={{ toasts }}>
      {children}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-2.5 rounded-xl text-xs font-medium shadow-4xl backdrop-blur-sm pointer-events-auto animate-fade-in-up ${typeStyles[t.type] || typeStyles.info}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
