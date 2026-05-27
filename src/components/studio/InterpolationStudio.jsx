import { useState, useCallback, useRef, useEffect } from 'react';
import { createGenerationAPI, getMediaUrl } from '../../api/client';
import { interpolationModels, getInterpolationModelById } from '../../data/models';
import ModelDropdown from '../common/ModelDropdown';
import SimpleDropdown from '../common/SimpleDropdown';
import PromptInput from '../common/PromptInput';
import GenerateButton from '../common/GenerateButton';
import EmptyState from '../common/EmptyState';
import { readFileAsBase64, revokeObjectURL } from '../../utils/fileHelpers';
import { downloadResult } from '../../utils/download';

export default function InterpolationStudio() {
  const [selectedModelId, setSelectedModelId] = useState(interpolationModels[0].id);
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [seed, setSeed] = useState('');
  const [resolution, setResolution] = useState(interpolationModels[0].defaultResolution);
  const [duration, setDuration] = useState(interpolationModels[0].defaultDuration);
  const [enhancePrompt, setEnhancePrompt] = useState(false);
  const [frameFiles, setFrameFiles] = useState([]);
  const [framePositions, setFramePositions] = useState('');
  const [frameStrengths, setFrameStrengths] = useState('');
  const [genNum, setGenNum] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [selectedResultIdx, setSelectedResultIdx] = useState(0);
  const fileInputRef = useRef(null);
  const [previewUrls, setPreviewUrls] = useState([]);
  const abortRef = useRef(null);
  const generatingRef = useRef(false);
  const submitGuardRef = useRef(false);

  useEffect(() => {
    return () => {
      previewUrls.forEach(url => revokeObjectURL(url));
      abortRef.current?.abort();
    };
  }, [previewUrls]);

  const currentModel = getInterpolationModelById(selectedModelId);

  const handleFrameUpload = (e) => {
    const files = Array.from(e.target.files || []);
    const newFiles = [...frameFiles, ...files].slice(0, 10);
    setFrameFiles(newFiles);
    const urls = newFiles.map(f => URL.createObjectURL(f));
    setPreviewUrls(prev => {
      prev.forEach(u => revokeObjectURL(u));
      return urls;
    });
    e.target.value = '';
  };

  const removeFrame = (index) => {
    revokeObjectURL(previewUrls[index]);
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
    setFrameFiles(prev => prev.filter((_, i) => i !== index));
  };

  const parseCommaSeparated = (input, label, expectedCount) => {
    if (!input.trim()) return null;
    const values = input.split(',').map(s => {
      const trimmed = s.trim();
      if (!trimmed || isNaN(parseFloat(trimmed))) {
        throw new Error(`${label}包含无效值: "${s.trim()}"，请检查输入格式`);
      }
      return parseFloat(trimmed);
    });
    if (values.length !== expectedCount) {
      throw new Error(`${label}数量(${values.length})与关键帧数量(${expectedCount})不匹配`);
    }
    return values;
  };

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setError('请输入 Prompt 描述');
      return;
    }
    if (frameFiles.length === 0) {
      setError('请上传至少一张关键帧图片');
      return;
    }
    if (submitGuardRef.current) return;
    submitGuardRef.current = true;
    abortRef.current = new AbortController();
    generatingRef.current = true;
    setGenerating(true);
    setError(null);
    setResults(null);
    setSelectedResultIdx(0);
    try {
      const base64Frames = await Promise.all(frameFiles.map(f => readFileAsBase64(f)));

      const positions = parseCommaSeparated(framePositions, '关键帧位置', frameFiles.length);
      const strengths = parseCommaSeparated(frameStrengths, '强度', frameFiles.length);

      const api = createGenerationAPI(abortRef.current.signal);
      const data = await api.interpolation({
        model: currentModel,
        prompt: prompt.trim(),
        frames: base64Frames,
        frame_positions: positions,
        frame_strengths: strengths,
        negative_prompt: negativePrompt.trim() || undefined,
        seed: seed || undefined,
        duration,
        resolution,
        enhance_prompt: enhancePrompt,
        gen_num: genNum,
      });
      if (generatingRef.current) {
        setResults(data.results);
        if (data.errors) {
          setError(`部分任务失败: ${data.errors.join('; ')}`);
          setTimeout(() => setError(null), 10000);
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setError('已取消生成');
      } else {
        setError(err.message);
      }
      setTimeout(() => setError(null), 10000);
    } finally {
      setGenerating(false);
      generatingRef.current = false;
      abortRef.current = null;
      submitGuardRef.current = false;
    }
  }, [prompt, negativePrompt, seed, currentModel, frameFiles, framePositions, frameStrengths, duration, resolution, enhancePrompt, genNum]);

  const handleDownload = (url) => downloadResult(url, 'generated.mp4');

  const currentResult = results?.[selectedResultIdx];

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 px-6 py-4 flex items-center gap-3 border-b border-border flex-wrap">
        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold border bg-primary/10 text-primary border-primary/30">
          插帧生成
        </span>
        <ModelDropdown
          models={interpolationModels}
          selectedModel={selectedModelId}
          onSelect={(m) => setSelectedModelId(m.id)}
        />
        <SimpleDropdown
          title="分辨率"
          options={currentModel.resolutions}
          selected={resolution}
          onSelect={setResolution}
        />
        <SimpleDropdown
          title="时长"
          options={currentModel.durations.map(String)}
          selected={String(duration)}
          onSelect={(v) => setDuration(parseInt(v))}
        />
        <div className="w-px h-6 bg-border hidden sm:block" />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFrameUpload}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 text-xs bg-white/[0.03] border border-border rounded-lg hover:bg-white/10 hover:border-primary/40 transition-all text-white/50 hover:text-white"
        >
          上传关键帧 ({frameFiles.length}/10)
        </button>
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 overflow-y-auto">
          {currentResult ? (
            <>
              <div className="max-w-2xl w-full aspect-video rounded-2xl overflow-hidden border border-border bg-white/[0.02] relative group">
                <video src={getMediaUrl(currentResult.url)} controls autoPlay loop muted className="w-full h-full object-contain" />
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleDownload(currentResult.url)}
                    className="px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-lg text-xs text-white hover:bg-white/20 transition-colors">
                    下载
                  </button>
                </div>
              </div>
              {results && results.length > 1 && (
                <div className="flex items-center gap-2">
                  {results.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedResultIdx(i)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                        i === selectedResultIdx
                          ? 'bg-primary/20 text-primary border border-primary/30'
                          : 'bg-white/5 text-white/40 border border-transparent hover:bg-white/10'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <span className="text-[10px] text-white/30 ml-1">共 {results.length} 个</span>
                </div>
              )}
            </>
          ) : generating ? (
            <EmptyState icon="⏳" title="生成中..." description="插帧视频生成需要较长时间，请耐心等待" />
          ) : (
            <EmptyState
              icon="🎞"
              title="关键帧插帧"
              description="上传多张关键帧图片，设置时间点和强度，AI 将生成平滑过渡视频"
            />
          )}

          {frameFiles.length > 0 && (
            <div className="w-full max-w-2xl flex flex-wrap gap-2">
              {frameFiles.map((file, i) => (
                <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-border group">
                  <img src={previewUrls[i]} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeFrame(i)}
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs transition-opacity"
                  >
                    ✕
                  </button>
                  <span className="absolute bottom-0 left-0 right-0 text-[8px] text-center bg-black/60 text-white/70">
                    {i + 1}
                  </span>
                </div>
              ))}
            </div>
          )}

          {!currentResult && !generating && (
            <div className="w-full max-w-2xl flex flex-col gap-3">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={framePositions}
                  onChange={e => setFramePositions(e.target.value)}
                  placeholder="关键帧位置(%)，逗号分隔，如: 0, 25, 50, 75, 100"
                  className="flex-1 bg-white/[0.03] border border-border rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/15 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30"
                />
                <input
                  type="text"
                  value={frameStrengths}
                  onChange={e => setFrameStrengths(e.target.value)}
                  placeholder="强度，逗号分隔，如: 1.0, 0.8, 0.8, 1.0"
                  className="flex-1 bg-white/[0.03] border border-border rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/15 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30"
                />
              </div>

            {currentModel.supportsNegativePrompt && (
              <textarea
                value={negativePrompt}
                onChange={e => setNegativePrompt(e.target.value)}
                placeholder="负向提示词（可选）：描述你不想要的内容..."
                rows={1}
                disabled={generating}
                className="w-full bg-white/[0.03] border border-border rounded-xl px-4 py-2 text-sm text-white placeholder:text-white/15 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30 resize-none"
              />
            )}

            {currentModel.supportsSeed && (
              <input
                type="number"
                value={seed}
                onChange={e => setSeed(e.target.value)}
                placeholder="Seed（留空随机）"
                disabled={generating}
                className="w-full bg-white/[0.03] border border-border rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/15 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30"
              />
            )}

            <PromptInput
              value={prompt}
              onChange={setPrompt}
              placeholder="描述关键帧之间的过渡效果..."
              disabled={generating}
            />

            <div className="flex items-center gap-3">
              {currentModel.supportsEnhancePrompt && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enhancePrompt}
                    onChange={e => setEnhancePrompt(e.target.checked)}
                    className="w-4 h-4 rounded border-border bg-white/[0.03] text-primary focus:ring-primary/30"
                  />
                  <span className="text-xs text-white/50">增强提示词</span>
                </label>
              )}

              <SimpleDropdown
                title="数量"
                options={['1', '2', '4']}
                selected={String(genNum)}
                onSelect={(v) => setGenNum(parseInt(v))}
              />
              {generating ? (
                <button
                  onClick={handleCancel}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all"
                >
                  取消生成
                </button>
              ) : (
                <GenerateButton
                  onClick={handleGenerate}
                  loading={generating}
                  disabled={!prompt.trim() || frameFiles.length === 0}
                  label="生成插帧视频"
                />
              )}
            </div>
            </div>
          )}

          {error && (
            <div className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg animate-fade-in">
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}