import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

const locks = new Map();

async function acquireLock(key, timeout = 3000) {
  const start = Date.now();
  while (locks.get(key)) {
    if (Date.now() - start > timeout) {
      throw new Error(`Lock timeout for: ${key}`);
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  locks.set(key, true);
}

function releaseLock(key) {
  locks.delete(key);
}

export function readJSON(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function writeJSON(filePath, data) {
  const lockKey = path.resolve(filePath);
  await acquireLock(lockKey);
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const tmpPath = path.join(os.tmpdir(), `${uuidv4()}.json`);
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpPath, filePath);
  } finally {
    releaseLock(lockKey);
  }
}
