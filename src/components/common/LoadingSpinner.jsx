export default function LoadingSpinner({ size = 'default' }) {
  const sizes = {
    small: 'w-4 h-4',
    default: 'w-8 h-8',
    large: 'w-12 h-12',
  };

  return (
    <div className="flex items-center justify-center p-12">
      <div className={`${sizes[size]} border-2 border-white/5 border-t-primary rounded-full animate-spin`} />
    </div>
  );
}
