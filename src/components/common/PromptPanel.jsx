import { useState } from 'react';
import { optimizeAPI } from '../../api/client';
import { showToast } from './Toast';
import LoadingSpinner from './LoadingSpinner';
import SimpleDropdown from './SimpleDropdown';

const MODELS = [
  { id: 'Qwen3.5-122B-A10B', label: 'Qwen3.5-122B (默认)' },
  { id: 'DeepSeek-R1', label: 'DeepSeek-R1' },
];

export default function PromptPanel({ prompt, type, onApply, onClose }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [applied, setApplied] = useState(false);
  const [model, setModel] = useState(MODELS[0].label);

  const handleOptimize = async () => {
    if (!prompt?.trim()) return;
    setLoading(true);
    setApplied(false);
    try {
      const m = MODELS.find(x => x.label === model);
      const data = await optimizeAPI.optimize({ prompt: prompt.trim(), type, model: m?.id });
      setResult(data.optimizedPrompt || '');
      showToast('优化完成', 'success');
    } catch (err) {
      showToast(`优化失败: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (result) {
      onApply(result);
      setApplied(true);
      showToast('已应用到输入框', 'success');
    }
  };

  return (
    <div className="flex-shrink-0 w-80 border-l border-border bg-app-bg flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <span className="text-xs text-white/60 font-medium">Prompt 优化</span>
        <button onClick={onClose} className="text-white/20 hover:text-white/60 transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div className="p-3 space-y-3 flex-1 overflow-y-auto custom-scrollbar">
        <div>
          <label className="text-[10px] text-white/30 mb-1 block">选择模型</label>
          <SimpleDropdown title="" options={MODELS.map(m => m.label)} selected={model} onSelect={setModel} />
        </div>
        <button
          onClick={handleOptimize}
          disabled={loading || !prompt?.trim()}
          className="w-full py-2 rounded-lg text-xs font-medium transition-all bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? <><LoadingSpinner size="small" /> 优化中...</> : '开始优化'}
        </button>
        {result && (
          <>
            <div>
              <label className="text-[10px] text-white/30 mb-1 block">优化结果</label>
              <textarea
                readOnly
                value={result}
                rows={8}
                style={{ minHeight: '400px' }}
                className="w-full bg-white/[0.03] border border-border rounded-lg px-3 py-2 text-xs text-white/70 focus:outline-none resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleApply}
                disabled={applied}
                className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-30"
              >
                {applied ? '已应用' : '应用到输入框'}
              </button>
              <button
                onClick={handleOptimize}
                disabled={loading || !prompt?.trim()}
                className="flex-1 py-1.5 rounded-lg text-xs text-white/30 hover:text-white/60 transition-colors border border-border"
              >
                重新优化
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
