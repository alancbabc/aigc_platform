import { useState, useCallback } from 'react';
import { generateAPI } from '../../api/client';
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
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

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
    setGenerating(true);
    setError(null);
    setResult(null);
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
      });
      setResult({
        url: data.results[0].url,
        id: data.historyId,
      });
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(null), 4000);
    } finally {
      setGenerating(false);
    }
  }, [prompt, selectedModelId, selectedSize, referenceImage]);

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
          ) : generating ? (
            <EmptyState icon="⏳" title="生成中..." description="AI 正在为您创作图片，请稍候" />
          ) : (
            <EmptyState
              icon="🖼"
              title="开始创作"
              description="输入 Prompt，选择模型和尺寸，可选上传参考图，点击生成"
            />
          )}

          <PromptInput
            value={prompt}
            onChange={setPrompt}
            placeholder="描述你想要生成的画面，例如：一只在夕阳下奔跑的赛博朋克猫..."
            disabled={generating}
          />

          <GenerateButton
            onClick={handleGenerate}
            loading={generating}
            disabled={!prompt.trim()}
            label="生成图片"
          />

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
