import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const locks = new Map();

export async function acquireLock(key, timeout = 3000) {
  const start = Date.now();
  let delay = 5;
  while (locks.get(key)) {
    if (Date.now() - start > timeout) {
      throw new Error(`Lock timeout for: ${key}`);
    }
    await new Promise(resolve => setTimeout(resolve, delay));
    delay = Math.min(delay * 2, 100);
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
  } catch (e) {
    console.error(`[fileStore] corrupted JSON at ${filePath}: ${e.message}`);
    const backup = `${filePath}.corrupted.${Date.now()}`;
    try { fs.copyFileSync(filePath, backup); } catch {}
    return null;
  }
}

function _writeAtom(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmpPath = path.join(dir, `.tmp_${uuidv4()}.json`);
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  const retryable = new Set(['EPERM', 'EBUSY', 'ENFILE', 'EMFILE']);
  let lastError = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      fs.renameSync(tmpPath, filePath);
      return;
    } catch (err) {
      if (err.code === 'EXDEV') {
        fs.copyFileSync(tmpPath, filePath);
        try { fs.unlinkSync(tmpPath); } catch {}
        return;
      }
      lastError = err;
      if (!retryable.has(err.code)) break;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20 * (attempt + 1));
    }
  }
  try { fs.unlinkSync(tmpPath); } catch {}
  throw lastError;
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
    return readJSON(filePath);
  } finally {
    releaseLock(lockKey);
  }
}
