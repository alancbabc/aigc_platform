import axios from 'axios';
import { config } from '../config.js';

const TRANSLATE_PROMPT = `Translate the following video generation prompt to English. IMPORTANT: Keep any text inside quotation marks — both Chinese quotes「」and English quotes "" '' — in the ORIGINAL language. Do NOT translate any quoted speech. Output ONLY the translated prompt text, no explanations, no prefixes.

Prompt: `;

export async function translatePrompt(prompt) {
  const cjkChars = prompt.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/g) || [];
  const chineseRatio = cjkChars.length / Math.max(prompt.length, 1);
  if (chineseRatio < 0.05) {
    return { text: prompt, status: 'english_skipped' };
  }

  if (!config.GITEE_LLM_KEY) {
    console.warn('[translate] no Gitee LLM key configured, using original prompt');
    return { text: prompt, status: 'no_key' };
  }

  try {
    const response = await axios.post(
      config.GITEE_LLM_URL,
      {
        model: config.GITEE_LLM_MODEL,
        messages: [
          { role: 'user', content: TRANSLATE_PROMPT + prompt }
        ],
        stream: false,
        max_tokens: 1024,
        temperature: 0.3,
        enable_thinking: false,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.GITEE_LLM_KEY}`,
        },
        timeout: 25000,
      }
    );

    const msg = response.data?.choices?.[0]?.message;
    const translated = msg?.content?.trim()
      || msg?.reasoning_content?.trim();
    if (translated && translated.length > 0) {
      console.log(`[translate] prompt translated (${prompt.length} → ${translated.length} chars)`);
      return { text: translated, status: 'translated' };
    }
    console.warn('[translate] empty response, using original prompt');
    return { text: prompt, status: 'failed' };
  } catch (err) {
    console.error(`[translate] LLM call failed (${err.message}), using original prompt`);
    return { text: prompt, status: 'failed' };
  }
}
