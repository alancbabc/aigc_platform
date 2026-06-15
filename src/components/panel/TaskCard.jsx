import { useState } from 'react';
import { getMediaUrl } from '../../api/client';
import { downloadResult } from '../../utils/download';
import { useTasks } from '../../contexts/TaskContext';

const TYPE_LABELS = {
  image: '图片', 'image-edit': '图片编辑', text2image: '文生图',
  video: '视频', image2video: '图生音视频', a2v: '音生视频', text2video: '文生音视频', interpolation: '插帧生音视频',
  audio: '音频', clone: '语音克隆', speech: '语音合成',
};
const TYPE_COLORS = {
  image: 'border-blue-500/40 text-blue-400', 'image-edit': 'border-purple-500/40 text-purple-400', text2image: 'border-blue-500/40 text-blue-400',
  video: 'border-green-500/40 text-green-400', image2video: 'border-cyan-500/40 text-cyan-400', a2v: 'border-teal-500/40 text-teal-400', text2video: 'border-green-500/40 text-green-400', interpolation: 'border-green-500/40 text-green-400',
  audio: 'border-yellow-500/40 text-yellow-400', clone: 'border-orange-500/40 text-orange-400', speech: 'border-yellow-500/40 text-yellow-400',
};
const EXT = { image: 'png', 'image-edit': 'png', text2image: 'png', video: 'mp4', image2video: 'mp4', a2v: 'mp4', text2video: 'mp4', interpolation: 'mp4', audio: 'wav', clone: 'wav', speech: 'wav' };

function isImg(type) { return ['image','image-edit','text2image'].includes(type); }
function isVid(type) { return ['video','image2video','a2v','interpolation','text2video'].includes(type); }
function isAud(type) { return ['audio','clone','speech'].includes(type); }

export default function TaskCard({ task }) {
  const { removeTask } = useTasks();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const { status, prompt, model, type, results, error, duration } = task;
  const done = status === 'done';
  const failed = status === 'failed';
  const active = !done && !failed;
  const r = results?.[0];
  const rUrl = r ? getMediaUrl(r.url) : null;

  return (
    <div className={`bg-white/[0.02] border rounded-xl p-3 transition-colors ${active ? 'border-primary/20' : failed ? 'border-red-500/20' : 'border-border hover:border-white/10'}`}>
      {done && rUrl && (
        <div className="mb-2 rounded-lg overflow-hidden bg-black/20 relative group">
          {isImg(type) && <img src={rUrl} alt="" className="w-full h-60 object-contain cursor-pointer" loading="lazy" decoding="async" onClick={() => setFullscreen(true)} />}
          {isVid(type) && <video src={rUrl} className="w-full h-60 object-contain cursor-pointer" controls preload="metadata" onClick={() => setFullscreen(true)} />}
          {isAud(type) && (
            <div className="h-20 flex items-center justify-center">
              <audio src={rUrl} controls preload="metadata" className="w-full h-8" />
            </div>
          )}
          <button
            onClick={() => downloadResult(r.url, `generated.${EXT[type] || 'png'}`)}
            className="absolute top-2 right-2 px-2 py-0.5 bg-black/60 rounded text-[10px] text-white/80 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            下载
          </button>
        </div>
      )}
      {active && status !== 'unknown' && (
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-3 h-3 border-2 border-white/10 border-t-primary rounded-full animate-spin" />
            <span className="text-[10px] text-primary animate-pulse">生成中...</span>
          </div>
        </div>
      )}
      {status === 'unknown' && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] text-yellow-400">⚠ {error || '状态未知'}</span>
        </div>
      )}
      {failed && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] text-red-400">✕ {error || '生成失败'}</span>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`text-[8px] px-1 py-0.5 rounded border ${TYPE_COLORS[type] || 'border-white/20 text-white/40'}`}>
            {TYPE_LABELS[type] || type}
          </span>
          <span className="text-[10px] text-white/30 truncate">{model}</span>
          {done && duration != null && <span className="text-[9px] text-white/20">{formatDuration(duration)}</span>}
        </div>
        <button onClick={() => setConfirmDelete(true)} className="text-[10px] text-white/20 hover:text-red-400 transition-colors">删除</button>
      </div>
      <p className="text-[11px] text-white/40 truncate mt-1">{prompt}</p>
      {confirmDelete && (
        <div className="mt-2 flex items-center gap-2 justify-end">
          <button onClick={() => setConfirmDelete(false)} className="text-[10px] text-white/30 hover:text-white/50">取消</button>
          <button onClick={() => { removeTask(task.id); setConfirmDelete(false); }} className="text-[10px] text-red-400 hover:text-red-300">确认删除</button>
        </div>
      )}
      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center cursor-pointer" onClick={() => setFullscreen(false)}>
          {isImg(type) && <img src={rUrl} alt="" className="max-w-full max-h-full object-contain" loading="lazy" decoding="async" />}
          {isVid(type) && <video src={rUrl} controls autoPlay className="max-w-full max-h-full" />}
        </div>
      )}
    </div>
  );
}

function formatDuration(ms) {
  if (ms == null) return '';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}m${s}s`;
}
