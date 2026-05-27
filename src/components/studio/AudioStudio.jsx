import { useState, useCallback, useRef, useEffect } from 'react';
import { createGenerationAPI, getMediaUrl } from '../../api/client';
import { audioModels } from '../../data/models';
import ModelDropdown from '../common/ModelDropdown';
import SimpleDropdown from '../common/SimpleDropdown';
import UploadButton from '../common/UploadButton';
import PromptInput from '../common/PromptInput';
import GenerateButton from '../common/GenerateButton';
import EmptyState from '../common/EmptyState';
import { readFileAsBase64 } from '../../utils/fileHelpers';
import { downloadResult } from '../../utils/download';

const SPEECH_LANGUAGES = ['auto', 'chinese', 'english', 'japanese', 'korean'];
const EMOTION_LABELS = ['高兴', '愤怒', '悲伤', '害怕', '厌恶', '忧郁', '惊讶', '平静'];

export default function AudioStudio({ mode = 'speech' }) {
  const isClone = mode === 'clone';

  const [inputs, setInputs] = useState('');
  const [language, setLanguage] = useState('auto');
  const [speaker, setSpeaker] = useState(audioModels[0].speakers[0].id);
  const [instruct, setInstruct] = useState('');
  const [voiceDesignMode, setVoiceDesignMode] = useState(false);
  const [refAudio, setRefAudio] = useState(null);
  const [emoVector, setEmoVector] = useState([0, 0, 0, 0, 0, 0, 0, 0]);
  const [emoText, setEmoText] = useState('');
  const [useRandom, setUseRandom] = useState(false);
  const [emoAudio, setEmoAudio] = useState(null);
  const [emoExpanded, setEmoExpanded] = useState(false);
  const [genNum, setGenNum] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [selectedResultIdx, setSelectedResultIdx] = useState(0);

  const abortRef = useRef(null);
  const generatingRef = useRef(false);
  const submitGuardRef = useRef(false);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const hasRefAudio = !!refAudio;
  const canGenerate = isClone
    ? (!!inputs.trim() && hasRefAudio)
    : !!inputs.trim();

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) {
      setError(isClone ? '请输入文本并上传参考音频' : '请输入文本内容');
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
      const params = {
        model: isClone ? audioModels[1] : audioModels[0],
        inputs: inputs.trim(),
      };

      if (isClone) {
        if (refAudio) {
          params.ref_audio_base64 = await readFileAsBase64(refAudio);
        }
        if (!useRandom) {
          params.emo_vector = emoVector;
          if (emoText.trim()) params.emo_text = emoText.trim();
          if (emoAudio) {
            params.emo_audio_base64 = await readFileAsBase64(emoAudio);
          }
        } else {
          params.use_random = true;
        }
      } else {
        params.language = language;
        if (voiceDesignMode) {
          params.pipeline = 'qwen_tts_voicedesign';
          if (instruct.trim()) params.instruct = instruct.trim();
        } else {
          params.speaker = speaker;
          if (instruct.trim()) params.instruct = instruct.trim();
        }
      }

      params.gen_num = genNum;
      const api = createGenerationAPI(abortRef.current.signal);
      const data = await api.audio(params);
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
  }, [inputs, language, speaker, instruct, refAudio, emoVector, emoText, voiceDesignMode, genNum, useRandom, emoAudio, canGenerate, isClone]);

  const handleDownload = (url) => downloadResult(url, 'generated.wav');
  const currentResult = results?.[selectedResultIdx];

  const cloneConfig = {
    badge: '语音克隆',
    badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    icon: '🎙️',
    title: '语音克隆',
    desc: '上传参考音频作为音色样本，输入文本，AI 将复刻该音色并朗读文本',
    placeholder: '输入要克隆音色朗读的文本内容...',
    btnLabel: '生成语音',
    btnDisabledLabel: '请上传参考音频并输入文本',
  };

  const speechConfig = {
    badge: '语音合成',
    badgeClass: 'bg-primary/10 text-primary border-primary/30',
    icon: '🎵',
    title: '语音合成',
    desc: voiceDesignMode
      ? '用自然语言描述想要的音色，输入文本，AI 将合成为语音'
      : '选择预设音色，输入文本，AI 将合成为语音',
    placeholder: '输入要转换为语音的文本内容...',
    btnLabel: '生成语音',
    btnDisabledLabel: '请输入文本',
  };

  const cfg = isClone ? cloneConfig : speechConfig;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 px-6 py-4 flex items-center gap-3 border-b border-border flex-wrap">
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${cfg.badgeClass}`}>
          {cfg.badge}
        </span>

        <ModelDropdown
          models={isClone ? [audioModels[1]] : [audioModels[0]]}
          selectedModel={isClone ? audioModels[1].id : audioModels[0].id}
          onSelect={() => {}}
        />

        {!isClone && (
          <>
            <SimpleDropdown
              title="语言"
              options={SPEECH_LANGUAGES}
              selected={language}
              onSelect={setLanguage}
            />
            <button
              onClick={() => setVoiceDesignMode(!voiceDesignMode)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                voiceDesignMode
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'bg-white/[0.03] text-white/50 border-border hover:text-white hover:bg-white/10'
              }`}
            >
              {voiceDesignMode ? '音色设计' : '预设音色'}
            </button>
            {!voiceDesignMode && (
              <SimpleDropdown
                title="音色"
                options={audioModels[0].speakers.map(s => s.id)}
                selected={speaker}
                onSelect={setSpeaker}
              />
            )}
          </>
        )}

        {isClone && (
          <>
            <div className="flex items-center gap-1">
              <UploadButton
                onUpload={(file) => setRefAudio(file)}
                onClear={() => setRefAudio(null)}
                accept="audio/*"
                label="上传参考音频"
                icon={(
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                  </svg>
                )}
              />
              {!hasRefAudio && (
                <span className="text-[10px] text-red-400/70 whitespace-nowrap">* 必传</span>
              )}
              {refAudio && (
                <span className="text-[10px] text-white/40 truncate max-w-[80px]">{refAudio.name}</span>
              )}
            </div>
            <div className="flex items-center bg-white/[0.03] border border-border rounded-lg p-0.5 gap-0.5">
              <button
                onClick={() => setUseRandom(false)}
                className={`px-3 py-1 rounded-md text-xs transition-all ${!useRandom ? 'bg-primary/20 text-primary font-medium' : 'text-white/40 hover:text-white/70'}`}
              >
                指定情绪
              </button>
              <button
                onClick={() => setUseRandom(true)}
                className={`px-3 py-1 rounded-md text-xs transition-all ${useRandom ? 'bg-amber-500/20 text-amber-400 font-medium' : 'text-white/40 hover:text-white/70'}`}
              >
                随机情绪
              </button>
            </div>
          </>
        )}
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 overflow-y-auto">
          {currentResult ? (
            <>
              <div className="max-w-md w-full bg-white/[0.02] border border-border rounded-2xl p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-2xl">🎵</div>
                  <div className="flex-1">
                    <p className="text-sm text-white font-bold mb-2">生成完成</p>
                    <audio controls className="w-full h-10">
                      <source src={getMediaUrl(currentResult.url)} />
                    </audio>
                  </div>
                  <button onClick={() => handleDownload(currentResult.url)}
                    className="px-3 py-1.5 bg-white/5 rounded-lg text-xs text-white hover:bg-white/10 transition-colors">
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
            <EmptyState icon="⏳" title="生成中..." description="AI 正在为您生成音频，请稍候" />
          ) : (
            <EmptyState icon={cfg.icon} title={cfg.title} description={cfg.desc} />
          )}

          {!currentResult && !generating && (
            <div className="w-full max-w-2xl flex flex-col gap-3">
              {!isClone && voiceDesignMode && (
                <textarea
                  value={instruct}
                  onChange={e => setInstruct(e.target.value)}
                  placeholder="用自然语言描述想要的音色，如「温柔知性的女声」"
                  rows={2}
                  disabled={generating}
                  className="w-full bg-white/[0.03] border border-border rounded-xl px-4 py-2 text-sm text-white placeholder:text-white/15 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30 resize-none"
                />
              )}

              {isClone && !useRandom && (
                <>
                  <textarea
                    value={emoText}
                    onChange={e => setEmoText(e.target.value)}
                    placeholder="情绪参考文本（可选）：输入带有情绪的文本作为表达参考，如「今天真是太开心了！」"
                    rows={1}
                    disabled={generating}
                    className="w-full bg-white/[0.03] border border-border rounded-xl px-4 py-2 text-sm text-white placeholder:text-white/15 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30 resize-none"
                  />

                  <div className="flex items-center gap-3 flex-wrap">
                    <UploadButton
                      onUpload={(file) => setEmoAudio(file)}
                      onClear={() => setEmoAudio(null)}
                      accept="audio/*"
                      label="上传情绪音频"
                      icon={(
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                          <path d="M2 8c0 3 2 5 5 5s5-2 5-5" strokeWidth="1.5" opacity="0.5" />
                        </svg>
                      )}
                    />
                    {emoAudio && (
                      <span className="text-[10px] text-white/40 truncate max-w-[80px]">{emoAudio.name}</span>
                    )}
                    <span className="text-[10px] text-white/20">
                      音色克隆样本 ≠ 情绪音频 —— 上面的参考音频是必传的音色来源，情绪音频仅影响表达方式（可选）
                    </span>
                  </div>

                  <div>
                    <button
                      onClick={() => setEmoExpanded(!emoExpanded)}
                      className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
                    >
                      <svg
                        width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                        className={`transition-transform ${emoExpanded ? 'rotate-90' : ''}`}
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                      高级情绪控制（8 维向量精细调节）
                    </button>
                    {emoExpanded && (
                      <div className="mt-3 bg-white/[0.02] border border-border rounded-xl p-4 animate-fade-in">
                        <p className="text-[10px] text-white/30 mb-3">
                          调整每个情绪维度的强度（0=无，1=最大）。全部为 0 表示不指定情绪控制，AI 将自动判断。
                        </p>
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
                  </div>
                </>
              )}

              <PromptInput
                value={inputs}
                onChange={setInputs}
                placeholder={cfg.placeholder}
                disabled={generating}
              />

              <div className="flex items-center gap-3">
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
                    disabled={!canGenerate}
                    label={canGenerate ? cfg.btnLabel : cfg.btnDisabledLabel}
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
