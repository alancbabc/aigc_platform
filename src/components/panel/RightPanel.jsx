import { useState } from 'react';
import { useTasks } from '../../contexts/TaskContext';
import TaskTab from './TaskTab';
import HistoryTab from './HistoryTab';

export default function RightPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState('tasks');
  const { tasks, optimizeOpen } = useTasks();
  const activeCount = tasks.filter(t => t.status === 'generating' || t.status === 'submitted').length;

  if (collapsed) {
    return (
      <div className="flex-shrink-0 w-10 border-l border-border bg-app-bg flex flex-col items-center py-3 gap-4">
        <button onClick={() => setCollapsed(false)} className="text-white/30 hover:text-white/60 transition-colors" title="展开面板">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        {activeCount > 0 && (
          <div className="w-5 h-5 rounded-full bg-primary text-[10px] flex items-center justify-center text-white font-medium">
            {activeCount}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`flex-shrink-0 border-l border-border bg-app-bg flex flex-col h-full overflow-hidden ${optimizeOpen ? 'flex-1' : 'w-1/2'}`} style={{ minWidth: 300 }}>
      <div className="flex items-center border-b border-border">
        <button
          onClick={() => setTab('tasks')}
          className={`flex-1 py-2.5 text-xs font-medium text-center transition-colors ${tab === 'tasks' ? 'text-white border-b-2 border-primary' : 'text-white/30 hover:text-white/50'}`}
        >
          任务{activeCount > 0 && ` (${activeCount})`}
        </button>
        <button
          onClick={() => setTab('history')}
          className={`flex-1 py-2.5 text-xs font-medium text-center transition-colors ${tab === 'history' ? 'text-white border-b-2 border-primary' : 'text-white/30 hover:text-white/50'}`}
        >
          历史
        </button>
        <button onClick={() => setCollapsed(true)} className="px-2 text-white/20 hover:text-white/50 transition-colors" title="折叠面板">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        {tab === 'tasks' ? <TaskTab /> : <HistoryTab />}
      </div>
    </div>
  );
}
