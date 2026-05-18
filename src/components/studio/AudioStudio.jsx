import { useState, useCallback } from 'react';
import { generateAPI } from '../../api/client';
import { audioModels, getAudioModelById } from '../../data/models';
import ModelDropdown from '../common/ModelDropdown';
import SimpleDropdown from '../common/SimpleDropdown';
import PromptInput from '../common/PromptInput';
import GenerateButton from '../common/GenerateButton';
import EmptyState from '../common/EmptyState';

export default function AudioStudio() {
  const [selectedModelId, setSelectedModelId] = useState(audioModels[0].id);
  const [selectedGender, setSelectedGender] = useState('female');
  const [selectedPitch, setSelectedPitch] = useState(5);
  const [selectedSpeed, setSelectedSpeed] = useState(5);
  const [inputs, setInputs] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const currentModel = getAudioModelById(selectedModelId);

  const handleModelSelect = useCallback((model) => {
    setSelectedModelId(model.id);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!inputs.trim()) {
      setError('请输入文本内容');
      return;
    }
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const params = {
        model: selectedModelId,
        inputs: inputs.trim(),
      };
      if (currentModel.supportsGender) params.gender = selectedGender;
      if (currentModel.supportsPitch) params.pitch = selectedPitch;
      if (currentModel.supportsSpeed) params.speed = selectedSpeed;

      const data = await generateAPI.audio(params);
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
  }, [inputs, selectedModelId, selectedGender, selectedPitch, selectedSpeed, currentModel]);

  const handleDownload = async () => {
    if (!result?.url) return;
    try {
      const response = await fetch(result.url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = result.url.split('/').pop() || 'generated.mp3';
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
          models={audioModels}
          selectedModel={selectedModelId}
          onSelect={handleModelSelect}
        />
        {currentModel.supportsGender && (
          <SimpleDropdown
            title="性别"
            options={['female', 'male']}
            selected={selectedGender}
            onSelect={setSelectedGender}
          />
        )}
        {currentModel.supportsPitch && (
          <SimpleDropdown
            title="音调"
            options={['1', '3', '5', '7', '9']}
            selected={String(selectedPitch)}
            onSelect={(v) => setSelectedPitch(parseInt(v))}
          />
        )}
        {currentModel.supportsSpeed && (
          <SimpleDropdown
            title="语速"
            options={['1', '3', '5', '7', '9']}
            selected={String(selectedSpeed)}
            onSelect={(v) => setSelectedSpeed(parseInt(v))}
          />
        )}
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 overflow-y-auto">
          {result ? (
            <div className="max-w-md w-full bg-white/[0.02] border border-border rounded-2xl p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-2xl">🎵</div>
                <div className="flex-1">
                  <p className="text-sm text-white font-bold mb-2">生成完成</p>
                  <audio controls className="w-full h-10">
                    <source src={result.url} />
                  </audio>
                </div>
                <button onClick={handleDownload}
                  className="px-3 py-1.5 bg-white/5 rounded-lg text-xs text-white hover:bg-white/10 transition-colors">
                  下载
                </button>
              </div>
            </div>
          ) : generating ? (
            <EmptyState icon="⏳" title="生成中..." description="AI 正在为您生成音频，请稍候" />
          ) : (
            <EmptyState
              icon="🎵"
              title="开始创作音频"
              description="输入文本内容，选择模型和参数，点击生成"
            />
          )}

          <PromptInput
            value={inputs}
            onChange={setInputs}
            placeholder="输入要转换为语音的文本内容..."
            disabled={generating}
          />

          <GenerateButton
            onClick={handleGenerate}
            loading={generating}
            disabled={!inputs.trim()}
            label="生成语音"
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
