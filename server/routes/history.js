import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getHistory, deleteHistory } from '../services/historyStore.js';

export const historyRouter = Router();
historyRouter.use(authMiddleware);

historyRouter.get('/', (req, res) => {
  try {
    const username = req.user.username;
    const history = getHistory(username);
    res.json({ history });
  } catch (err) {
    console.error('[history] get error:', err.message);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

historyRouter.delete('/:id', (req, res) => {
  try {
    const username = req.user.username;
    const deleted = deleteHistory(username, req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'History entry not found' });
    }
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('[history] delete error:', err.message);
    res.status(500).json({ error: 'Failed to delete history' });
  }
});
