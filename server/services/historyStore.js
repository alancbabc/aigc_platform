import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { readJSON, writeJSON } from '../utils/fileStore.js';

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
  const history = readJSON(getHistoryFile(username)) || [];
  const newEntry = {
    id: generateId(),
    ...entry,
    createdAt: new Date().toISOString(),
  };
  history.unshift(newEntry);
  await writeJSON(getHistoryFile(username), history);
  return newEntry;
}

export async function deleteHistory(username, id) {
  const history = readJSON(getHistoryFile(username)) || [];
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
  await writeJSON(getHistoryFile(username), filtered);
  return true;
}
