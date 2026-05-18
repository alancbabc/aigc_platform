import { useRef } from 'react';

export default function PromptInput({ value, onChange, placeholder, disabled }) {
  const textareaRef = useRef(null);

  const handleInput = (e) => {
    onChange(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 150) + 'px';
  };

  return (
    <div className="w-full max-w-2xl">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        placeholder={placeholder || '描述你想要生成的内容...'}
        disabled={disabled}
        rows={2}
        className="w-full bg-white/[0.03] border border-border rounded-2xl px-5 py-4 text-sm text-white placeholder:text-white/15 resize-none focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/30 disabled:opacity-40 transition-all"
      />
    </div>
  );
}
