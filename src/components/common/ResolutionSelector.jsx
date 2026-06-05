import { useEffect, useState } from 'react';
import SimpleDropdown from './SimpleDropdown';

const RESOLUTIONS = ['540p', '720p', '1280p'];
const ASPECT_RATIOS = ['16:9', '9:16', '4:3', '3:4', '2:3', '3:2', '1:1'];

function calcResolution(res, ratio) {
  const targets = { '540p': 720*540, '720p': 1280*720, '1280p': 1920*1280 };
  const ratios = { '16:9': 16/9, '9:16': 9/16, '4:3': 4/3, '3:4': 3/4, '2:3': 2/3, '3:2': 3/2, '1:1': 1 };
  const targetPixels = targets[res];
  const ratioVal = ratios[ratio];
  if (!targetPixels || !ratioVal) return '1280x720';
  const h = Math.sqrt(targetPixels / ratioVal);
  const w = h * ratioVal;
  const rw = Math.round(w / 64) * 64;
  const rh = Math.round(h / 64) * 64;
  return `${rw}x${rh}`;
}

function parseResolution(str) {
  for (const r of RESOLUTIONS) {
    for (const a of ASPECT_RATIOS) {
      if (calcResolution(r, a) === str) return { res: r, ratio: a };
    }
  }
  return { res: '720p', ratio: '16:9' };
}

function labelForSize(size) {
  const [w, h] = String(size).split('x').map(Number);
  if (!w || !h) return size;
  if (w === h) return `${size} 1:1`;
  return size;
}

export default function ResolutionSelector({ onSelect, initialValue, options }) {
  const directOptions = Array.isArray(options) && options.length > 0;
  const [selected, setSelected] = useState(initialValue || options?.[0] || '1280x720');
  const parsed = parseResolution(initialValue || '1280x720');
  const [res, setRes] = useState(parsed.res);
  const [ratio, setRatio] = useState(parsed.ratio);

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
        title="Resolution"
        options={options}
        selected={labelForSize(selected)}
        getOptionLabel={labelForSize}
        onSelect={(v) => {
          setSelected(v);
          onSelect(v);
        }}
      />
    );
  }

  const handleResChange = (v) => {
    setRes(v);
    onSelect(calcResolution(v, ratio));
  };

  const handleRatioChange = (v) => {
    setRatio(v);
    onSelect(calcResolution(res, v));
  };

  return (
    <div className="flex items-center gap-2">
      <SimpleDropdown title="分辨率" options={RESOLUTIONS} selected={res} onSelect={handleResChange} />
      <SimpleDropdown title="比例" options={ASPECT_RATIOS} selected={ratio} onSelect={handleRatioChange} />
    </div>
  );
}
