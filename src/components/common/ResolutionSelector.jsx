import { useEffect, useState } from 'react';
import SimpleDropdown from './SimpleDropdown';

const DEFAULT_RESOLUTIONS = ['540p', '720p', '1080p'];
const DEFAULT_ASPECT_RATIOS = ['16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '1:1'];

function pythonRound(value) {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (Math.abs(diff - 0.5) < 1e-10) {
    return floor % 2 === 0 ? floor : floor + 1;
  }
  return Math.round(value);
}

function calcResolution(resolution, aspectRatio) {
  const targets = {
    '540p': 720 * 540,
    '720p': 1280 * 720,
    '1080p': 1920 * 1080,
    '2K': 2560 * 1440,
  };
  const ratios = {
    '16:9': 16 / 9,
    '9:16': 9 / 16,
    '4:3': 4 / 3,
    '3:4': 3 / 4,
    '3:2': 3 / 2,
    '2:3': 2 / 3,
    '1:1': 1,
  };
  const targetPixels = targets[resolution];
  const ratio = ratios[aspectRatio];
  if (!targetPixels || !ratio) return '1280x720';
  const height = Math.sqrt(targetPixels / ratio);
  const width = height * ratio;
  return `${pythonRound(width / 64) * 64}x${pythonRound(height / 64) * 64}`;
}

function parseResolution(value, resolutionOptions, aspectRatioOptions) {
  for (const resolution of resolutionOptions) {
    for (const aspectRatio of aspectRatioOptions) {
      if (calcResolution(resolution, aspectRatio) === value) {
        return { resolution, aspectRatio };
      }
    }
  }
  return {
    resolution: resolutionOptions[0] || '720p',
    aspectRatio: aspectRatioOptions[0] || '16:9',
  };
}

function labelForSize(size) {
  const [width, height] = String(size).split('x').map(Number);
  if (!width || !height) return size;
  if (width === height) return `${size} 1:1`;
  return size;
}

export default function ResolutionSelector({
  onSelect,
  initialValue,
  options,
  resolutionOptions = DEFAULT_RESOLUTIONS,
  aspectRatioOptions = DEFAULT_ASPECT_RATIOS,
  initialResolution,
  initialAspectRatio = '16:9',
}) {
  const directOptions = Array.isArray(options) && options.length > 0;
  const [selected, setSelected] = useState(initialValue || options?.[0] || '1280x720');
  const parsed = initialResolution
    ? { resolution: initialResolution, aspectRatio: initialAspectRatio }
    : parseResolution(initialValue || '1280x720', resolutionOptions, aspectRatioOptions);
  const [resolution, setResolution] = useState(parsed.resolution);
  const [aspectRatio, setAspectRatio] = useState(parsed.aspectRatio);

  useEffect(() => {
    if (directOptions) {
      const next = options.includes(initialValue) ? initialValue : options[0];
      setSelected(next);
      if (next !== initialValue) onSelect?.(next);
    }
  }, [directOptions, initialValue, onSelect, options]);

  if (directOptions) {
    return (
      <SimpleDropdown
        title="分辨率"
        options={options}
        selected={labelForSize(selected)}
        getOptionLabel={labelForSize}
        onSelect={(value) => {
          setSelected(value);
          onSelect(value);
        }}
      />
    );
  }

  const handleResolutionChange = (value) => {
    setResolution(value);
    onSelect(calcResolution(value, aspectRatio), { resolution: value, aspectRatio });
  };

  const handleAspectRatioChange = (value) => {
    setAspectRatio(value);
    onSelect(calcResolution(resolution, value), { resolution, aspectRatio: value });
  };

  return (
    <div className="flex items-center gap-2">
      <SimpleDropdown title="分辨率" options={resolutionOptions} selected={resolution} onSelect={handleResolutionChange} />
      <SimpleDropdown title="宽高比" options={aspectRatioOptions} selected={aspectRatio} onSelect={handleAspectRatioChange} />
    </div>
  );
}
