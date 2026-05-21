import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

export const config = {
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3002',
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
  // 自部署 AI 服务 (原 ai.gitee.com 第三方 API 已替换)
  AI_IMAGE_URL: process.env.AI_IMAGE_URL || 'http://10.42.1.2:9000',
  AI_VIDEO_URL: process.env.AI_VIDEO_URL || 'http://10.42.1.2:8000',
  AI_TTS_URL: process.env.AI_TTS_URL || 'http://10.42.1.2:9200',
  AI_VOICE_URL: process.env.AI_VOICE_URL || 'http://10.42.1.2:9300',
};
