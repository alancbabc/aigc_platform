import bcrypt from 'bcryptjs';
import { config } from '../config.js';

export async function hashPassword(password) {
  return bcrypt.hash(password, config.BCRYPT_ROUNDS);
}

export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}
