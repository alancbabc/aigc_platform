import { useRef, useState, useEffect } from 'react';
import { showToast } from './Toast';

const MAX_FILE_SIZE = 20 * 1024 * 1024;

export default function AudioPicker({ file, onUpload, onClear, label = '点击或拖拽上传音频' }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [fileName, setFileName] = useState('');

  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      setFileName(file.name);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);

  const handleFile = (f) => {
    if (!f) return;
    if (f.size > MAX_FILE_SIZE) { showToast('文件大小不能超过 20MB', 'error'); return; }
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    const url = URL.createObjectURL(f);
    setAudioUrl(url);
    setFileName(f.name);
    onUpload?.(f);
  };

  const handleChange = (e) => {
    handleFile(e.target.files?.[0]);
    e.target.value = '';
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setFileName('');
    onClear?.();
  };

  if (audioUrl) {
    return (
      <div className="bg-white/[0.02] border border-primary/40 rounded-lg p-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-white/60 truncate flex-1">{fileName}</span>
          <div className="flex gap-2">
            <button onClick={handleClear} className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors">删除</button>
          </div>
        </div>
        <audio src={audioUrl} controls className="w-full h-8" />
        <input ref={inputRef} type="file" accept="audio/*" className="hidden" onChange={handleChange} />
      </div>
    );
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
      className={`cursor-pointer rounded-lg border border-dashed px-3 py-2 flex items-center justify-center gap-2 min-h-14 transition-all ${
        dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-white/20 bg-white/[0.01]'
      }`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={dragOver ? 'text-primary' : 'text-white/20'}>
        <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
      </svg>
      <p className={`text-xs text-center ${dragOver ? 'text-primary' : 'text-white/30'}`}>{label}</p>
      <input ref={inputRef} type="file" accept="audio/*" className="hidden" onChange={handleChange} />
    </div>
  );
}
