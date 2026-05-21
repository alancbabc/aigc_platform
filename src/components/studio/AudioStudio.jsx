import { useState, useCallback } from 'react';
import { generateAPI, useMediaUrl, useTaskPolling } from '../../api/client';
import { audioModels, getAudioModelById } from '../../data/models';
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
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

const EMOTION_LABELS = ['高兴', '愤怒', '悲伤', '害怕', '厌恶', '忧郁', '惊讶', '平静'];

export default function AudioStudio() {
  const [selectedModelId, setSelectedModelId] = useState(audioModels[0].id);
  const [inputs, setInputs] = useState('');

  // Qwen3-TTS params
  const [language, setLanguage] = useState('auto');
  const [speaker, setSpeaker] = useState(audioModels[0].defaultSpeaker);
  const [instruct, setInstruct] = useState('');

  // IndexTTS-2 params
  const [refAudio, setRefAudio] = useState(null);
  const [emoVector, setEmoVector] = useState([0, 0, 0, 0, 0, 0, 0, 0]);
  const [emoText, setEmoText] = useState('');

  const [error, setError] = useState(null);

  const { taskStatus, taskResult, taskError, isGenerating, startTask, resetTask } = useTaskPolling();
  const result = taskResult?.results?.[0]
    ? { url: taskResult.results[0].url, id: taskResult.historyId }
    : null;
  const resultMediaUrl = useMediaUrl(result?.url || '');
  const displayError = error || taskError;

  const currentModel = getAudioModelById(selectedModelId);
  const isQwen = selectedModelId === 'Qwen3-TTS';
  const isIndex = selectedModelId === 'IndexTTS-2';

  const handleGenerate = useCallback(async () => {
    if (!inputs.trim()) {
      setError('请输入文本内容');
      return;
    }
    setError(null);
    resetTask();
    try {
      const params = {
        model: selectedModelId,
        inputs: inputs.trim(),
      };

      if (isQwen) {
        params.language = language;
        params.speaker = speaker;
        if (instruct.trim()) params.instruct = instruct.trim();
      }

      if (isIndex) {
        if (refAudio) {
          params.ref_audio_base64 = await readFileAsBase64(refAudio);
        }
        params.emo_vector = emoVector;
        if (emoText.trim()) params.emo_text = emoText.trim();
      }

      const data = await generateAPI.audio(params);
      startTask(data.taskId);
    } catch (err) {
      setError(err.message);
    }
  }, [inputs, selectedModelId, language, speaker, instruct, refAudio, emoVector, emoText, startTask, resetTask]);

  const handleDownload = async () => {
    if (!result?.url) return;
    try {
      const response = await fetch(result.url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = result.url.split('/').pop() || 'generated.wav';
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
          onSelect={(m) => {
            setSelectedModelId(m.id);
          }}
        />
        {isQwen && currentModel.supportsLanguage && (
          <SimpleDropdown
            title="语言"
            options={currentModel.languages}
            selected={language}
            onSelect={setLanguage}
          />
        )}
        {isQwen && currentModel.supportsSpeaker && (
          <SimpleDropdown
            title="音色"
            options={currentModel.speakers.map(s => s.id)}
            selected={speaker}
            onSelect={setSpeaker}
          />
        )}
        {isIndex && currentModel.supportsRefAudio && (
          <div className="flex items-center gap-2">
            <UploadButton
              onUpload={(file) => setRefAudio(file)}
              onClear={() => setRefAudio(null)}
              accept="audio/*"
              label="参考音频"
            />
            {!refAudio && (
              <span className="text-[10px] text-red-400/70 whitespace-nowrap">* 必填</span>
            )}
            {refAudio && (
              <span className="text-[10px] text-white/40 truncate max-w-[80px]">{refAudio.name}</span>
            )}
          </div>
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
                    <source src={resultMediaUrl} />
                  </audio>
                </div>
                <button onClick={handleDownload}
                  className="px-3 py-1.5 bg-white/5 rounded-lg text-xs text-white hover:bg-white/10 transition-colors">
                  下载
                </button>
              </div>
            </div>
          ) : isGenerating ? (
            <EmptyState icon="⏳" title="生成中..." description="AI 正在为您生成音频，请稍候" />
          ) : (
            <EmptyState
              icon="🎵"
              title="开始创作音频"
              description="输入文本内容，选择模型和参数，点击生成"
            />
          )}

          <div className="w-full max-w-2xl flex flex-col gap-3">
            {isQwen && currentModel.supportsInstruct && (
              <textarea
                value={instruct}
                onChange={e => setInstruct(e.target.value)}
                placeholder="音色描述（可选）：用自然语言描述想要的音色，如「温柔知性的女声」"
                rows={1}
                disabled={isGenerating}
                className="w-full bg-white/[0.03] border border-border rounded-xl px-4 py-2 text-sm text-white placeholder:text-white/15 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30 resize-none"
              />
            )}

            {isIndex && currentModel.supportsEmotionVector && (
              <div className="bg-white/[0.02] border border-border rounded-xl p-4">
                <p className="text-xs text-white/50 mb-3">情绪向量控制（0-1）</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {EMOTION_LABELS.map((label, i) => (
                    <div key={label} className="flex flex-col items-center gap-1">
                      <span className="text-[10px] text-white/40">{label}</span>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={emoVector[i]}
                        onChange={e => {
                          const newVec = [...emoVector];
                          newVec[i] = parseFloat(e.target.value);
                          setEmoVector(newVec);
                        }}
                        className="w-full h-1.5 accent-primary"
                      />
                      <span className="text-[10px] text-white/30">{emoVector[i].toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isIndex && currentModel.supportsEmotionText && (
              <textarea
                value={emoText}
                onChange={e => setEmoText(e.target.value)}
                placeholder="情绪参考文本（可选）：输入带有情绪的文本作为表达参考"
                rows={1}
                disabled={isGenerating}
                className="w-full bg-white/[0.03] border border-border rounded-xl px-4 py-2 text-sm text-white placeholder:text-white/15 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30 resize-none"
              />
            )}

            <PromptInput
              value={inputs}
              onChange={setInputs}
              placeholder="输入要转换为语音的文本内容..."
              disabled={isGenerating}
            />

            <GenerateButton
              onClick={handleGenerate}
              loading={isGenerating}
              disabled={!inputs.trim() || (isIndex && !refAudio)}
              label={isIndex && !refAudio ? '请先上传参考音频' : '生成语音'}
            />
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
