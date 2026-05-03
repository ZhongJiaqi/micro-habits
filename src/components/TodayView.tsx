import type { ReactNode } from 'react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Task, MicroHabit } from '../types';

interface TodayViewProps {
  store: any;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10px] font-medium text-[#A09E9A] uppercase tracking-[0.2em] mt-8 mb-3">
      {children}
    </div>
  );
}

interface TaskRowProps {
  task: Task;
  isAffirmation: boolean;
  onToggle: () => void;
}

function TaskRow({ task, isAffirmation, onToggle }: TaskRowProps) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-[#EAE8E3]">
      <button
        onClick={onToggle}
        className={`w-4 h-4 rounded-full border-[1.5px] transition-all ${
          task.completed
            ? 'bg-[#8A9A86] border-[#8A9A86]'
            : 'border-[#C4C1B9]'
        }`}
        aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
      />
      <span
        className={`flex-1 text-[15px] font-serif transition-colors ${
          task.completed ? 'text-[#B0ADA5] line-through decoration-[#C4C1B9]' : 'text-[#2C2C2C]'
        } ${isAffirmation ? 'italic before:content-[\'\\201C\'] after:content-[\'\\201D\'] before:text-[#A09E9A] after:text-[#A09E9A]' : ''}`}
      >
        {task.title}
      </span>
    </div>
  );
}

export default function TodayView({ store }: TodayViewProps) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const tasksToday = store.data.tasks.filter((t: Task) => t.date === today);

  // build category map from microHabits
  const habitCategoryMap = new Map<string, 'habit' | 'affirmation'>();
  store.data.microHabits.forEach((h: MicroHabit) => {
    habitCategoryMap.set(h.id, h.category ?? 'habit');
  });

  const affirmations = tasksToday.filter((t: Task) =>
    habitCategoryMap.get(t.habitId) === 'affirmation'
  );
  const habits = tasksToday.filter((t: Task) =>
    habitCategoryMap.get(t.habitId) !== 'affirmation' // default to habit if missing
  );

  return (
    <div className="pb-12">
      <AnimatePresence>
        {affirmations.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <SectionLabel>Affirmations</SectionLabel>
            {affirmations.map((task: Task) => (
              <div key={task.id}>
                <TaskRow
                  task={task}
                  isAffirmation
                  onToggle={() => store.toggleTaskCompletion(task.id)}
                />
              </div>
            ))}
          </motion.div>
        )}

        {habits.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <SectionLabel>Habits</SectionLabel>
            {habits.map((task: Task) => (
              <div key={task.id}>
                <TaskRow
                  task={task}
                  isAffirmation={false}
                  onToggle={() => store.toggleTaskCompletion(task.id)}
                />
              </div>
            ))}
          </motion.div>
        )}

        {tasksToday.length === 0 && (
          <div className="py-16 text-center">
            <p className="font-serif italic text-sm text-[#B0ADA5]">
              No practices yet. Set up your first in Practice.
            </p>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
