import { useState, useCallback } from 'react';
import { generateAPI, useTaskPolling } from '../../api/client';
import { imageModels, getImageModelById } from '../../data/models';
import ModelDropdown from '../common/ModelDropdown';
import SimpleDropdown from '../common/SimpleDropdown';
import UploadButton from '../common/UploadButton';
import PromptInput from '../common/PromptInput';
import GenerateButton from '../common/GenerateButton';
import ResultDisplay from '../common/ResultDisplay';
import EmptyState from '../common/EmptyState';

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read reference image'));
    reader.readAsDataURL(file);
  });
}

export default function ImageStudio() {
  const [selectedModelId, setSelectedModelId] = useState(imageModels[0].id);
  const [selectedSize, setSelectedSize] = useState(imageModels[0].defaultSize);
  const [referenceImage, setReferenceImage] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [seed, setSeed] = useState('');
  const [inferenceSteps, setInferenceSteps] = useState(imageModels[0].defaultInferenceSteps);
  const [error, setError] = useState(null);

  const { taskStatus, taskResult, taskError, isGenerating, startTask, resetTask } = useTaskPolling();
  const result = taskResult?.results?.[0]
    ? { url: taskResult.results[0].url, id: taskResult.historyId }
    : null;
  const displayError = error || taskError;

  const currentModel = getImageModelById(selectedModelId);
  const sizes = currentModel.sizes || [];

  const handleModelSelect = useCallback((model) => {
    setSelectedModelId(model.id);
    setSelectedSize(model.defaultSize);
  }, []);

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

      const data = await generateAPI.image({
        model: selectedModelId,
        prompt: prompt.trim(),
        size: selectedSize,
        image: imageBase64,
        negative_prompt: negativePrompt.trim() || undefined,
        seed: seed || undefined,
        num_inference_steps: inferenceSteps,
      });
      startTask(data.taskId);
    } catch (err) {
      setError(err.message);
    }
  }, [prompt, negativePrompt, seed, inferenceSteps, selectedModelId, selectedSize, referenceImage, startTask, resetTask]);

  const handleDownload = async () => {
    if (!result?.url) return;
    try {
      const response = await fetch(result.url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = result.url.split('/').pop() || 'generated.png';
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
          models={imageModels}
          selectedModel={selectedModelId}
          onSelect={handleModelSelect}
        />
        <SimpleDropdown
          title="尺寸"
          options={sizes}
          selected={selectedSize}
          onSelect={setSelectedSize}
        />
        {currentModel.supportsInferenceSteps && (
          <SimpleDropdown
            title="推理步数"
            options={currentModel.inferenceStepOptions.map(String)}
            selected={String(inferenceSteps)}
            onSelect={(v) => setInferenceSteps(parseInt(v))}
          />
        )}
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
            <ResultDisplay url={result.url} type="image" onDownload={handleDownload} />
          ) : isGenerating ? (
            <EmptyState icon="⏳" title="生成中..." description="AI 正在为您创作图片，请稍候" />
          ) : (
            <EmptyState
              icon="🖼"
              title="开始创作"
              description="输入 Prompt，选择模型和尺寸，可选上传参考图，点击生成"
            />
          )}

          <div className="w-full max-w-2xl flex flex-col gap-3">
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

            <PromptInput
              value={prompt}
              onChange={setPrompt}
              placeholder="描述你想要生成的画面，例如：一只在夕阳下奔跑的赛博朋克猫..."
              disabled={isGenerating}
            />

            <div className="flex items-center gap-3">
              {currentModel.supportsSeed && (
                <input
                  type="number"
                  value={seed}
                  onChange={e => setSeed(e.target.value)}
                  placeholder="Seed（留空随机）"
                  disabled={isGenerating}
                  className="w-40 bg-white/[0.03] border border-border rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/15 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30"
                />
              )}

              <GenerateButton
                onClick={handleGenerate}
                loading={isGenerating}
                disabled={!prompt.trim()}
                label="生成图片"
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
