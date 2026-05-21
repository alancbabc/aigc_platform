import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { logger } from './middleware/logger.js';
import { authMiddleware } from './middleware/auth.js';
import { authRouter } from './routes/auth.js';
import { generateRouter } from './routes/generate.js';
import { historyRouter } from './routes/history.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.use(cors());
app.use(logger);
app.use(express.json({ limit: '50mb' }));

// 受保护的 /outputs 文件服务（需JWT鉴权，且只能访问自己的文件）
app.use('/outputs/:user', authMiddleware, (req, res, next) => {
  if (req.user.username !== req.params.user) {
    return res.status(403).json({ error: 'Forbidden: cannot access other users files' });
  }
  next();
});
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
