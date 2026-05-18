export const imageModels = [
  {
    id: 'FLUX.1-dev',
    name: 'FLUX.1 Dev',
    sizes: ['1024x1024', '512x512', '768x768', '1024x576', '576x1024'],
    defaultSize: '1024x1024',
    description: '高质量写实图像生成',
  },
  {
    id: 'FLUX.2-klein-4B',
    name: 'FLUX.2 Klein 4B',
    sizes: ['1024x1024', '768x768'],
    defaultSize: '1024x1024',
    description: '快速高效图像生成',
  },
  {
    id: 'Kolors',
    name: 'Kolors',
    sizes: ['1024x1024', '768x768', '512x512'],
    defaultSize: '1024x1024',
    description: 'Kolor 风格图像生成',
  },
  {
    id: 'GLM-Image',
    name: 'GLM Image',
    sizes: ['1024x1024', '768x768'],
    defaultSize: '1024x1024',
    description: '智谱 GLM 图像生成',
  },
  {
    id: 'stable-diffusion-3.5-large-turbo',
    name: 'SD 3.5 Large Turbo',
    sizes: ['1024x1024', '768x768', '512x512'],
    defaultSize: '1024x1024',
    description: 'Stable Diffusion 3.5 快速版',
  },
  {
    id: 'Qwen-Image',
    name: 'Qwen Image',
    sizes: ['1024x1024', '768x768'],
    defaultSize: '1024x1024',
    description: '通义千问图像生成',
  },
  {
    id: 'HiDream-I1-Full',
    name: 'HiDream I1 Full',
    sizes: ['1024x1024', '512x512'],
    defaultSize: '1024x1024',
    description: 'HiDream 完整版图像生成',
  },
  {
    id: 'z-image-turbo',
    name: 'Z-Image Turbo',
    sizes: ['1024x1024', '768x768'],
    defaultSize: '1024x1024',
    description: 'Z-Image 快速版',
  },
];

export const videoModels = [
  {
    id: 'LTX-2',
    name: 'LTX 2',
    description: '视频生成模型',
    supportsImage: true,
  },
  {
    id: 'CogVideoX-5b',
    name: 'CogVideoX 5B',
    description: '视频生成模型',
    supportsImage: true,
  },
  {
    id: 'Wan2.1-I2V',
    name: 'Wan 2.1 I2V',
    description: '图生视频模型',
    supportsImage: true,
  },
  {
    id: 'OpenSora-I2V',
    name: 'OpenSora I2V',
    description: '开源图生视频模型',
    supportsImage: true,
  },
];

export const audioModels = [
  {
    id: 'IndexTTS-2',
    name: 'IndexTTS 2',
    description: '高质量文本转语音，支持情感表达',
    supportsGender: true,
    supportsPitch: true,
    supportsSpeed: true,
  },
  {
    id: 'Spark-TTS-0.5B',
    name: 'Spark TTS 0.5B',
    description: 'Spark 语音合成',
    supportsGender: true,
  },
  {
    id: 'Qwen3-TTS',
    name: 'Qwen3 TTS',
    description: '通义千问语音合成',
  },
  {
    id: 'CosyVoice3',
    name: 'CosyVoice 3',
    description: '阿里 CosyVoice 语音合成',
    supportsGender: true,
  },
  {
    id: 'AudioFly',
    name: 'AudioFly',
    description: '音频生成模型',
  },
];

export function getImageModelById(id) {
  return imageModels.find(m => m.id === id) || imageModels[0];
}

export function getVideoModelById(id) {
  return videoModels.find(m => m.id === id) || videoModels[0];
}

export function getAudioModelById(id) {
  return audioModels.find(m => m.id === id) || audioModels[0];
}
