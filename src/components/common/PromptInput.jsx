import { useRef, useEffect } from 'react';

export default function PromptInput({ value, onChange, placeholder, disabled }) {
  const textareaRef = useRef(null);

  const handleInput = (e) => {
    onChange(e.target.value);
    autoResize(e.target);
  };

  const autoResize = (el) => {
    el = el || textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(Math.max(el.scrollHeight, 160), 360) + 'px';
  };

  useEffect(() => { autoResize(); }, [value]);

  return (
    <div className="w-full">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        placeholder={placeholder || '描述你想要生成的内容...'}
        disabled={disabled}
        rows={2}
        className="w-full min-h-40 max-h-[360px] bg-white/[0.03] border border-border rounded-2xl px-5 py-4 text-sm leading-5 text-white placeholder:text-white/15 resize-none overflow-y-auto custom-scrollbar focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30 disabled:opacity-40 transition-all"
      />
    </div>
  );
}
