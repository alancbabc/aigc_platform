import fs from 'fs';
import path from 'path';
import { config } from '../config.js';

function getHistoryFile(username) {
  return path.join(config.DATA_DIR, 'history', `${username}.json`);
}

function readHistory(username) {
  const file = getHistoryFile(username);
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return [];
  }
}

function writeHistory(username, history) {
  const dir = path.dirname(getHistoryFile(username));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getHistoryFile(username), JSON.stringify(history, null, 2), 'utf-8');
}

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function getHistory(username) {
  return readHistory(username).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
}

export function addHistory(username, entry) {
  const history = readHistory(username);
  const newEntry = {
    id: generateId(),
    ...entry,
    createdAt: new Date().toISOString(),
  };
  history.unshift(newEntry);
  writeHistory(username, history);
  return newEntry;
}

export function deleteHistory(username, id) {
  const history = readHistory(username);
  const entry = history.find(h => h.id === id);
  if (!entry) return false;

  if (entry.results) {
    for (const r of entry.results) {
      const toDelete = r.filePath || (r.filename
        ? path.join(config.DATA_DIR, 'outputs', username, r.filename)
        : null);
      if (toDelete) {
        try { fs.unlinkSync(toDelete); } catch {}
      }
    }
  }

  const filtered = history.filter(h => h.id !== id);
  writeHistory(username, filtered);
  return true;
}
