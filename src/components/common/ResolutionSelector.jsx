import { useState } from 'react';
import SimpleDropdown from './SimpleDropdown';

const RESOLUTIONS = ['540p', '720p', '1080p', '2K'];
const ASPECT_RATIOS = ['16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '1:1'];

function calcResolution(res, ratio) {
  const targets = { '540p': 720*540, '720p': 1280*720, '1080p': 1920*1080, '2K': 2560*1440 };
  const ratios = { '16:9': 16/9, '9:16': 9/16, '4:3': 4/3, '3:4': 3/4, '3:2': 3/2, '2:3': 2/3, '1:1': 1 };
  const targetPixels = targets[res];
  const ratioVal = ratios[ratio];
  if (!targetPixels || !ratioVal) return '1024x1024';
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

export default function ResolutionSelector({ onSelect, initialValue }) {
  const parsed = parseResolution(initialValue || '1024x1024');
  const [res, setRes] = useState(parsed.res);
  const [ratio, setRatio] = useState(parsed.ratio);

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
