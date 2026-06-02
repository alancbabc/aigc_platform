import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { config } from '../config.js';

const __dirname = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1');
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

export async function optimizePrompt(prompt, type, model) {
  if (!config.GITEE_LLM_KEY) {
    console.warn('[optimize] no Gitee LLM key configured, using original prompt');
    return { optimizedPrompt: prompt || '' };
  }

  const isVideo = type === 'video' || type === 'interpolation';
  const skill = getSkill();

  let systemPrompt, userMessage;

  if (isVideo) {
    systemPrompt = skill
      ? `${skill}`
      : 'You are an expert for video generation prompts.';
    userMessage = `Optimize the following prompt into a detailed English video generation prompt:\n\n"${prompt || 'none'}"\n\nCRITICAL: Reply ONLY with the optimized prompt text. Do NOT include any explanations, apologies, questions, greetings, or meta-commentary. If you cannot process this request, simply output the original prompt unchanged.`;
  } else if (type === 'audio') {
    systemPrompt = AUDIO_OPTIMIZE_INSTRUCTION;
    userMessage = `Optimize this text for TTS:\n\n"${prompt || ''}"\n\nCRITICAL: Reply ONLY with the optimized text. Do NOT include any explanations.`;
  } else {
    const imgSkill = getImageSkill();
    systemPrompt = imgSkill
      ? `${imgSkill}`
      : 'You are an expert for image generation prompts.';
    userMessage = `Optimize the following prompt into a detailed English image generation prompt:\n\n"${prompt || 'none'}"\n\nCRITICAL: Reply ONLY with the optimized prompt text. Do NOT include any explanations, apologies, questions, greetings, or meta-commentary. If you cannot process this request, simply output the original prompt unchanged.`;
  }

  try {
    const response = await callLLM(systemPrompt, userMessage, model);
    const msg = response.data?.choices?.[0]?.message;
    const raw = msg?.content
      || msg?.reasoning_content
      || '';
    const result = parseResult(raw);
    console.log(`[optimize] type=${type} prompt optimized (${prompt?.length || 0} → ${result.length} chars)`);
    return { optimizedPrompt: result };
  } catch (err) {
    console.error(`[optimize] LLM call failed: ${err.message}`);
    return { optimizedPrompt: prompt || '' };
  }
}
