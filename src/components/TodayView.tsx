import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Check, Plus, X } from 'lucide-react';
import SwipeActions from './SwipeActions';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { getTodayTaskStats } from '../lib/taskCompletion';
import { Task } from '../types';

const priorityColors = {
  low: 'bg-[#C4C1B9]',
  medium: 'bg-[#E2A76F]',
  high: 'bg-[#A35D5D]',
};

const priorityBorderColors = {
  low: 'border-[#C4C1B9]',
  medium: 'border-[#E2A76F]',
  high: 'border-[#A35D5D]',
};

export default function TodayView({ store }: { store: any }) {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [isAdding, setIsAdding] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPriority, setEditPriority] = useState<'low' | 'medium' | 'high'>('medium');

  const today = format(new Date(), 'yyyy-MM-dd');
  const todayTasks = store.data.tasks.filter((t: Task) => t.date === today);

  const getWeight = (p?: 'low' | 'medium' | 'high') => p === 'high' ? 3 : p === 'medium' ? 2 : p === 'low' ? 1 : 0;

  // Deduplicate habit tasks: keep only 1 per habitId (prefer deterministic ID format)
  const rawHabitTasks = todayTasks.filter((t: Task) => t.type === 'habit');
  const seenHabitIds = new Set<string>();
  const habitTasks = rawHabitTasks
    .sort((a: Task, b: Task) => {
      // Prefer deterministic IDs (habitId_date) over random UUIDs
      const aIsDet = a.id === `${a.habitId}_${today}` ? 0 : 1;
      const bIsDet = b.id === `${b.habitId}_${today}` ? 0 : 1;
      return aIsDet - bIsDet;
    })
    .filter((t: Task) => {
      if (!t.habitId || seenHabitIds.has(t.habitId)) return false;
      seenHabitIds.add(t.habitId);
      return true;
    })
    .sort((a: Task, b: Task) => getWeight(b.priority) - getWeight(a.priority));

  const oneTimeTasks = todayTasks.filter((t: Task) => t.type === 'one-time').sort((a: Task, b: Task) => getWeight(b.priority) - getWeight(a.priority));

  const { allCompleted } = getTodayTaskStats(store.data.tasks, today);

  useEffect(() => {
    if (allCompleted) {
      confetti({
        particleCount: 80,
        spread: 100,
        origin: { y: 0.4 },
        colors: ['#D4AF37', '#F3E5AB', '#C5B358', '#E6E6FA'],
        disableForReducedMotion: true,
        gravity: 0.8,
        scalar: 0.8
      });
    }
  }, [allCompleted]);

  const handleAddTask = () => {
    if (!newTaskTitle.trim()) return;
    store.addOneTimeTask(newTaskTitle.trim(), today, newTaskPriority);
    setNewTaskTitle('');
    setNewTaskPriority('medium');
    setIsAdding(false);
  };

  const handleSaveEdit = (id: string) => {
    if (editTitle.trim()) {
      store.updateTask(id, editTitle.trim(), editPriority);
    }
    setEditingTaskId(null);
  };

  const startEditing = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditPriority(task.priority || 'medium');
  };

  const cyclePriority = (id: string, currentPriority?: 'low' | 'medium' | 'high') => {
    const next = currentPriority === 'low' ? 'medium' : currentPriority === 'medium' ? 'high' : 'low';
    store.updateTaskPriority(id, next);
  };

  const renderTask = (task: Task) => {
    const showEdit = task.type === 'one-time' && !task.completed && editingTaskId !== task.id;
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        key={task.id}
      >
        <SwipeActions
          showEdit={showEdit}
          onEdit={() => startEditing(task)}
          onDelete={() => store.deleteTask(task.id)}
        >
          <div className="flex items-center justify-between py-4 border-b border-[#EAE8E3] transition-all duration-300 bg-transparent">
            <div className="flex items-center gap-4 flex-1 overflow-hidden">
              <button
                onClick={() => store.toggleTaskCompletion(task.id)}
                className={cn(
                  "flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-500",
                  task.completed
                    ? "bg-[#8A9A86] border-[#8A9A86] text-white"
                    : "bg-transparent border-[#D1CEC7] text-transparent hover:border-[#8A9A86]"
                )}
              >
                <Check className="w-3 h-3 stroke-[2.5]" />
              </button>

              {editingTaskId === task.id ? (
                <div className="flex flex-col gap-2 flex-1">
                  <input
                    autoFocus
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => handleSaveEdit(task.id)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(task.id)}
                    className="flex-1 bg-transparent text-[15px] font-serif border-b border-[#8A9A86] focus:outline-none text-[#2C2C2C] py-0.5"
                  />
                  {task.type === 'one-time' && (
                    <div className="flex gap-2 mt-1">
                      {(['low', 'medium', 'high'] as const).map(p => (
                        <button
                          key={p}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setEditPriority(p);
                          }}
                          className={cn(
                            "text-[9px] uppercase tracking-widest px-2.5 py-0.5 rounded-full transition-all border",
                            editPriority === p
                              ? cn("text-white", priorityColors[p], priorityBorderColors[p])
                              : cn("bg-transparent text-[#A09E9A] hover:text-[#2C2C2C]", priorityBorderColors[p])
                          )}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-1 overflow-hidden">
                  <span className={cn(
                    "text-[15px] font-serif tracking-wide truncate transition-all duration-500",
                    task.completed ? "text-[#B0ADA5] line-through decoration-[#EAE8E3]" : "text-[#2C2C2C]"
                  )}>
                    {task.title}
                  </span>
                  {task.type === 'one-time' && task.priority && !task.completed && (
                    <button
                      onClick={() => cyclePriority(task.id, task.priority)}
                      className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors", priorityColors[task.priority])}
                      title={`Priority: ${task.priority}. Click to change.`}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </SwipeActions>
      </motion.div>
    );
  };

  return (
    <div className="pb-12">
      <AnimatePresence>
        {allCompleted && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="mb-10 py-6 text-center relative"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#F0EFEA] to-transparent opacity-50"></div>
            <p className="font-serif text-lg text-[#8A9A86] italic tracking-widest relative z-10">All completed.</p>
            <p className="text-[10px] text-[#A09E9A] tracking-[0.2em] uppercase mt-2 relative z-10">A day well spent</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mb-12">
        <h2 className="text-[10px] font-medium text-[#A09E9A] uppercase tracking-[0.2em] mb-2">Daily Habits</h2>
        <AnimatePresence mode="popLayout">
          {habitTasks.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-8">
              <p className="font-serif text-[#B0ADA5] italic text-sm">No habits set for today.</p>
            </motion.div>
          ) : (
            habitTasks.map((t: Task) => renderTask(t))
          )}
        </AnimatePresence>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[10px] font-medium text-[#A09E9A] uppercase tracking-[0.2em]">One-time Tasks</h2>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className={cn("transition-colors", isAdding ? "text-[#2C2C2C]" : "text-[#A09E9A] hover:text-[#2C2C2C]")}
          >
            {isAdding ? <X className="w-4 h-4 stroke-[1.5]" /> : <Plus className="w-4 h-4 stroke-[1.5]" />}
          </button>
        </div>
        
        <AnimatePresence mode="popLayout">
          {oneTimeTasks.map((t: Task) => renderTask(t))}
        </AnimatePresence>

        <AnimatePresence>
          {isAdding && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 flex flex-col gap-3 border-b border-[#EAE8E3] pb-4 overflow-hidden"
            >
              <div className="flex items-center gap-3">
                <input
                  autoFocus
                  type="text"
                  enterKeyHint="done"
                  placeholder="Add a task..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTask(); } }}
                  className="flex-1 bg-transparent text-[15px] font-serif placeholder:text-[#C4C1B9] placeholder:italic focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddTask}
                  disabled={!newTaskTitle.trim()}
                  className="text-[#2C2C2C] disabled:opacity-30 transition-opacity p-2 -m-2"
                >
                  <Plus className="w-4 h-4 stroke-[1.5]" />
                </button>
              </div>
              <div className="flex items-center gap-3 pl-1">
                <span className="text-[9px] text-[#A09E9A] uppercase tracking-widest">Priority:</span>
                <div className="flex gap-2">
                  {(['low', 'medium', 'high'] as const).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewTaskPriority(p)}
                      className={cn(
                        "text-[9px] uppercase tracking-widest px-2.5 py-0.5 rounded-full transition-all border",
                        newTaskPriority === p 
                          ? cn("text-white", priorityColors[p], priorityBorderColors[p])
                          : cn("bg-transparent text-[#A09E9A] hover:text-[#2C2C2C]", priorityBorderColors[p])
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
