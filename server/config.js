import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

export const config = {
  PORT: process.env.PORT || 3001,
  JWT_SECRET: (() => {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret === 'change-this-to-a-random-secret-in-production') {
      console.warn('[config] WARNING: JWT_SECRET is weak or not set. Set a strong random secret in .env');
    }
    return secret || 'aigc-platform-jwt-secret-k8x9m2p4';
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
  POLL_INTERVAL_MS: parseInt(process.env.POLL_INTERVAL_MS) || 20000,
  MAX_POLL_ATTEMPTS: parseInt(process.env.MAX_POLL_ATTEMPTS) || 150,
  SUBMIT_TIMEOUT_MS: parseInt(process.env.SUBMIT_TIMEOUT_MS) || 120000,
  POLL_TIMEOUT_MS: parseInt(process.env.POLL_TIMEOUT_MS) || 10000,
  DOWNLOAD_TIMEOUT_MS: parseInt(process.env.DOWNLOAD_TIMEOUT_MS) || 180000,
  DOWNLOAD_RETRIES: parseInt(process.env.DOWNLOAD_RETRIES) || 3,
  DOWNLOAD_RETRY_DELAY_MS: parseInt(process.env.DOWNLOAD_RETRY_DELAY_MS) || 5000,
  POLL_TOTAL_TIMEOUT_MS: parseInt(process.env.POLL_TOTAL_TIMEOUT_MS) || 300000,
};
