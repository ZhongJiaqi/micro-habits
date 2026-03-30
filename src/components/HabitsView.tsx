import { useState, useRef, FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MicroHabit } from '../types';
import SwipeActions from './SwipeActions';

export default function HabitsView({ store }: { store: any }) {
  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const habits = store.data.microHabits;
  const submittedRef = useRef(false);

  const handleAddHabit = (e: FormEvent) => {
    e.preventDefault();
    if (submittedRef.current) return;
    if (!newHabitTitle.trim()) return;
    submittedRef.current = true;
    const title = newHabitTitle.trim();
    setNewHabitTitle('');
    setIsAdding(false);
    store.addMicroHabit(title);
  };

  const handleSaveEdit = (id: string) => {
    if (editTitle.trim()) {
      store.updateMicroHabit(id, editTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="pb-12">
      <div className="mb-12 pt-4">
        <p className="text-xs text-[#8C8C8C] leading-relaxed font-light tracking-wide">
          Small, effortless actions. They will appear automatically in your daily view.
        </p>
      </div>

      <div className="space-y-1">
        <AnimatePresence mode="popLayout">
          {habits.length === 0 && !isAdding ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-12 text-center"
            >
              <p className="text-sm font-serif italic text-[#B0ADA5]">The beginning of a new chapter.</p>
            </motion.div>
          ) : (
            habits.map((habit: MicroHabit, index: number) => (
              <motion.div
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, filter: 'blur(4px)' }}
                transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                key={habit.id}
              >
                <SwipeActions
                  onEdit={() => {
                    setEditingId(habit.id);
                    setEditTitle(habit.title);
                  }}
                  onDelete={() => store.deleteMicroHabit(habit.id)}
                >
                  <div className="flex items-center justify-between py-4 border-b border-[#EAE8E3] transition-all">
                    <div className="flex items-center gap-4 flex-1 overflow-hidden">
                      <span className="text-[10px] font-medium text-[#C4C1B9] w-4 tracking-widest">
                        {(index + 1).toString().padStart(2, '0')}
                      </span>
                      {editingId === habit.id ? (
                        <input
                          autoFocus
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onBlur={() => handleSaveEdit(habit.id)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(habit.id)}
                          className="flex-1 bg-transparent text-[15px] font-serif border-b border-[#8A9A86] focus:outline-none text-[#2C2C2C] py-0.5"
                        />
                      ) : (
                        <span className="text-[15px] font-serif text-[#2C2C2C] truncate">
                          {habit.title}
                        </span>
                      )}
                    </div>
                  </div>
                </SwipeActions>
              </motion.div>
            ))
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isAdding && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleAddHabit}
              className="flex items-center gap-4 py-4 border-b border-[#2C2C2C]"
            >
              <span className="text-[10px] font-medium text-[#C4C1B9] w-4 tracking-widest">
                {(habits.length + 1).toString().padStart(2, '0')}
              </span>
              <input
                autoFocus
                type="text"
                placeholder="Enter a new habit..."
                value={newHabitTitle}
                onChange={(e) => setNewHabitTitle(e.target.value)}
                onBlur={() => {
                  if (submittedRef.current) return;
                  if (newHabitTitle.trim()) {
                    submittedRef.current = true;
                    const title = newHabitTitle.trim();
                    setNewHabitTitle('');
                    setIsAdding(false);
                    console.log('[DEBUG] calling addMicroHabit from onBlur:', title);
                    store.addMicroHabit(title);
                  } else {
                    setIsAdding(false);
                  }
                }}
                className="flex-1 bg-transparent text-[15px] font-serif placeholder:text-[#C4C1B9] placeholder:italic focus:outline-none"
              />
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-8 flex items-center gap-6">
        {!isAdding && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => { submittedRef.current = false; setIsAdding(true); }}
            className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[#A09E9A] hover:text-[#2C2C2C] transition-colors"
          >
            <Plus className="w-3 h-3 stroke-[2]" />
            <span>Add Habit</span>
          </motion.button>
        )}
      </div>
    </div>
  );
}
