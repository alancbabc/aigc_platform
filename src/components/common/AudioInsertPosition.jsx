export default function AudioInsertPosition({ value, onChange, duration }) {
  const numericValue = clampPercent(value);
  const seconds = ((Number(duration) || 0) * numericValue) / 100;

  const update = (next) => {
    onChange(clampPercent(next));
  };

  return (
    <div className="flex-shrink-0 rounded-lg border border-border bg-white/[0.02] px-3 py-2">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <span className="text-[10px] text-white/40">音频插入位置</span>
        <span className="text-[10px] text-white/50">{numericValue}% / {seconds.toFixed(1)}s</span>
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={numericValue}
          onChange={(e) => update(e.target.value)}
          className="min-w-0 flex-1 accent-primary"
        />
        <input
          type="number"
          min="0"
          max="100"
          step="1"
          value={numericValue}
          onChange={(e) => update(e.target.value)}
          className="w-16 rounded-md border border-border bg-white/[0.03] px-2 py-1 text-right text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
      </div>
    </div>
  );
}

function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}
