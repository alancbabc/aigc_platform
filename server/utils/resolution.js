const RESOLUTION_TARGETS = {
  '540p': 720 * 540,
  '720p': 1280 * 720,
  '1280p': 1920 * 1280,
  '2K': 2560 * 1440,
};

const ASPECT_RATIOS = {
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '3:4': 3 / 4,
  '4:3': 4 / 3,
  '2:3': 2 / 3,
  '3:2': 3 / 2,
  '1:1': 1.0,
};

export const RESOLUTION_LABELS = Object.keys(RESOLUTION_TARGETS);
export const IMAGE_RESOLUTION_LABELS = ['720p', '1280p', '2K'];
export const VIDEO_RESOLUTION_LABELS = ['540p', '720p', '1280p'];
export const ASPECT_RATIO_LABELS = Object.keys(ASPECT_RATIOS);

export function calculateResolution(resolution, aspectRatio) {
  const normalizedResolution = normalizeResolutionLabel(resolution);
  const targetPixels = RESOLUTION_TARGETS[normalizedResolution];
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

export function normalizeResolutionLabel(resolution) {
  if (typeof resolution !== 'string') return resolution;
  return resolution.toLowerCase() === '2k' ? '2K' : resolution;
}

function parseFallbackResolution(res) {
  if (typeof res === 'string' && res.includes('x')) {
    const [w, h] = res.split('x').map(Number);
    return { width: w, height: h };
  }
  return { width: 1024, height: 1024 };
}
