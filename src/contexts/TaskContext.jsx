import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const TaskContext = createContext(null);

const STORAGE_KEY = 'aigc_tasks';
const MAX_TASKS = 50;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

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

  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)); } catch {}
  }, [tasks]);

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
