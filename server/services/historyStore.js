import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { readJSON, lockedUpdate } from '../utils/fileStore.js';

function getHistoryFile(username) {
  return path.join(config.DATA_DIR, 'history', `${username}.json`);
}

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function getHistory(username) {
  const data = readJSON(getHistoryFile(username));
  return (data || []).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
}

export async function addHistory(username, entry) {
  const newEntry = {
    id: generateId(),
    ...entry,
    createdAt: new Date().toISOString(),
  };

  await lockedUpdate(getHistoryFile(username), (history) => {
    const current = history || [];
    current.unshift(newEntry);
    return current;
  });

  return newEntry;
}

export async function deleteHistory(username, id) {
  let toDelete = [];
  let found = false;

  await lockedUpdate(getHistoryFile(username), (history) => {
    const current = history || [];
    const entry = current.find(h => h.id === id);
    if (!entry) return current;
    found = true;
    toDelete = entry.results || [];
    return current.filter(h => h.id !== id);
  });

  if (!found) return false;

  // Delete output files AFTER record is removed (safe: record gone, files best-effort)
  for (const r of toDelete) {
    const filePath = r.filePath || (r.filename
      ? path.join(config.DATA_DIR, 'outputs', username, r.filename)
      : null);
    if (filePath) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }

  return true;
}
