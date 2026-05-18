import { useRef, useState } from 'react';

export default function UploadButton({ onUpload, onClear, accept = 'image/*' }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const handleChange = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    e.target.value = '';
    setUploading(true);
    const previewUrl = URL.createObjectURL(f);
    setFile({ name: f.name, url: previewUrl, file: f });
    onUpload?.(f);
    setUploading(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (file?.url && file.url.startsWith('blob:')) URL.revokeObjectURL(file.url);
    setFile(null);
    onClear?.();
  };

  return (
    <div className="relative">
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleChange} />
      {file ? (
        <div className="relative w-10 h-10 rounded-full overflow-hidden border border-primary/60 group">
          <img src={file.url} alt="" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
          >
            <span className="text-white text-xs font-bold">✕</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-10 h-10 rounded-full border border-border hover:border-primary/40 bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all group"
          title="上传参考图"
        >
          {uploading ? (
            <div className="w-4 h-4 border-2 border-white/10 border-t-primary rounded-full animate-spin" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className="text-white/40 group-hover:text-primary transition-colors">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
