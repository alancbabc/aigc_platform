export default function GenerateButton({ onClick, loading, disabled, label = '生成' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`relative px-8 py-3 rounded-xl font-bold text-sm transition-all active:scale-[0.97] ${
        disabled || loading
          ? 'bg-white/5 text-white/20 cursor-not-allowed'
          : 'bg-primary text-black hover:bg-primary-hover hover:shadow-glow animate-pulse-glow'
      }`}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
          生成中...
        </span>
      ) : label}
    </button>
  );
}
