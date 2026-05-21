import express from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { logger } from './middleware/logger.js';
import { securityHeaders } from './middleware/security.js';
import { authMiddleware } from './middleware/auth.js';
import { authRouter } from './routes/auth.js';
import { generateRouter } from './routes/generate.js';
import { historyRouter } from './routes/history.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(compression());
app.use(securityHeaders);
app.use(cors({ origin: config.CORS_ORIGIN }));
app.use(logger);
app.use(express.json({ limit: '50mb' }));

app.set('trust proxy', 1);

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 受保护的媒体文件服务（仅通过 Authorization header 鉴权，无 URL token 泄露）
app.get('/api/media/:user/:file', authMiddleware, (req, res) => {
  if (req.user.username !== req.params.user) {
    return res.status(403).json({ error: 'Forbidden: cannot access other users files' });
  }
  const filePath = path.join(config.DATA_DIR, 'outputs', req.params.user, req.params.file);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  res.sendFile(filePath);
});

// 直接文件服务（仅用于 Nginx 代理直接访问，无需程序鉴权）
// 前端通过 /api/media/:user/:file 加载媒体
app.use('/outputs', express.static(path.join(config.DATA_DIR, 'outputs')));

app.use('/api/auth', authRouter);
app.use('/api/generate', generateRouter);
app.use('/api/history', historyRouter);

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
  });
}

app.listen(config.PORT, () => {
  console.log(`[server] running on http://localhost:${config.PORT}`);
  console.log(`[server] data dir: ${config.DATA_DIR}`);
});
