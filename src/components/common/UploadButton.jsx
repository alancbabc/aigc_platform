import { useEffect, useRef, useState } from 'react';

const MAX_FILE_SIZE = 20 * 1024 * 1024;

const IMAGE_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

export default function UploadButton({ onUpload, onClear, accept = 'image/*', label, icon }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [fileError, setFileError] = useState(null);
  const inputRef = useRef(null);
  const isAudio = accept?.startsWith('audio');

  useEffect(() => () => {
    if (file?.url && file.url.startsWith('blob:')) URL.revokeObjectURL(file.url);
  }, [file?.url]);

  const handleChange = async (e) => {
    const nextFile = e.target.files?.[0];
    if (!nextFile) return;
    e.target.value = '';
    setFileError(null);
    if (nextFile.size > MAX_FILE_SIZE) {
      setFileError(`文件超过大小限制 (${Math.round(MAX_FILE_SIZE / 1024 / 1024)}MB)`);
      return;
    }
    setUploading(true);
    const previewUrl = isAudio ? null : URL.createObjectURL(nextFile);
    setFile({ name: nextFile.name, url: previewUrl, file: nextFile });
    onUpload?.(nextFile);
    setUploading(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (file?.url && file.url.startsWith('blob:')) URL.revokeObjectURL(file.url);
    setFile(null);
    onClear?.();
  };

  const showPreview = file && !isAudio;

  return (
    <div className="relative">
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleChange} />
      {showPreview ? (
        <div className="relative w-10 h-10 rounded-full overflow-hidden border border-primary/60 group">
          <img src={file.url} alt="" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
          >
            <span className="text-white text-xs font-bold">×</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={`w-10 h-10 rounded-full border transition-all flex items-center justify-center group ${
            file
              ? 'border-primary/60 bg-primary/5'
              : 'border-border hover:border-primary/40 bg-white/5 hover:bg-white/10'
          }`}
          title={label || '上传参考图'}
        >
          {uploading ? (
            <div className="w-4 h-4 border-2 border-white/10 border-t-primary rounded-full animate-spin" />
          ) : file ? (
            <span className="text-xs text-primary font-bold">{file.name.charAt(0).toUpperCase()}</span>
          ) : (
            <span className="text-white/40 group-hover:text-primary transition-colors">
              {icon || IMAGE_ICON}
            </span>
          )}
        </button>
      )}
      {file && isAudio && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-[8px]"
        >
          ×
        </button>
      )}
      {fileError && (
        <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 bg-red-500/20 border border-red-500/30 rounded text-[10px] text-red-400">
          {fileError}
        </div>
      )}
    </div>
  );
}
