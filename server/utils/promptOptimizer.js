import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { config } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_PATH = path.join(__dirname, '..', '..', 'LTX_SKILL.md');
const IMAGE_SKILL_PATH = path.join(__dirname, '..', '..', 'IMAGE_SKILL.md');

let skillCache = null;
let imageSkillCache = null;

function getSkill() {
  if (!skillCache) {
    try { skillCache = fs.readFileSync(SKILL_PATH, 'utf-8'); }
    catch { skillCache = ''; }
  }
  return skillCache;
}

function getImageSkill() {
  if (!imageSkillCache) {
    try { imageSkillCache = fs.readFileSync(IMAGE_SKILL_PATH, 'utf-8'); }
    catch { imageSkillCache = ''; }
  }
  return imageSkillCache;
}

const AUDIO_OPTIMIZE_INSTRUCTION = `You are an expert prompt engineer for AI text-to-speech generation. Your task is to optimize the input text for better TTS results.

Rules:
1. Keep ALL original text content unchanged
2. Fix any spelling or grammar issues
3. Add punctuation for better speech flow if needed (commas, periods)
4. Keep the language natural and conversational
5. Do NOT add or remove any words beyond minor punctuation/grammar fixes

Output ONLY the optimized text, no explanations, no formatting markers.`;

function callLLM(systemPrompt, userMessage, model) {
  return axios.post(
    config.GITEE_LLM_URL,
    {
      model: model || config.GITEE_LLM_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      stream: false,
      max_tokens: 2048,
      temperature: 0.7,
      enable_thinking: false,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.GITEE_LLM_KEY}`,
      },
      timeout: 30000,
    }
  );
}

function parseResult(raw) {
  let text = raw || '';
  const negIdx = text.indexOf('---NEGATIVE---');
  if (negIdx > 0) text = text.substring(0, negIdx);
  text = text.replace(/---OPTIMIZED---/gi, '');
  return text.trim();
}

const QUOTED_TEXT_REGEX = /“[^”\n]*”|"[^"\n]*"|‘[^’\n]*’|(^|[^\p{L}\p{N}_])('[^'\n]+?')(?=$|[^\p{L}\p{N}_])/gu;

function protectQuotedText(prompt) {
  const segments = [];
  const text = String(prompt || '').replace(QUOTED_TEXT_REGEX, (match, prefix, singleQuoted) => {
    const quotedText = singleQuoted || match;
    const leading = singleQuoted ? prefix : '';
    const placeholder = `__QUOTED_SPEECH_${segments.length + 1}__`;
    segments.push({ placeholder, text: quotedText });
    return `${leading}${placeholder}`;
  });

  return {
    text,
    segments,
    restore: (value) => {
      let restored = value || '';
      for (const segment of segments) {
        restored = restored.replaceAll(segment.placeholder, segment.text);
      }
      return restored;
    },
  };
}

function composeSystemPrompt(basePrompt, fallback, taskRules) {
  return `${basePrompt || fallback}

Task-specific optimization rules:
${taskRules}

Global rules:
- Preserve the user's core intent.
- Output ONLY the optimized prompt text.
- Do not include explanations, apologies, greetings, questions, headings, bullet labels, or meta-commentary.
- If the prompt cannot be improved safely, output the original prompt unchanged.`;
}

function quotedSpeechInstruction(segments) {
  if (!segments?.length) return '';
  return `
Quoted speech protection:
- The original prompt contains quoted speech placeholders.
- Copy every placeholder exactly as written. Do not translate, rewrite, summarize, expand, remove, or explain it.
- These placeholders will be restored to the user's original quoted speech after optimization.
- Placeholders: ${segments.map(s => s.placeholder).join(', ')}`;
}

function buildTextToImageRequest(prompt) {
  const systemPrompt = composeSystemPrompt(
    getImageSkill(),
    'You are an expert prompt engineer for text-to-image generation.',
    `Optimize text-to-image prompts from a structured image-generation perspective.
- Focus on subject, scene, style, composition, lighting, material/texture, atmosphere, and fine details.
- You may enrich and clarify visual details, but do not deviate from the original prompt.
- Do not add unrelated subjects, settings, actions, symbols, brands, text, or story elements not implied by the user.
- Prefer a fluent, detailed English image prompt suitable for an image generation model.`
  );

  const userMessage = `Optimize the following text-to-image prompt into a structured English image generation prompt:

Original prompt:
${prompt || 'none'}`;

  return { systemPrompt, userMessage, restore: (value) => value };
}

function buildImageEditRequest(prompt) {
  const systemPrompt = composeSystemPrompt(
    getImageSkill(),
    'You are an expert prompt engineer for image editing.',
    `Optimize image editing instructions, not text-to-image prompts.
- Focus on what should change and what must remain consistent.
- Preserve the user's core editing intent.
- Keep the result concise, complete, and operational.
- When appropriate, use the pattern "change X while preserving Y".
- The model cannot see the reference image. Do not invent reference image content that the user did not describe.
- Emphasize preserving identity, pose, layout, composition, lighting, color palette, and style when relevant.
- Do not over-expand or add new scene/story details.`
  );

  const userMessage = `Optimize the following image editing instruction:

Original instruction:
${prompt || 'none'}`;

  return { systemPrompt, userMessage, restore: (value) => value };
}

function buildTextToVideoRequest(prompt) {
  const protectedPrompt = protectQuotedText(prompt);
  const systemPrompt = composeSystemPrompt(
    getSkill(),
    'You are an expert prompt engineer for text-to-video generation.',
    `Optimize text-to-video prompts from a structured video-generation perspective.
- Focus on core subject and action, scene and atmosphere, composition, shot size, camera movement, motion continuity, pacing, lighting, and visual style.
- Enrich the prompt around the user's core content, but do not add unrelated story elements.
- Any dialogue or speech originally inside quotation marks must remain exactly in the original language and wording.`
  );

  const userMessage = `Optimize the following text-to-video prompt into a structured English video generation prompt:
${quotedSpeechInstruction(protectedPrompt.segments)}

Original prompt:
${protectedPrompt.text || 'none'}`;

  return { systemPrompt, userMessage, restore: protectedPrompt.restore };
}

function buildImageToVideoRequest(prompt) {
  const protectedPrompt = protectQuotedText(prompt);
  const systemPrompt = composeSystemPrompt(
    getSkill(),
    'You are an expert prompt engineer for image-to-video generation.',
    `Optimize image-to-video prompts by describing how the reference image should become a video.
- Focus on how the reference image should move, how the camera should move, and which visual details should be preserved or enhanced.
- The model cannot see the reference image. Do not invent image content that the user did not explicitly describe.
- Use terms like "the reference image", "the subject in the reference image", and "the existing composition" when content is not explicitly described.
- Preserve identity, composition, lighting, color palette, visual style, and scene consistency.
- Keep motion natural, coherent, and tied to the user's core description.
- Any dialogue or speech originally inside quotation marks must remain exactly in the original language and wording.`
  );

  const userMessage = `Optimize the following image-to-video prompt into a structured English prompt:
${quotedSpeechInstruction(protectedPrompt.segments)}

Original prompt:
${protectedPrompt.text || 'none'}`;

  return { systemPrompt, userMessage, restore: protectedPrompt.restore };
}

function buildInterpolationRequest(prompt) {
  const protectedPrompt = protectQuotedText(prompt);
  const systemPrompt = composeSystemPrompt(
    getSkill(),
    'You are an expert prompt engineer for keyframe interpolation video generation.',
    `Optimize keyframe interpolation prompts by describing transitions between provided keyframes.
- Focus on how keyframes transition into each other, camera movement between keyframes, subject motion, lighting/style transitions, and visual features to preserve.
- The model cannot see the keyframes. Do not invent keyframe content that the user did not explicitly describe.
- Preserve the user's core transition intent.
- Maintain subject, composition, lighting, color palette, visual style, and scene consistency across keyframes.
- Any dialogue or speech originally inside quotation marks must remain exactly in the original language and wording.`
  );

  const userMessage = `Optimize the following keyframe interpolation prompt into a structured English prompt:
${quotedSpeechInstruction(protectedPrompt.segments)}

Original prompt:
${protectedPrompt.text || 'none'}`;

  return { systemPrompt, userMessage, restore: protectedPrompt.restore };
}

function buildAudioRequest(prompt) {
  return {
    systemPrompt: AUDIO_OPTIMIZE_INSTRUCTION,
    userMessage: `Optimize this text for TTS:\n\n"${prompt || ''}"\n\nCRITICAL: Reply ONLY with the optimized text. Do NOT include any explanations.`,
    restore: (value) => value,
  };
}

function normalizeType(type) {
  if (type === 'image') return 'text2image';
  if (type === 'video') return 'text2video';
  if (type === 'clone') return 'audio';
  return type || 'text2video';
}

function buildOptimizationRequest(prompt, type) {
  switch (normalizeType(type)) {
    case 'text2image':
      return buildTextToImageRequest(prompt);
    case 'image-edit':
    case 'image2image':
      return buildImageEditRequest(prompt);
    case 'text2video':
      return buildTextToVideoRequest(prompt);
    case 'image2video':
      return buildImageToVideoRequest(prompt);
    case 'interpolation':
      return buildInterpolationRequest(prompt);
    case 'audio':
      return buildAudioRequest(prompt);
    default:
      return buildTextToVideoRequest(prompt);
  }
}

export async function optimizePrompt(prompt, type, model) {
  if (!config.GITEE_LLM_KEY) {
    console.warn('[optimize] no Gitee LLM key configured, using original prompt');
    return { optimizedPrompt: prompt || '' };
  }

  const { systemPrompt, userMessage, restore } = buildOptimizationRequest(prompt, type);

  try {
    const response = await callLLM(systemPrompt, userMessage, model);
    const msg = response.data?.choices?.[0]?.message;
    const raw = msg?.content
      || msg?.reasoning_content
      || '';
    const result = restore(parseResult(raw)) || prompt || '';
    console.log(`[optimize] type=${type} prompt optimized (${prompt?.length || 0} → ${result.length} chars)`);
    return { optimizedPrompt: result };
  } catch (err) {
    console.error(`[optimize] LLM call failed: ${err.message}`);
    return { optimizedPrompt: prompt || '' };
  }
}
