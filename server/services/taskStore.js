import path from 'path';
import { config } from '../config.js';
import { readJSON, writeJSON } from '../utils/fileStore.js';

function safeSegment(value) {
  return encodeURIComponent(String(value || 'unknown')).replace(/%/g, '_');
}

function getTaskFile(username, generationId) {
  return path.join(
    config.DATA_DIR,
    'tasks',
    safeSegment(username),
    `${safeSegment(generationId)}.json`,
  );
}

function serializeGeneration(generationId, generation) {
  return {
    generationId,
    userId: generation.userId,
    tasks: generation.tasks || [],
    cancelled: generation.cancelled === true,
    completed: generation.completed === true,
    error: generation.error || null,
    results: generation.results || null,
    historyId: generation.historyId || null,
    createdAt: generation.createdAt || Date.now(),
    finishedAt: generation.finishedAt || null,
    updatedAt: Date.now(),
  };
}

export function loadGeneration(username, generationId) {
  const data = readJSON(getTaskFile(username, generationId));
  if (!data || data.userId !== username) return null;
  return data;
}

export async function saveGeneration(generationId, generation) {
  if (!generation?.userId) return;
  await writeJSON(
    getTaskFile(generation.userId, generationId),
    serializeGeneration(generationId, generation),
  );
}

export function saveGenerationSoon(generationId, generation) {
  saveGeneration(generationId, generation).catch(err => {
    console.error(`[taskStore] failed to persist generation ${generationId}: ${err.message}`);
  });
}
