import path from 'path';
import fs from 'fs';
import { config } from '../config.js';
import { readJSON, writeJSON } from '../utils/fileStore.js';

const USERS_FILE = path.join(config.DATA_DIR, 'users.json');

export function findUser(username) {
  const users = readJSON(USERS_FILE);
  return (users || []).find(u => u.username === username);
}

export async function createUser(username, passwordHash) {
  const users = readJSON(USERS_FILE) || [];
  if (users.find(u => u.username === username)) {
    throw new Error('User already exists');
  }
  const newUser = {
    username,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  users.push(newUser);
  await writeJSON(USERS_FILE, users);

  const userOutputDir = path.join(config.DATA_DIR, 'outputs', username);
  fs.mkdirSync(userOutputDir, { recursive: true });

  return { username, createdAt: newUser.createdAt };
}
