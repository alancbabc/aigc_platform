import { useState, useCallback } from 'react';
import { generateAPI, useMediaUrl, useTaskPolling } from '../../api/client';
import { videoModels, getVideoModelById } from '../../data/models';
import ModelDropdown from '../common/ModelDropdown';
import SimpleDropdown from '../common/SimpleDropdown';
import UploadButton from '../common/UploadButton';
import PromptInput from '../common/PromptInput';
import GenerateButton from '../common/GenerateButton';
import EmptyState from '../common/EmptyState';

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read reference image'));
    reader.readAsDataURL(file);
  });
}

export default function VideoStudio() {
  const [selectedModelId, setSelectedModelId] = useState(videoModels[0].id);
  const [referenceImage, setReferenceImage] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [seed, setSeed] = useState('');
  const [resolution, setResolution] = useState(videoModels[0].defaultResolution);
  const [duration, setDuration] = useState(videoModels[0].defaultDuration);
  const [quality, setQuality] = useState(videoModels[0].defaultQuality);
  const [enhancePrompt, setEnhancePrompt] = useState(false);
  const [error, setError] = useState(null);

  const { taskStatus, taskResult, taskError, isGenerating, startTask, resetTask } = useTaskPolling();
  const result = taskResult?.results?.[0]
    ? { url: taskResult.results[0].url, id: taskResult.historyId }
    : null;
  const resultMediaUrl = useMediaUrl(result?.url || '');
  const displayError = error || taskError;

  const currentModel = getVideoModelById(selectedModelId);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setError('请输入 Prompt 描述');
      return;
    }
    setError(null);
    resetTask();
    try {
      let imageBase64 = undefined;
      if (referenceImage) {
        imageBase64 = await readFileAsBase64(referenceImage);
      }

      const data = await generateAPI.video({
        model: selectedModelId,
        prompt: prompt.trim(),
        image_base64: imageBase64,
        image_url: (!imageBase64 ? imageUrl : '') || '',
        negative_prompt: negativePrompt.trim() || undefined,
        seed: seed || undefined,
        duration,
        resolution,
        quality,
        enhance_prompt: enhancePrompt,
      });
      startTask(data.taskId);
    } catch (err) {
      setError(err.message);
    }
  }, [prompt, negativePrompt, seed, selectedModelId, referenceImage, imageUrl, duration, resolution, quality, enhancePrompt, startTask, resetTask]);

  const handleDownload = async () => {
    if (!result?.url) return;
    try {
      const response = await fetch(result.url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = result.url.split('/').pop() || 'generated.mp4';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(result.url, '_blank');
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 px-6 py-4 flex items-center gap-3 border-b border-border flex-wrap">
        <ModelDropdown
          models={videoModels}
          selectedModel={selectedModelId}
          onSelect={(m) => setSelectedModelId(m.id)}
        />
        <SimpleDropdown
          title="质量"
          options={currentModel.qualities.map(q => q.name)}
          selected={currentModel.qualities.find(q => q.id === quality)?.name || '高质量'}
          onSelect={(v) => {
            const q = currentModel.qualities.find(q => q.name === v);
            if (q) setQuality(q.id);
          }}
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
        <UploadButton
          onUpload={(file) => setReferenceImage(file)}
          onClear={() => setReferenceImage(null)}
          accept="image/*"
        />
        {referenceImage && (
          <span className="text-[11px] text-white/40 truncate max-w-[100px]">{referenceImage.name}</span>
        )}
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 overflow-y-auto">
          {result ? (
            <div className="max-w-2xl w-full aspect-video rounded-2xl overflow-hidden border border-border bg-white/[0.02] relative group">
              <video src={resultMediaUrl} controls autoPlay loop muted className="w-full h-full object-contain" />
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={handleDownload}
                  className="px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-lg text-xs text-white hover:bg-white/20 transition-colors">
                  下载
                </button>
              </div>
            </div>
          ) : isGenerating ? (
            <EmptyState icon="⏳" title="生成中..." description="视频生成需要较长时间，请耐心等待" />
          ) : (
            <EmptyState
              icon="🎬"
              title="开始创作视频"
              description="输入 Prompt，选择参数，点击生成。如需图生视频，可提供图片 URL"
            />
          )}

          <div className="w-full max-w-2xl flex flex-col gap-3">
            {!result && !referenceImage && (
              <input
                type="text"
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                placeholder="图片 URL（可选，用于图生视频；或使用上方按钮上传图片）"
                className="w-full bg-white/[0.03] border border-border rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/15 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30"
              />
            )}

            {currentModel.supportsNegativePrompt && (
              <textarea
                value={negativePrompt}
                onChange={e => setNegativePrompt(e.target.value)}
                placeholder="负向提示词（可选）：描述你不想要的内容..."
                rows={1}
                disabled={isGenerating}
                className="w-full bg-white/[0.03] border border-border rounded-xl px-4 py-2 text-sm text-white placeholder:text-white/15 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30 resize-none"
              />
            )}

            {currentModel.supportsSeed && (
              <input
                type="number"
                value={seed}
                onChange={e => setSeed(e.target.value)}
                placeholder="Seed（留空随机）"
                disabled={isGenerating}
                className="w-full bg-white/[0.03] border border-border rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/15 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30"
              />
            )}

            <PromptInput
              value={prompt}
              onChange={setPrompt}
              placeholder="描述你想要生成的视频内容..."
              disabled={isGenerating}
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

              <GenerateButton
                onClick={handleGenerate}
                loading={isGenerating}
                disabled={!prompt.trim()}
                label="生成视频"
              />
            </div>
          </div>

          {displayError && (
            <div className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg animate-fade-in">
              <p className="text-red-400 text-xs">{displayError}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
