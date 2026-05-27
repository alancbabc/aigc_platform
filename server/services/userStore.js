import path from 'path';
import fs from 'fs';
import { config } from '../config.js';
import { readJSON, lockedUpdate } from '../utils/fileStore.js';

const USERS_FILE = path.join(config.DATA_DIR, 'users.json');

export function findUser(username) {
  const users = readJSON(USERS_FILE);
  return (users || []).find(u => u.username === username);
}

export async function createUser(username, passwordHash) {
  let created = null;

  await lockedUpdate(USERS_FILE, (users) => {
    const current = users || [];
    if (current.find(u => u.username === username)) return current;
    const newUser = {
      username,
      passwordHash,
      createdAt: new Date().toISOString(),
    };
    current.push(newUser);
    created = { username, createdAt: newUser.createdAt };
    return current;
  });

  if (!created) return null;

  const userOutputDir = path.join(config.DATA_DIR, 'outputs', username);
  fs.mkdirSync(userOutputDir, { recursive: true });

  return created;
}
