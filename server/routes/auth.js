import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { hashPassword, comparePassword } from '../utils/crypto.js';
import { signToken } from '../utils/token.js';
import { findUser, createUser } from '../services/userStore.js';

const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many registrations, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRouter = Router();

authRouter.post('/register', registerLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    if (typeof username !== 'string' || !USERNAME_REGEX.test(username)) {
      return res.status(400).json({ error: 'Username must be 3-30 characters (letters, numbers, underscore, hyphen)' });
    }
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const passwordHash = await hashPassword(password);
    const user = await createUser(username, passwordHash);

    if (!user) {
      return res.status(409).json({ error: 'Username already exists' });
    }

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

authRouter.post('/login', loginLimiter, async (req, res) => {
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
