const RESOLUTION_TARGETS = {
  '540p': 720 * 540,
  '720p': 1280 * 720,
  '1080p': 1920 * 1080,
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
export const IMAGE_RESOLUTION_LABELS = ['720p', '1080p', '2K'];
export const VIDEO_RESOLUTION_LABELS = ['540p', '720p', '1080p'];
export const ASPECT_RATIO_LABELS = Object.keys(ASPECT_RATIOS);

function pythonRound(value) {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (Math.abs(diff - 0.5) < 1e-10) {
    return floor % 2 === 0 ? floor : floor + 1;
  }
  return Math.round(value);
}

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
  const widthRounded = pythonRound(widthIdeal / 64) * 64;
  const heightRounded = pythonRound(heightIdeal / 64) * 64;
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
