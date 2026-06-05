import { useEffect, useRef } from 'react';

export default function NegativePromptInput({ value, onChange, placeholder = 'Negative Prompt (optional)' }) {
  const textareaRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 72), 144)}px`;
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={3}
      className="w-full min-h-[72px] max-h-36 bg-white/[0.03] border border-border rounded-lg px-3 py-2 text-sm leading-5 text-white placeholder:text-white/15 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none overflow-y-auto custom-scrollbar"
    />
  );
}
