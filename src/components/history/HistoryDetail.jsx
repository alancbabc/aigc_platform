const paramLabels = {
  prompt: '提示词',
  negative_prompt: '负向提示词',
  height: '高度',
  width: '宽度',
  num_frames: '总帧数',
  frame_rate: '帧率',
  video_seconds: '时长(秒)',
  num_inference_steps: '推理步数',
  seed: '种子',
  pipeline_name: '流水线',
  has_reference_image: '参考图',
  language: '语言',
  speaker: '音色',
  instruct: '音色描述',
  text: '文本',
  emo_vector: '情绪向量',
  emo_text: '情绪参考文本',
  gen_num: '生成数量',
  keyframe_count: '关键帧数',
};

function formatParamValue(key, value) {
  if (value === null || value === undefined || value === '') return '-';
  if (key === 'has_reference_image') {
    return value ? '是' : '否';
  }
  if (key === 'emo_vector' && Array.isArray(value)) {
    return value.map(v => v.toFixed(1)).join(', ');
  }
  if (typeof value === 'boolean') return value ? '是' : '否';
  return String(value);
}

import { getMediaUrl } from '../../api/client';
import { downloadResult } from '../../utils/download';

const OUTPUT_EXT = {
  image: 'png',
  'image-edit': 'png',
  text2image: 'png',
  video: 'mp4',
  image2video: 'mp4',
  text2video: 'mp4',
  a2v: 'mp4',
  interpolation: 'mp4',
  audio: 'wav',
  clone: 'wav',
  speech: 'wav',
};

const isImage = (type) => ['image', 'image-edit', 'text2image'].includes(type);
const isVideo = (type) => ['video', 'interpolation', 'image2video', 'a2v', 'text2video'].includes(type);
const isAudio = (type) => ['audio', 'clone', 'speech'].includes(type);

export default function HistoryDetail({ item, onClose, onDelete }) {
  const results = Array.isArray(item.results) ? item.results : [];
  const ext = OUTPUT_EXT[item.type] || 'dat';

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8 animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0a0a0a] border border-border rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-4xl overflow-hidden"
      >
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <div>
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider">{item.type}</span>
            <h3 className="text-sm font-bold text-white mt-0.5">{item.model}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { onDelete(); onClose(); }}
              className="px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors font-medium"
            >
              删除
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {results.length > 0 && (
            <div className={results.length > 1 ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : ''}>
              {results.map((result, index) => {
                const resultUrl = getMediaUrl(result.url || '');
                if (!resultUrl) return null;
                return (
                  <div key={`${result.filename || result.url || index}`} className="relative rounded-xl border border-border bg-white/[0.02] overflow-hidden">
                    {results.length > 1 && (
                      <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-md bg-black/70 text-[10px] text-white/70">
                        结果 {index + 1}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => downloadResult(result.url, result.filename || `generated_${index + 1}.${ext}`)}
                      className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-md bg-black/70 text-[10px] text-white/70 hover:text-white"
                    >
                      下载
                    </button>
                    {isImage(item.type) && (
                      <img src={resultUrl} alt="" className="w-full max-h-[55vh] object-contain bg-black/20" loading="lazy" decoding="async" />
                    )}
                    {isVideo(item.type) && (
                      <video src={resultUrl} controls preload="metadata" className="w-full max-h-[55vh] bg-black" />
                    )}
                    {isAudio(item.type) && (
                      <div className="flex flex-col items-center gap-4 py-8 px-4">
                        <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center text-4xl">
                          🎵
                        </div>
                        <audio src={resultUrl} controls preload="metadata" className="w-full max-w-md" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {item.prompt && (
            <div className="mt-6">
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Prompt</span>
              <p className="text-sm text-white/80 mt-1.5 leading-relaxed bg-white/[0.02] rounded-lg p-4 border border-border">
                {item.prompt}
              </p>
            </div>
          )}

          {/* 动态渲染所有存储的参数 */}
          {item.params && Object.keys(item.params).length > 0 && (
            <div className="mt-6">
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">生成参数</span>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(item.params).map(([key, value]) => {
                  if (key === 'prompt' || key === 'text') return null;
                  if (value === null || value === undefined || value === '') return null;
                  const label = paramLabels[key] || key;
                  return (
                    <div key={key} className="bg-white/[0.02] rounded-lg p-2.5 border border-border">
                      <span className="text-[10px] font-bold text-white/30 uppercase">{label}</span>
                      <p className="text-xs text-white/70 mt-0.5 truncate">{formatParamValue(key, value)}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <InfoRow label="模型" value={item.model} />
            <InfoRow label="类型" value={item.type} />
            {item.size && <InfoRow label="尺寸" value={item.size} />}
            <InfoRow label="创建时间" value={new Date(item.createdAt).toLocaleString('zh-CN')} />
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="bg-white/[0.02] rounded-lg p-3 border border-border">
      <span className="text-[10px] font-bold text-white/30 uppercase">{label}</span>
      <p className="text-xs text-white/70 mt-0.5 truncate">{value || '-'}</p>
    </div>
  );
}
