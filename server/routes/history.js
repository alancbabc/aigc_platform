import { Router } from 'express';
import crypto from 'crypto';
import { authMiddleware } from '../middleware/auth.js';
import { getHistory, deleteHistory } from '../services/historyStore.js';

export const historyRouter = Router();
historyRouter.use(authMiddleware);

historyRouter.get('/', (req, res) => {
  try {
    const username = req.user.username;
    let history = getHistory(username);
    const type = req.query.type ? String(req.query.type) : '';
    if (type) {
      const types = type.split(',').map(t => t.trim()).filter(Boolean);
      if (types.length > 0) history = history.filter(item => types.includes(item.type));
    }

    const total = history.length;
    const cursor = req.query.cursor ? String(req.query.cursor) : '';
    if (cursor) {
      const cursorIndex = history.findIndex(item => item.id === cursor || item.createdAt === cursor);
      if (cursorIndex >= 0) history = history.slice(cursorIndex + 1);
    }

    const hasLimit = req.query.limit !== undefined;
    const requestedLimit = hasLimit ? Number(req.query.limit) : 0;
    if (hasLimit && (!Number.isInteger(requestedLimit) || requestedLimit < 1)) {
      return res.status(400).json({ error: 'limit must be a positive integer' });
    }
    const limit = hasLimit ? Math.min(requestedLimit, 200) : 0;
    const paged = limit > 0 ? history.slice(0, limit) : history;
    const nextCursor = limit > 0 && history.length > limit ? paged[paged.length - 1]?.id || null : null;
    const payload = { history: paged, total, nextCursor, hasMore: Boolean(nextCursor) };
    const etag = `W/"${crypto.createHash('sha1').update(JSON.stringify(payload)).digest('hex')}"`;

    res.setHeader('Cache-Control', 'private, no-cache');
    res.setHeader('ETag', etag);
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }

    res.json(payload);
  } catch (err) {
    console.error('[history] get error:', err.message);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

historyRouter.delete('/:id', async (req, res) => {
  try {
    const username = req.user.username;
    const deleted = await deleteHistory(username, req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'History entry not found' });
    }
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('[history] delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete history' });
  }
});
