import { v4 as uuidv4 } from 'uuid';

const tasks = new Map();

const CLEANUP_INTERVAL = 5 * 60 * 1000;
const TASK_TTL = 60 * 60 * 1000;

export function createTask(username, type) {
  const task = {
    id: uuidv4(),
    username,
    type,
    status: 'pending',
    result: null,
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  tasks.set(task.id, task);
  return task;
}

export function updateTask(taskId, updates) {
  const task = tasks.get(taskId);
  if (!task) return null;
  Object.assign(task, updates, { updatedAt: new Date().toISOString() });
  return task;
}

export function getTask(taskId) {
  return tasks.get(taskId) || null;
}

export function getUserTasks(username) {
  return Array.from(tasks.values())
    .filter(t => t.username === username && t.status !== 'done' && t.status !== 'error')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

setInterval(() => {
  const cutoff = Date.now() - TASK_TTL;
  for (const [id, task] of tasks) {
    if (new Date(task.createdAt).getTime() < cutoff) {
      tasks.delete(id);
    }
  }
}, CLEANUP_INTERVAL);
