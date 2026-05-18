import fs from 'fs';
import path from 'path';
import { config } from '../config.js';

const USERS_FILE = path.join(config.DATA_DIR, 'users.json');

function readUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

export function findUser(username) {
  return readUsers().find(u => u.username === username);
}

export function createUser(username, passwordHash) {
  const users = readUsers();
  if (users.find(u => u.username === username)) {
    throw new Error('User already exists');
  }
  const newUser = {
    username,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  users.push(newUser);
  writeUsers(users);

  const userOutputDir = path.join(config.DATA_DIR, 'outputs', username);
  fs.mkdirSync(userOutputDir, { recursive: true });

  return { username, createdAt: newUser.createdAt };
}
