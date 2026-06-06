import { useState, useCallback, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { createGenerationAPI } from '../../api/client';
import { interpolationModels, getInterpolationModelById } from '../../data/models';
import ModelDropdown from '../common/ModelDropdown';
import SimpleDropdown from '../common/SimpleDropdown';
import ResolutionSelector from '../common/ResolutionSelector';
import AudioPicker from '../common/AudioPicker';
import AudioInsertPosition from '../common/AudioInsertPosition';
import PromptInput from '../common/PromptInput';
import NegativePromptInput from '../common/NegativePromptInput';
import GenerateButton from '../common/GenerateButton';
import { showToast } from '../common/Toast';
import { readFileAsBase64, revokeObjectURL } from '../../utils/fileHelpers';
import { useTasks } from '../../contexts/TaskContext';

let seq = 0;
function taskId() { return `c_${Date.now()}_${++seq}`; }

const MAX_FRAMES = 10;

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function defaultPosition(index, total) {
  if (total <= 1) return 0;
  return Math.round((index * 100) / (total - 1));
}

function defaultsForCount(count, type) {
  return Array.from({ length: count }, (_, index) => (
    type === 'position' ? defaultPosition(index, count) : 1
  ));
}

function parseList(value, count, { min, max, type }) {
  const fallback = defaultsForCount(count, type);
  const parsed = value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => clamp(item, min, max));

  return fallback.map((fallbackValue, index) => parsed[index] ?? fallbackValue);
}

function formatList(values, type) {
  return values.map(value => (
    type === 'position' ? Math.round(value) : Number(value).toFixed(1)
  )).join(', ');
}

export default function InterpolationStudio() {
  const { addTask, updateTask, optimizeOpen, setOptimizeOpen, setOptimizePanel } = useTasks();
  const loc = useLocation();
  const fileInputRef = useRef(null);
  const framesRef = useRef([]);
  const batchCountRef = useRef(0);
  const batchTimerRef = useRef(0);

  const [sid, setSid] = useState(interpolationModels[0].id);
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('text, subtitles, lower-third, chyron, nameplate, news broadcast, TV graphics, interview, breaking news banner, character introduction overlay, manga annotation, comic annotation, text bubble, lettering artifacts, on-screen text, kana, furigana, character card, profile card, vertical text, vertical subtitles, vertical title card');
  const [seed] = useState('');
  const [resolution, setResolution] = useState(interpolationModels[0].defaultResolution);
  const [resolutionPreset, setResolutionPreset] = useState(interpolationModels[0].defaultResolutionPreset);
  const [aspectRatio, setAspectRatio] = useState(interpolationModels[0].defaultAspectRatio);
  const [duration, setDuration] = useState(interpolationModels[0].defaultDuration);
  const [frames, setFrames] = useState([]);
  const [positionText, setPositionText] = useState('');
  const [strengthText, setStrengthText] = useState('');
  const [audio, setAudio] = useState(null);
  const [audioPosition, setAudioPosition] = useState(0);
  const [generationCount, setGenerationCount] = useState(1);
  const [activeCount, setActiveCount] = useState(0);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const currentModel = getInterpolationModelById(sid);
  const canGenerate = prompt.trim() && frames.length > 0;

  useEffect(() => {
    if (loc.state?.reusePrompt) setPrompt(loc.state.reusePrompt);
  }, [loc.key, loc.state?.reusePrompt]);

  useEffect(() => {
    if (optimizeOpen) setOptimizePanel({ prompt, type: 'interpolation', onApply: setPrompt });
  }, [optimizeOpen, prompt, setOptimizePanel]);

  useEffect(() => {
    framesRef.current = frames;
  }, [frames]);

  useEffect(() => () => {
    framesRef.current.forEach(frame => revokeObjectURL(frame.previewUrl));
  }, []);

  const syncParameterText = (count) => {
    setPositionText(formatList(defaultsForCount(count, 'position'), 'position'));
    setStrengthText(formatList(defaultsForCount(count, 'strength'), 'strength'));
  };

  const showBatchToast = () => {
    batchCountRef.current++;
    clearTimeout(batchTimerRef.current);
    batchTimerRef.current = setTimeout(() => {
      showToast(`生成完成 (${batchCountRef.current} 个)`, 'success');
      batchCountRef.current = 0;
    }, 500);
  };

  const addFrameFiles = (files) => {
    const selected = Array.from(files || []);
    if (selected.length === 0) return;

    setFrames(prev => {
      const added = selected.map(file => ({
        file,
        uid: `${Date.now()}_${Math.random()}`,
        previewUrl: URL.createObjectURL(file),
      }));
      const next = [...prev, ...added].slice(0, MAX_FRAMES);
      if (prev.length + selected.length > MAX_FRAMES) {
        showToast(`最多支持 ${MAX_FRAMES} 张关键帧，已保留前 ${MAX_FRAMES} 张`, 'info', 3000);
      }
      syncParameterText(next.length);
      return next;
    });
  };

  const addFrames = (event) => {
    addFrameFiles(event.target.files);
    event.target.value = '';
  };

  const clearFrames = () => {
    setFrames(prev => {
      prev.forEach(frame => revokeObjectURL(frame.previewUrl));
      return [];
    });
    setPositionText('');
    setStrengthText('');
  };

  const removeFrame = (uid) => {
    setFrames(prev => {
      const next = prev.filter(frame => frame.uid !== uid);
      const removed = prev.find(frame => frame.uid === uid);
      if (removed) revokeObjectURL(removed.previewUrl);
      syncParameterText(next.length);
      return next;
    });
  };

  const parsedPositions = parseList(positionText, frames.length, { min: 0, max: 100, type: 'position' }).map(Math.round);
  const parsedStrengths = parseList(strengthText, frames.length, { min: 0, max: 1, type: 'strength' });

  const generate = useCallback(async (submitPrompt, submitNegative) => {
    const p = submitPrompt || prompt;
    const n = submitNegative !== undefined ? submitNegative : negativePrompt;
    if (!p.trim() || frames.length === 0) return;

    const id = taskId();
    addTask({
      id,
      generationId: null,
      type: 'interpolation',
      prompt: p.trim(),
      model: currentModel.name,
      status: 'generating',
      results: null,
      error: null,
    });
    setActiveCount(count => count + 1);
    setError(null);
    showToast('任务已提交', 'info');

    try {
      const framePayload = await Promise.all(frames.map(frame => readFileAsBase64(frame.file)));
      const audioPayload = audio ? await readFileAsBase64(audio) : undefined;
      const data = await createGenerationAPI().interpolation({
        model: currentModel,
        mode: 'interpolation',
        prompt: p.trim(),
        frames: framePayload,
        frame_positions: parsedPositions,
        frame_strengths: parsedStrengths,
        negative_prompt: n.trim() || undefined,
        seed: seed || undefined,
        duration,
        resolution,
        resolution_preset: resolutionPreset,
        aspect_ratio: aspectRatio,
        audio_base64: audioPayload,
        audio_insert_position: audio ? audioPosition : 0,
        gen_num: generationCount,
      });

      updateTask(id, { generationId: data.generationId || id, status: 'done', results: data.results, duration: data.duration });
      showBatchToast();

      if (data.translatedPrompt && data.translatedPrompt !== p.trim() && prompt === p.trim()) setPrompt(data.translatedPrompt);
      if (data.translationStatus === 'no_key') showToast('翻译功能不可用：未配置 Gitee API Key，使用原文生成', 'error', 6000);
      else if (data.translationStatus === 'failed') showToast('Prompt 翻译失败，使用原文生成', 'error', 6000);
      if (data.errors) {
        setError(`部分失败: ${data.errors.join('; ')}`);
        setTimeout(() => setError(null), 10000);
      }
    } catch (err) {
      updateTask(id, { status: 'failed', error: err.message });
      setError(err.message);
      showToast(`失败: ${err.message}`, 'error');
      setTimeout(() => setError(null), 10000);
    } finally {
      setActiveCount(count => count - 1);
    }
  }, [prompt, negativePrompt, seed, currentModel, frames, parsedPositions, parsedStrengths, duration, resolution, resolutionPreset, aspectRatio, audio, audioPosition, generationCount, addTask, updateTask]);

  return (
    <div className="h-full flex overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {activeCount > 0 && (
          <div className="flex-shrink-0 mx-3 mt-3 px-2 py-1 bg-primary/10 border border-primary/20 rounded-md flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 border-2 border-white/10 border-t-primary rounded-full animate-spin" />
            <span className="text-[10px] text-primary font-medium">生成中 ({activeCount})</span>
          </div>
        )}

        <div className="flex-1 flex flex-col min-h-0 p-4 gap-3 overflow-y-auto custom-scrollbar">
          <div className="flex items-center gap-2 flex-wrap">
            <ModelDropdown models={interpolationModels} selectedModel={sid} onSelect={(model) => setSid(model.id)} />
            <ResolutionSelector initialValue={resolution} resolutionOptions={currentModel.resolutionOptions} aspectRatioOptions={currentModel.aspectRatioOptions} initialResolution={resolutionPreset} initialAspectRatio={aspectRatio} onSelect={(value, meta) => { setResolution(value); setResolutionPreset(meta.resolution); setAspectRatio(meta.aspectRatio); }} />
            <SimpleDropdown title="时长" options={currentModel.durations.map(String)} selected={String(duration)} onSelect={(value) => setDuration(parseInt(value))} />
          </div>

          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={addFrames} />
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              addFrameFiles(event.dataTransfer.files);
            }}
            className={`flex-shrink-0 min-h-24 rounded-lg cursor-pointer transition-all flex items-center justify-center ${
              dragOver ? 'bg-primary/5 text-primary' : 'bg-white/[0.01] text-primary/80 hover:bg-primary/5'
            }`}
          >
            <div className="px-2.5 py-1 rounded-md bg-primary/10 border border-primary/25 text-[11px] font-semibold text-primary">
              上传关键帧图片（最多{MAX_FRAMES}张）
            </div>
          </div>

          <FrameParameterPanel
            frames={frames}
            positionText={positionText}
            strengthText={strengthText}
            onPositionChange={setPositionText}
            onStrengthChange={setStrengthText}
            onRemoveFrame={removeFrame}
            onClearFrames={clearFrames}
          />

          <AudioPicker file={audio} onUpload={setAudio} onClear={() => setAudio(null)} label="上传音频（可选）" />
          <AudioInsertPosition value={audioPosition} onChange={setAudioPosition} duration={duration} />
          {currentModel.supportsNegativePrompt && <NegativePromptInput value={negativePrompt} onChange={setNegativePrompt} placeholder="负向提示词（可选）" />}
          <PromptInput value={prompt} onChange={setPrompt} placeholder="描述关键帧之间的过渡效果和视频内容。上传关键帧图片（可选音频）后点击「生成插帧生音视频」" />
        </div>

        <div className="flex-shrink-0 flex items-center gap-2 p-4 pt-0">
          <button onClick={() => setOptimizeOpen(!optimizeOpen)} className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${optimizeOpen ? 'bg-primary/10 text-primary border-primary/30' : 'bg-white/[0.03] text-white/40 border-border hover:text-white hover:bg-white/10'}`}>
            {optimizeOpen ? '关闭优化' : '优化 Prompt'}
          </button>
          <SimpleDropdown title="数量" options={['1', '2', '4']} selected={String(generationCount)} onSelect={(value) => setGenerationCount(parseInt(value))} />
          <GenerateButton onClick={() => generate()} disabled={!canGenerate} label={canGenerate ? '生成插帧生音视频' : !prompt.trim() && frames.length === 0 ? '请上传关键帧图片并输入 Prompt' : !prompt.trim() ? '请输入 Prompt' : '请上传关键帧图片'} />
        </div>

        {error && (
          <div className="px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-md">
            <p className="text-red-400 text-[10px]">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ParameterInput({ label, value, onChange }) {
  return (
    <div>
      <div className="inline-flex max-w-full rounded-md bg-primary/15 px-2 py-1 text-[11px] font-semibold leading-5 text-primary">
        {label}
      </div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-border bg-white/[0.03] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary/30"
      />
    </div>
  );
}

function FrameParameterPanel({
  frames,
  positionText,
  strengthText,
  onPositionChange,
  onStrengthChange,
  onRemoveFrame,
  onClearFrames,
}) {
  return (
    <div className="flex-shrink-0 rounded-lg border border-border bg-white/[0.02] p-3 space-y-3">
      <div className="min-h-24 rounded-md bg-black/10 border border-border/70 p-2">
        {frames.length === 0 ? (
          <div className="h-20 rounded-md border border-dashed border-white/10" />
        ) : (
          <div className="flex flex-wrap gap-2">
            {frames.map((frame, index) => (
              <div key={frame.uid} className="relative w-16 h-16 rounded overflow-hidden border border-border bg-black/30 group">
                  <img src={frame.previewUrl} alt="" className="w-full h-full object-cover" />
                  <span className="absolute bottom-0 left-0 right-0 bg-black/70 text-center text-[8px] text-white/80">{index + 1}</span>
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/55 group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => onRemoveFrame(frame.uid)}
                      className="px-2 py-1 rounded-lg bg-red-500/20 text-[10px] text-red-300 hover:bg-red-500/30 hover:text-red-200 transition-colors"
                    >
                      删除
                    </button>
                  </div>
              </div>
            ))}
            <button
              type="button"
              onClick={onClearFrames}
              className="h-20 px-3 rounded-md border border-border text-[10px] text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              清空
            </button>
          </div>
        )}
      </div>

      <ParameterInput
        label="关键帧时间点（百分比，用逗号分隔，0-100），与输入的关键帧图片数量一致"
        value={positionText}
        onChange={onPositionChange}
      />
      <ParameterInput
        label="控制关键帧图片的保持程度，1.0 为完全保持，0.0 为完全忽略（小数，用逗号分隔，0.0-1.0），与输入的关键帧图片数量一致"
        value={strengthText}
        onChange={onStrengthChange}
      />
    </div>
  );
}
