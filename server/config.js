import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

function intEnv(key, fallback) {
  const raw = process.env[key];
  if (raw === undefined || raw === null) return fallback;
  const n = parseInt(raw);
  return isNaN(n) ? fallback : n;
}

export const config = {
  PORT: intEnv('PORT', 3001),
  JWT_SECRET: (() => {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret === 'change-this-to-a-random-secret-in-production') {
      console.error('[config] FATAL: JWT_SECRET is not set or is the default placeholder. Set a strong random secret in .env');
      process.exit(1);
    }
    return secret;
  })(),
  JWT_EXPIRES_IN: '7d',
  BCRYPT_ROUNDS: 10,
  DATA_DIR: path.join(__dirname, 'data'),

  // AI 服务地址
  AI_IMAGE_URL: process.env.AI_IMAGE_URL || 'http://10.42.1.2:9000',
  AI_VIDEO_URL: process.env.AI_VIDEO_URL || 'http://10.42.1.2:8000',
  AI_TTS_URL: process.env.AI_TTS_URL || 'http://10.42.1.2:9200',
  AI_VOICE_URL: process.env.AI_VOICE_URL || 'http://10.42.1.2:9300',

  // 轮询与超时配置
  POLL_INTERVAL_MS: intEnv('POLL_INTERVAL_MS', 20000),
  MAX_POLL_ATTEMPTS: intEnv('MAX_POLL_ATTEMPTS', 150),
  SUBMIT_TIMEOUT_MS: intEnv('SUBMIT_TIMEOUT_MS', 300000),
  POLL_TIMEOUT_MS: intEnv('POLL_TIMEOUT_MS', 10000),
  DOWNLOAD_TIMEOUT_MS: intEnv('DOWNLOAD_TIMEOUT_MS', 180000),
  DOWNLOAD_RETRIES: intEnv('DOWNLOAD_RETRIES', 3),
  DOWNLOAD_RETRY_DELAY_MS: intEnv('DOWNLOAD_RETRY_DELAY_MS', 5000),
  POLL_TOTAL_TIMEOUT_MS: intEnv('POLL_TOTAL_TIMEOUT_MS', 600000),

  // Gitee LLM API (Prompt 翻译)
  GITEE_LLM_URL: process.env.GITEE_LLM_URL || 'https://ai.gitee.com/v1/chat/completions',
  GITEE_LLM_KEY: process.env.GITEE_LLM_KEY || '',
  GITEE_LLM_MODEL: process.env.GITEE_LLM_MODEL || 'Qwen3.5-122B-A10B',
};
