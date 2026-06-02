import { useState, useEffect } from 'react';
import { useTasks } from '../../contexts/TaskContext';
import TaskCard from './TaskCard';
import EmptyState from '../common/EmptyState';
import ConfirmModal from '../common/ConfirmModal';

const TYPE_GROUP = {
  image: ['image', 'image-edit', 'text2image'],
  video: ['video', 'image2video', 'a2v', 'interpolation', 'text2video'],
  audio: ['audio', 'clone', 'speech'],
};

export default function TaskTab() {
  const { tasks, removeTask, clearDone, lastTaskType } = useTasks();
  const [filter, setFilter] = useState('all');
  const [clearConfirm, setClearConfirm] = useState(null);

  useEffect(() => {
    if (lastTaskType) {
      const group = Object.entries(TYPE_GROUP).find(([, types]) => types.includes(lastTaskType));
      if (group) setFilter(group[0]);
    }
  }, [lastTaskType]);

  const filtered = filter === 'all'
    ? tasks
    : tasks.filter(t => TYPE_GROUP[filter]?.includes(t.type));

  const active = filtered.filter(t => t.status === 'generating' || t.status === 'submitted');
  const completed = filtered.filter(t => t.status !== 'generating' && t.status !== 'submitted');

  const filters = [
    { id: 'all', label: '全部' },
    { id: 'image', label: '图片' },
    { id: 'video', label: '视频' },
    { id: 'audio', label: '音频' },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {clearConfirm && (
        <ConfirmModal
          title={clearConfirm === 'done' ? '清除已完成' : '清空全部'}
          message={clearConfirm === 'done' ? '确定要清除所有已完成和失败的任务吗？' : `将移除列表中所有 ${tasks.length} 个任务，确定吗？`}
          confirmLabel={clearConfirm === 'done' ? '清除' : '清空'}
          onConfirm={() => {
            if (clearConfirm === 'done') clearDone();
            else tasks.forEach(t => removeTask(t.id));
            setClearConfirm(null);
          }}
          onCancel={() => setClearConfirm(null)}
        />
      )}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border flex-shrink-0 overflow-x-auto">
        {filters.map(f => {
          const count = f.id === 'all' ? tasks.length : tasks.filter(t => TYPE_GROUP[f.id]?.includes(t.type)).length;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-2 py-0.5 rounded text-[10px] whitespace-nowrap transition-colors ${filter === f.id ? 'bg-primary/15 text-primary' : 'text-white/30 hover:text-white/50'}`}
            >
              {f.label} {count > 0 && count}
            </button>
          );
        })}
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
        {filtered.length === 0 && <EmptyState icon="📋" title="暂无任务" description="开始生成内容，任务将显示在这里" />}
        {active.map(t => <TaskCard key={t.id} task={t} />)}
        {completed.map(t => <TaskCard key={t.id} task={t} />)}
      </div>
      {filtered.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-border flex-shrink-0">
          <button onClick={() => setClearConfirm('done')} className="text-[10px] text-white/30 hover:text-white/60 transition-colors">清除已完成</button>
          <button onClick={() => setClearConfirm('all')} className="text-[10px] text-red-400/40 hover:text-red-400 transition-colors">清空全部</button>
        </div>
      )}
    </div>
  );
}
