import { useState, useCallback, useRef, useEffect } from 'react';
import { createGenerationAPI } from '../../api/client';
import { imageModels, getImageModelById } from '../../data/models';
import ModelDropdown from '../common/ModelDropdown';
import SimpleDropdown from '../common/SimpleDropdown';
import UploadButton from '../common/UploadButton';
import PromptInput from '../common/PromptInput';
import GenerateButton from '../common/GenerateButton';
import ResultDisplay from '../common/ResultDisplay';
import EmptyState from '../common/EmptyState';
import { readFileAsBase64 } from '../../utils/fileHelpers';
import { downloadResult } from '../../utils/download';

export default function ImageStudio({ mode = 'text2image' }) {
  const isEditMode = mode === 'image2image';

  const [selectedModelId, setSelectedModelId] = useState(imageModels[0].id);
  const [selectedSize, setSelectedSize] = useState(imageModels[0].defaultSize);
  const [referenceImages, setReferenceImages] = useState([]);
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [seed, setSeed] = useState('');
  const [inferenceSteps, setInferenceSteps] = useState(imageModels[0].defaultInferenceSteps);
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

  const currentModel = getImageModelById(selectedModelId);
  const sizes = currentModel.sizes || [];
  const hasRefImage = referenceImages.length > 0;
  const canGenerate = isEditMode ? (prompt.trim() && hasRefImage) : !!prompt.trim();

  const handleModelSelect = useCallback((model) => {
    setSelectedModelId(model.id);
  }, []);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) {
      setError(isEditMode ? '请输入 Prompt 并上传至少一张参考图片' : '请输入 Prompt 描述');
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
      let imagesBase64 = undefined;
      if (referenceImages.length > 0) {
        imagesBase64 = await Promise.all(referenceImages.map(f => readFileAsBase64(f)));
      }

      const api = createGenerationAPI(abortRef.current.signal);
      const data = await api.image({
        model: currentModel,
        prompt: prompt.trim(),
        size: selectedSize,
        images: imagesBase64,
        negative_prompt: negativePrompt.trim() || undefined,
        seed: seed || undefined,
        num_inference_steps: inferenceSteps,
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
  }, [prompt, negativePrompt, seed, inferenceSteps, currentModel, selectedSize, referenceImages, genNum, canGenerate, isEditMode]);

  const handleDownload = (url) => downloadResult(url, 'generated.png');

  const currentResult = results?.[selectedResultIdx];

  const emptyIcon = isEditMode ? '✏️' : '🖼';
  const emptyTitle = isEditMode ? '图片编辑' : '开始创作';
  const emptyDesc = isEditMode
    ? '上传参考图片，输入编辑指令，AI 将根据指令修改图片'
    : '输入 Prompt，选择模型和尺寸，点击生成';
  const promptPlaceholder = isEditMode
    ? '描述你希望对参考图片进行的修改，例如：把猫换成狗、将背景变成海滩...'
    : '描述你想要生成的画面，例如：一只在夕阳下奔跑的赛博朋克猫...';
  const genButtonLabel = isEditMode ? '开始编辑' : '生成图片';
  const genDisabledLabel = isEditMode ? '请上传图片并输入指令' : '输入 Prompt';

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 px-6 py-4 flex items-center gap-3 border-b border-border flex-wrap">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
            isEditMode
              ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
              : 'bg-primary/10 text-primary border-primary/30'
          }`}>
            {isEditMode ? '图片编辑' : '文生图'}
          </span>
        </div>

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
        {isEditMode && (
          <>
            <div className="w-px h-6 bg-border hidden sm:block" />
            <div className="flex items-center gap-1">
              <UploadButton
                onUpload={(file) => setReferenceImages(prev => [...prev, file])}
                onClear={() => setReferenceImages([])}
                accept="image/*"
                label="上传编辑图片"
              />
              {!hasRefImage && (
                <span className="text-[10px] text-red-400/70 whitespace-nowrap">* 必传</span>
              )}
              {referenceImages.length > 0 && (
                <div className="flex items-center gap-1">
                  {referenceImages.map((img, idx) => (
                    <span key={idx} className="relative inline-flex items-center gap-1 bg-white/[0.03] border border-border rounded px-1.5 py-0.5">
                      <span className="text-[10px] text-white/40 truncate max-w-[50px]">{img.name}</span>
                      <button
                        onClick={() => setReferenceImages(prev => prev.filter((_, i) => i !== idx))}
                        className="text-white/30 hover:text-red-400 text-[10px]"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  <span className="text-[10px] text-white/20 ml-1">{referenceImages.length} 张</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 overflow-y-auto">
          {currentResult ? (
            <>
              <ResultDisplay url={currentResult.url} type="image" onDownload={() => handleDownload(currentResult.url)} />
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
                  <span className="text-[10px] text-white/30 ml-1">共 {results.length} 张</span>
                </div>
              )}
            </>
          ) : generating ? (
            <EmptyState icon="⏳" title="生成中..." description="AI 正在为您创作图片，请稍候" />
          ) : (
            <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDesc} />
          )}

          {isEditMode && !currentResult && !generating && hasRefImage && (
            <div className="w-full max-w-2xl flex flex-wrap gap-2">
              {referenceImages.map((img, idx) => (
                <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-border group">
                  <img src={URL.createObjectURL(img)} alt="" className="w-full h-full object-cover" />
                  <span className="absolute bottom-0 left-0 right-0 text-[8px] text-center bg-black/60 text-white/70 py-0.5">
                    参考 {idx + 1}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="w-full max-w-2xl flex flex-col gap-3">
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

            <PromptInput
              value={prompt}
              onChange={setPrompt}
              placeholder={promptPlaceholder}
              disabled={generating}
            />

            <div className="flex items-center gap-3">
              {currentModel.supportsSeed && (
                <input
                  type="number"
                  value={seed}
                  onChange={e => setSeed(e.target.value)}
                  placeholder="Seed（留空随机）"
                  disabled={generating}
                  className="w-40 bg-white/[0.03] border border-border rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/15 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30"
                />
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
                  disabled={!canGenerate}
                  label={canGenerate ? genButtonLabel : genDisabledLabel}
                />
              )}
            </div>
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
