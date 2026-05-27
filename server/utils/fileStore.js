import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

const locks = new Map();

export async function acquireLock(key, timeout = 3000) {
  const start = Date.now();
  while (locks.get(key)) {
    if (Date.now() - start > timeout) {
      throw new Error(`Lock timeout for: ${key}`);
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  locks.set(key, true);
}

export function releaseLock(key) {
  locks.delete(key);
}

export function readJSON(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function _writeAtom(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmpPath = path.join(os.tmpdir(), `${uuidv4()}.json`);
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

// Public: single-shot lock + write (for callers who just need to write once)
export async function writeJSON(filePath, data) {
  const lockKey = path.resolve(filePath);
  await acquireLock(lockKey);
  try {
    _writeAtom(filePath, data);
  } finally {
    releaseLock(lockKey);
  }
}

// Public: lock + read-modify-write (for callers who need atomicity across read+write)
export async function lockedUpdate(filePath, updater) {
  const lockKey = path.resolve(filePath);
  await acquireLock(lockKey);
  try {
    const current = readJSON(filePath);
    const updated = updater(current);
    _writeAtom(filePath, updated);
    return updated;
  } finally {
    releaseLock(lockKey);
  }
}

// Public: lock + read (read while holding lock, used with paired lockedUpdate)
export async function lockedRead(filePath) {
  const lockKey = path.resolve(filePath);
  await acquireLock(lockKey);
  try {
    return _readJSON(filePath);
  } finally {
    releaseLock(lockKey);
  }
}
