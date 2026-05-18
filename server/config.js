import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

export const config = {
  PORT: process.env.PORT || 3001,
  JWT_SECRET: process.env.JWT_SECRET || 'aigc-platform-default-secret',
  JWT_EXPIRES_IN: '7d',
  BCRYPT_ROUNDS: 10,
  DATA_DIR: path.join(__dirname, 'data'),
  AI_API_BASE_URL: process.env.AI_API_BASE_URL || 'https://ai.gitee.com',
  AI_API_TOKEN: process.env.AI_API_TOKEN || '',
};
