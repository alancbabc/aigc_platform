import { useEffect, useRef } from 'react';

export default function NegativePromptInput({
  value,
  onChange,
  placeholder = 'Negative Prompt (optional)',
  label = 'Negative Prompt',
  helpText = '填写不希望出现的内容、风格或缺陷，例如低清晰度、变形、文字、水印；可留空。',
}) {
  const textareaRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 72), 144)}px`;
  }, [value]);

  return (
    <div className="w-full">
      {(label || helpText) && (
        <div className="mb-1.5 px-0.5">
          {label && <div className="text-[11px] font-medium text-white/55">{label}</div>}
          {helpText && <div className="mt-0.5 text-[10px] leading-4 text-white/30">{helpText}</div>}
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full min-h-[72px] max-h-36 bg-white/[0.03] border border-border rounded-lg px-3 py-2 text-sm leading-5 text-white placeholder:text-white/15 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none overflow-y-auto custom-scrollbar"
      />
    </div>
  );
}
