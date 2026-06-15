import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { generationTaskAPI } from '../api/client';

const TaskContext = createContext(null);

const STORAGE_KEY = 'aigc_tasks';
const MAX_TASKS = 50;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const ACTIVE_POLL_INTERVAL_MS = 3000;
const HIDDEN_POLL_INTERVAL_MS = 15000;
const MISSING_GENERATION_GRACE_MS = 30000;
const TASK_SYNCING_MESSAGE = '任务状态正在同步，请稍候';
const TASK_LOST_MESSAGE = '服务端已找不到该任务状态，请稍后到历史记录查看结果';

function isMissingGenerationError(message) {
  return /generation not found|not found|404/i.test(message || '');
}

function loadTasks() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    let tasks = JSON.parse(raw);
    if (!Array.isArray(tasks)) return [];
    const cutoff = Date.now() - MAX_AGE_MS;
    tasks = tasks
      .filter(t => t.createdAt > cutoff)
      .slice(0, MAX_TASKS)
      .map(t => {
        if (t.status === 'generating' || t.status === 'submitted') {
          return { ...t, status: 'unknown', error: '页面已刷新，任务可能仍在服务端运行，请稍后查看历史', updatedAt: Date.now() };
        }
        return t;
      });
    return tasks;
  } catch {
    return [];
  }
}

export function TaskProvider({ children }) {
  const [tasks, setTasks] = useState(loadTasks);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [lastTaskType, setLastTaskType] = useState(null);
  const [optimizeOpen, setOptimizeOpen] = useState(false);
  const [optimizePanel, setOptimizePanel] = useState(null);
  const [pageVisible, setPageVisible] = useState(() => (
    typeof document === 'undefined' ? true : !document.hidden
  ));

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); } catch {}
  }, [tasks]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const handleVisibilityChange = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    const pollable = tasks.filter(t =>
      t.generationId &&
      ['generating', 'submitted', 'unknown'].includes(t.status)
    );
    if (pollable.length === 0) return;

    let cancelled = false;
    const poll = async () => {
      const updates = await Promise.all(pollable.map(async (task) => {
        try {
          const data = await generationTaskAPI.status(task.generationId);
          return { id: task.id, data };
        } catch (err) {
          return { id: task.id, error: err.message, lost: isMissingGenerationError(err.message) };
        }
      }));
      if (cancelled) return;
      setTasks(prev => {
        let changed = false;
        const nextTasks = prev.map(task => {
          const update = updates.find(u => u.id === task.id);
          if (!update) return task;
          if (update.data) {
            const { status, results, error, duration } = update.data;
            const nextStatus = status === 'cancelled' ? 'failed' : status;
            const nextError = error || null;
            const nextResults = results || task.results;
            const nextDuration = ['done', 'failed', 'cancelled'].includes(status) ? (duration ?? task.duration) : task.duration;
            if (
              task.status === nextStatus &&
              task.results === nextResults &&
              task.error === nextError &&
              task.duration === nextDuration
            ) {
              return task;
            }
            const nextTask = {
              ...task,
              status: nextStatus,
              results: nextResults,
              error: nextError,
              duration: nextDuration,
              updatedAt: Date.now(),
            };
            if (nextStatus === 'done' && task.status !== 'done') {
              setHistoryVersion(v => v + 1);
            }
            changed = true;
            return nextTask;
          }
          if (['generating', 'submitted', 'unknown'].includes(task.status)) {
            if (update.lost) {
              if (Date.now() - (task.createdAt || 0) < MISSING_GENERATION_GRACE_MS) {
                if (task.status === 'unknown' && task.error === TASK_SYNCING_MESSAGE) return task;
                changed = true;
                return { ...task, status: 'unknown', error: TASK_SYNCING_MESSAGE, updatedAt: Date.now() };
              }
              changed = true;
              return { ...task, generationId: null, status: 'unknown', error: TASK_LOST_MESSAGE, updatedAt: Date.now() };
            }
            if (!update.error || task.error === update.error) return task;
            changed = true;
            return { ...task, status: 'unknown', error: update.error || task.error, updatedAt: Date.now() };
          }
          return task;
        });
        return changed ? nextTasks : prev;
      });
    };

    poll();
    const timer = setInterval(poll, pageVisible ? ACTIVE_POLL_INTERVAL_MS : HIDDEN_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [tasks, pageVisible]);

  const addTask = useCallback((task) => {
    const t = {
      ...task,
      id: task.id || `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: task.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    setTasks(prev => [t, ...prev]);
    setLastTaskType(task.type);
  }, []);

  const updateTask = useCallback((generationId, updates) => {
    setTasks(prev => prev.map(t => {
      if (t.id === generationId || t.generationId === generationId) {
        const updated = { ...t, ...updates, updatedAt: Date.now() };
        if (updates.status === 'done') {
          setHistoryVersion(v => v + 1);
        }
        return updated;
      }
      return t;
    }));
  }, []);

  const removeTask = useCallback((generationId) => {
    setTasks(prev => prev.filter(t => t.id !== generationId && t.generationId !== generationId));
  }, []);

  const clearDone = useCallback(() => {
    setTasks(prev => prev.filter(t => t.status === 'generating' || t.status === 'submitted'));
  }, []);

  const notifyHistoryChange = useCallback(() => {
    setHistoryVersion(v => v + 1);
  }, []);

  return (
    <TaskContext.Provider value={{
      tasks, addTask, updateTask, removeTask, clearDone,
      historyVersion, notifyHistoryChange,
      lastTaskType, setLastTaskType,
      optimizeOpen, setOptimizeOpen,
      optimizePanel, setOptimizePanel,
    }}>
      {children}
    </TaskContext.Provider>
  );
}

export function useTasks() {
  const ctx = useContext(TaskContext);
  if (!ctx) throw new Error('useTasks must be used within TaskProvider');
  return ctx;
}
