export default function EmptyState({ icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 md:py-20 opacity-40">
      <span className="text-6xl">{icon}</span>
      <h3 className="text-lg font-bold text-white">{title}</h3>
      {description && <p className="text-sm text-white/60 max-w-xs text-center">{description}</p>}
    </div>
  );
}
