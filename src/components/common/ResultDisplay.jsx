import { useState } from 'react';

export default function ResultDisplay({ url, type = 'image', onDownload }) {
  const [fullscreen, setFullscreen] = useState(false);

  const renderMedia = () => {
    switch (type) {
      case 'video':
        return (
          <video src={url} controls autoPlay loop muted className="w-full h-full object-contain" />
        );
      case 'audio':
        return (
          <div className="w-full h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center text-4xl">
                🎵
              </div>
              <audio src={url} controls className="w-64" />
            </div>
          </div>
        );
      default:
        return <img src={url} alt="Generated result" className="w-full h-full object-contain" />;
    }
  };

  return (
    <>
      <div className="relative group max-w-lg w-full aspect-square rounded-2xl overflow-hidden border border-border bg-white/[0.02]">
        {renderMedia()}

        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            className="p-2.5 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"
            title="全屏预览"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onDownload}
            className="p-2.5 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"
            title="下载"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
        </div>
      </div>

      {fullscreen && (
        <div onClick={() => setFullscreen(false)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-8 animate-fade-in">
          <button
            type="button"
            onClick={() => setFullscreen(false)}
            className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors z-10"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          {type === 'image' && (
            <img src={url} alt="Fullscreen" className="max-w-full max-h-full rounded-xl shadow-4xl" />
          )}
          {type === 'video' && (
            <video src={url} controls autoPlay className="max-w-full max-h-full rounded-xl shadow-4xl" />
          )}
        </div>
      )}
    </>
  );
}
