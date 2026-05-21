export const imageModels = [
  {
    id: 'Qwen-Image',
    name: 'Qwen Image',
    description: '通义千问文生图/图生图（自部署）',
    sizes: ['1024x1024', '768x768', '1328x1328', '1024x768', '768x1024', '1536x1024', '1024x1536'],
    defaultSize: '1024x1024',
    supportsNegativePrompt: true,
    supportsSeed: true,
    supportsInferenceSteps: true,
    defaultInferenceSteps: 50,
    inferenceStepOptions: [20, 30, 50],
  },
];

export const videoModels = [
  {
    id: 'LTX-2',
    name: 'LTX 2.3',
    description: '文生视频/图生视频（自部署）',
    supportsImage: true,
    supportsNegativePrompt: true,
    supportsSeed: true,
    supportsEnhancePrompt: true,
    qualities: [
      { id: 'ti2v_two_stage', name: '标准' },
      { id: 'ti2vid_two_stages_hq', name: '高质量' },
    ],
    defaultQuality: 'ti2vid_two_stages_hq',
    resolutions: ['1088x1920', '1024x1536', '1024x1024', '720x1280', '576x1024'],
    defaultResolution: '1088x1920',
    durations: [3, 5, 10, 15],
    defaultDuration: 5,
  },
];

export const audioModels = [
  {
    id: 'Qwen3-TTS',
    name: 'Qwen3 TTS',
    description: '通义千问语音合成，支持预设音色（自部署）',
    supportsSpeaker: true,
    supportsLanguage: true,
    supportsInstruct: true,
    speakers: [
      { id: 'Vivian', name: 'Vivian', desc: '明亮年轻女声', lang: '中文' },
      { id: 'Serena', name: 'Serena', desc: '温柔年轻女声', lang: '中文' },
      { id: 'Uncle_Fu', name: 'Uncle Fu', desc: '低沉醇厚男声', lang: '中文' },
      { id: 'Dylan', name: 'Dylan', desc: '青春北京男声', lang: '中文(北京)' },
      { id: 'Eric', name: 'Eric', desc: '活泼成都男声', lang: '中文(四川)' },
      { id: 'Ryan', name: 'Ryan', desc: '动感男声', lang: '英语' },
      { id: 'Aiden', name: 'Aiden', desc: '阳光美式男声', lang: '英语' },
      { id: 'Ono_Anna', name: 'Ono Anna', desc: '俏皮日语女声', lang: '日语' },
      { id: 'Sohee', name: 'Sohee', desc: '温暖韩语女声', lang: '韩语' },
    ],
    defaultSpeaker: 'Vivian',
    languages: ['auto', 'chinese', 'english', 'japanese', 'korean'],
  },
  {
    id: 'IndexTTS-2',
    name: 'IndexTTS 2',
    description: '高质量语音克隆，支持情绪控制（自部署）',
    supportsRefAudio: true,
    supportsEmotionVector: true,
    supportsEmotionAudio: true,
    supportsEmotionText: true,
    emotionLabels: ['高兴', '愤怒', '悲伤', '害怕', '厌恶', '忧郁', '惊讶', '平静'],
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
