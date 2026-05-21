import { verifyToken } from '../utils/token.js';

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  const tokenFromQuery = req.query.token;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : tokenFromQuery;
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
