export const imageModels = [
  {
    id: 'Qwen-Image',
    name: 'Qwen Image',
    description: '通义千问文生图（自部署）',
    pipeline: 'qwen_image',
    resolutionOptions: ['720p', '1080p', '2K'],
    aspectRatioOptions: ['16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '1:1'],
    defaultResolutionPreset: '1080p',
    defaultAspectRatio: '16:9',
    defaultSize: '1920x1088',
    supportsNegativePrompt: true,
    supportsSeed: true,
    supportsInferenceSteps: true,
    defaultInferenceSteps: 50,
    inferenceStepOptions: [20, 30, 50],
    outputExt: 'png',
  },
  {
    id: 'Qwen-Image-Edit',
    name: 'Qwen Image Edit',
    description: '通义千问图片编辑（自部署）',
    pipeline: 'qwen_image_edit',
    resolutionOptions: ['720p', '1080p', '2K'],
    aspectRatioOptions: ['16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '1:1'],
    defaultResolutionPreset: '1080p',
    defaultAspectRatio: '16:9',
    defaultSize: '1920x1088',
    supportsNegativePrompt: true,
    supportsSeed: true,
    supportsInferenceSteps: true,
    defaultInferenceSteps: 50,
    inferenceStepOptions: [20, 30, 50],
    outputExt: 'png',
  },
];

export const videoModels = [
  {
    id: 'LTX-2',
    name: 'LTX 2.3',
    description: '文生音视频/图生音视频（自部署）',
    pipeline: 'ti2vid_two_stages_hq',
    pipelineStandard: 'ti2v_two_stage',
    supportsImage: true,
    supportsNegativePrompt: true,
    supportsSeed: true,
    qualities: [
      { id: 'ti2v_two_stage', name: '标准' },
      { id: 'ti2vid_two_stages_hq', name: '高质量' },
    ],
    defaultQuality: 'ti2vid_two_stages_hq',
    resolutionOptions: ['540p', '720p', '1080p'],
    aspectRatioOptions: ['16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '1:1'],
    defaultResolutionPreset: '720p',
    defaultAspectRatio: '16:9',
    defaultResolution: '1280x704',
    durations: [3, 5, 10, 15],
    defaultDuration: 5,
    numInferenceSteps: 15,
    frameRate: 24,
    outputExt: 'mp4',
  },
];

export const interpolationModels = [
  {
    id: 'LTX-2-Interpolation',
    name: 'LTX 2.3',
    description: '关键帧插帧生音视频（自部署）',
    pipeline: 'keyframe_interpolation_two_stage',
    supportsImage: true,
    supportsNegativePrompt: true,
    supportsSeed: true,
    resolutionOptions: ['540p', '720p', '1080p'],
    aspectRatioOptions: ['16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '1:1'],
    defaultResolutionPreset: '720p',
    defaultAspectRatio: '16:9',
    defaultResolution: '1280x704',
    durations: [3, 5, 10, 15],
    defaultDuration: 5,
    numInferenceSteps: 15,
    frameRate: 24,
    outputExt: 'mp4',
  },
];

export const audioModels = [
  {
    id: 'Qwen3-TTS',
    name: 'Qwen3 TTS',
    description: '通义千问语音合成，支持预设音色（自部署）',
    pipelineCustomVoice: 'qwen_tts_customvoice',
    pipelineVoiceDesign: 'qwen_tts_voicedesign',
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
    languages: ['auto', 'chinese', 'english', 'french', 'german', 'italian', 'japanese', 'korean', 'portuguese', 'russian', 'spanish'],
    outputExt: 'wav',
  },
  {
    id: 'IndexTTS-2',
    name: 'IndexTTS 2',
    description: '高质量语音克隆，支持情绪控制（自部署）',
    pipeline: 'index_tts',
    supportsRefAudio: true,
    supportsEmotionVector: true,
    supportsEmotionAudio: true,
    supportsEmotionText: true,
    emotionLabels: ['高兴', '愤怒', '悲伤', '害怕', '厌恶', '忧郁', '惊讶', '平静'],
    outputExt: 'wav',
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

export function getInterpolationModelById(id) {
  return interpolationModels.find(m => m.id === id) || interpolationModels[0];
}
