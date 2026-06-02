import { useRef, useState, useEffect } from 'react';
import { showToast } from './Toast';

const MAX_FILE_SIZE = 20 * 1024 * 1024;

export default function ImageUploader({ file, onUpload, onClear, label = '点击或拖拽上传图片' }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  const handleFile = (f) => {
    if (!f) return;
    if (f.size > MAX_FILE_SIZE) { showToast('文件大小不能超过 20MB', 'error'); return; }
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
    onUpload?.(f);
  };

  const handleChange = (e) => {
    handleFile(e.target.files?.[0]);
    e.target.value = '';
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    onClear?.();
  };

  if (previewUrl) {
    return (
      <div className="relative group rounded-xl overflow-hidden border border-primary/40 bg-white/[0.02]">
        <img src={previewUrl} alt="" className="w-full max-h-80 object-contain bg-black/20" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
          <button
            onClick={handleClear}
            className="px-3 py-1.5 bg-red-500/20 rounded-lg text-xs text-red-400 hover:bg-red-500/30 transition-colors"
          >
            删除
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
      className={`cursor-pointer rounded-xl border-2 border-dashed p-10 flex flex-col items-center justify-center gap-4 transition-all ${
        dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-white/20 bg-white/[0.01]'
      }`}
    >
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={dragOver ? 'text-primary' : 'text-white/15'}>
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
      <p className={`text-xs text-center ${dragOver ? 'text-primary' : 'text-white/30'}`}>{label}</p>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
    </div>
  );
}
