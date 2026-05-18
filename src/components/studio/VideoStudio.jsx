import { useState, useCallback } from 'react';
import { generateAPI } from '../../api/client';
import { videoModels } from '../../data/models';
import ModelDropdown from '../common/ModelDropdown';
import PromptInput from '../common/PromptInput';
import GenerateButton from '../common/GenerateButton';
import EmptyState from '../common/EmptyState';

export default function VideoStudio() {
  const [selectedModelId, setSelectedModelId] = useState(videoModels[0].id);
  const [imageUrl, setImageUrl] = useState('');
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setError('请输入 Prompt 描述');
      return;
    }
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const data = await generateAPI.video({
        model: selectedModelId,
        prompt: prompt.trim(),
        image_url: imageUrl || '',
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
  }, [prompt, selectedModelId, imageUrl]);

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
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 overflow-y-auto">
          {result ? (
            <div className="max-w-2xl w-full aspect-video rounded-2xl overflow-hidden border border-border bg-white/[0.02] relative group">
              <video src={result.url} controls autoPlay loop muted className="w-full h-full object-contain" />
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={handleDownload}
                  className="px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-lg text-xs text-white hover:bg-white/20 transition-colors">
                  下载
                </button>
              </div>
            </div>
          ) : generating ? (
            <EmptyState icon="⏳" title="生成中..." description="视频生成需要较长时间，请耐心等待" />
          ) : (
            <EmptyState
              icon="🎬"
              title="开始创作视频"
              description="输入 Prompt，选择模型，点击生成。如需图生视频，可提供图片 URL"
            />
          )}

          <div className="w-full max-w-2xl flex flex-col gap-3">
            {!result && (
              <input
                type="text"
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                placeholder="图片 URL（可选，用于图生视频）"
                className="w-full bg-white/[0.03] border border-border rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/15 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30"
              />
            )}

            <PromptInput
              value={prompt}
              onChange={setPrompt}
              placeholder="描述你想要生成的视频内容..."
              disabled={generating}
            />

            <GenerateButton
              onClick={handleGenerate}
              loading={generating}
              disabled={!prompt.trim()}
              label="生成视频"
            />
          </div>

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
