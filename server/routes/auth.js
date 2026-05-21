import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { hashPassword, comparePassword } from '../utils/crypto.js';
import { signToken } from '../utils/token.js';
import { findUser, createUser } from '../services/userStore.js';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRouter = Router();
authRouter.use(authLimiter);

authRouter.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ error: 'Username must be 3-30 characters' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = findUser(username);
    if (existing) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const passwordHash = await hashPassword(password);
    const user = await createUser(username, passwordHash);
    const token = signToken({ username: user.username });

    res.status(201).json({
      message: 'Registration successful',
      user: { username: user.username },
      token,
    });
  } catch (err) {
    console.error('[auth] register error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

authRouter.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = findUser(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = signToken({ username: user.username });
    res.json({
      message: 'Login successful',
      user: { username: user.username },
      token,
    });
  } catch (err) {
    console.error('[auth] login error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});
