const RESOLUTION_TARGETS = {
  '540p': 720 * 540,
  '720p': 1280 * 720,
  '1280p': 1920 * 1280,
  '2K': 2560 * 1440,
};

const ASPECT_RATIOS = {
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '4:3': 4 / 3,
  '3:4': 3 / 4,
  '3:2': 3 / 2,
  '2:3': 2 / 3,
  '1:1': 1.0,
};

export const RESOLUTION_LABELS = Object.keys(RESOLUTION_TARGETS);
export const ASPECT_RATIO_LABELS = Object.keys(ASPECT_RATIOS);

export function calculateResolution(resolution, aspectRatio) {
  const targetPixels = RESOLUTION_TARGETS[resolution];
  const ratio = ASPECT_RATIOS[aspectRatio];
  if (!targetPixels || !ratio) {
    const { width, height } = parseFallbackResolution(resolution);
    return { width, height };
  }
  const heightIdeal = Math.sqrt(targetPixels / ratio);
  const widthIdeal = heightIdeal * ratio;
  const widthRounded = Math.round(widthIdeal / 64) * 64;
  const heightRounded = Math.round(heightIdeal / 64) * 64;
  return { width: widthRounded, height: heightRounded };
}

function parseFallbackResolution(res) {
  if (typeof res === 'string' && res.includes('x')) {
    const [w, h] = res.split('x').map(Number);
    return { width: w, height: h };
  }
  return { width: 1024, height: 1024 };
}
