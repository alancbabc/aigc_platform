import { useEffect, useMemo, useState } from 'react';

function withPreviewTime(src) {
  if (!src) return '';
  const [base, hash = ''] = src.split('#');
  const nextHash = hash || 't=0.1';
  return `${base}#${nextHash}`;
}

export default function VideoThumbnail({
  src,
  className = '',
  iconSize = 16,
  iconClassName = 'w-10 h-10',
}) {
  const [loaded, setLoaded] = useState(false);
  const previewSrc = useMemo(() => withPreviewTime(src), [src]);

  useEffect(() => {
    setLoaded(false);
  }, [previewSrc]);

  const handleLoadedMetadata = (event) => {
    const video = event.currentTarget;
    try {
      const targetTime = Number.isFinite(video.duration) && video.duration > 0
        ? Math.min(0.1, Math.max(video.duration - 0.1, 0))
        : 0.1;
      if (Math.abs(video.currentTime - targetTime) > 0.05) {
        video.currentTime = targetTime;
      }
    } catch {}
  };

  return (
    <div className={`relative overflow-hidden bg-black/40 ${className}`}>
      {previewSrc && (
        <video
          src={previewSrc}
          preload="metadata"
          muted
          playsInline
          className={`w-full h-full object-cover transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onLoadedMetadata={handleLoadedMetadata}
          onLoadedData={() => setLoaded(true)}
          onCanPlay={() => setLoaded(true)}
          onSeeked={() => setLoaded(true)}
        />
      )}
      {!loaded && (
        <div className="absolute inset-0 bg-black/40" />
      )}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className={`${iconClassName} bg-black/35 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/10`}>
          <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="white" className="translate-x-[1px] opacity-90">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </div>
      </div>
    </div>
  );
}
