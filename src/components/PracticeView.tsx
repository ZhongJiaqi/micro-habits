import { useState, useRef, FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MicroHabit } from '../types';
import SwipeActions from './SwipeActions';

type Category = 'habit' | 'affirmation';

interface PracticeViewProps {
  store: any;
}

interface CategorySectionProps {
  title: string;
  category: Category;
  emptyText: string;
  habits: MicroHabit[];
  store: any;
}

function CategorySection({
  title,
  category,
  emptyText,
  habits,
  store,
}: CategorySectionProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const submittedRef = useRef(false);

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    if (submittedRef.current) return;
    if (!newTitle.trim()) return;
    submittedRef.current = true;
    const t = newTitle.trim();
    setNewTitle('');
    setIsAdding(false);
    store.addMicroHabit(t, category);
  };

  const handleSaveEdit = (id: string) => {
    if (editTitle.trim()) {
      store.updateMicroHabit(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const isAffirmation = category === 'affirmation';

  return (
    <div className="mb-10">
      <div className="text-[10px] font-medium text-[#A09E9A] uppercase tracking-[0.2em] mb-4">
        {title}
      </div>

      <AnimatePresence mode="popLayout">
        {habits.length === 0 && !isAdding ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-6 text-center"
          >
            <p className="text-sm font-serif italic text-[#B0ADA5]">{emptyText}</p>
          </motion.div>
        ) : (
          habits.map((habit, index) => (
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
                <div className="flex items-center gap-4 py-4 border-b border-[#EAE8E3]">
                  <span className="text-[10px] font-medium text-[#C4C1B9] w-4 tracking-widest">
                    {(index + 1).toString().padStart(2, '0')}
                  </span>
                  {editingId === habit.id ? (
                    <input
                      autoFocus
                      type="text"
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      onBlur={() => handleSaveEdit(habit.id)}
                      onKeyDown={e => e.key === 'Enter' && handleSaveEdit(habit.id)}
                      className="flex-1 bg-transparent text-[15px] font-serif border-b border-[#8A9A86] focus:outline-none text-[#2C2C2C] py-0.5"
                    />
                  ) : (
                    <span
                      className={`text-[15px] font-serif text-[#2C2C2C] truncate ${
                        isAffirmation ? 'italic' : ''
                      }`}
                    >
                      {isAffirmation && <span className="text-[#A09E9A]">&ldquo;</span>}
                      {habit.title}
                      {isAffirmation && <span className="text-[#A09E9A]">&rdquo;</span>}
                    </span>
                  )}
                </div>
              </SwipeActions>
            </motion.div>
          ))
        )}

        {isAdding && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAdd}
            className="flex items-center gap-4 py-4 border-b border-[#2C2C2C]"
          >
            <span className="text-[10px] font-medium text-[#C4C1B9] w-4 tracking-widest">
              {(habits.length + 1).toString().padStart(2, '0')}
            </span>
            <input
              autoFocus
              type="text"
              placeholder={isAffirmation ? 'Enter an affirmation...' : 'Enter a new habit...'}
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onBlur={() => {
                if (submittedRef.current) return;
                if (newTitle.trim()) {
                  submittedRef.current = true;
                  const t = newTitle.trim();
                  setNewTitle('');
                  setIsAdding(false);
                  store.addMicroHabit(t, category);
                } else {
                  setIsAdding(false);
                }
              }}
              className={`flex-1 bg-transparent text-[15px] font-serif placeholder:text-[#C4C1B9] placeholder:italic focus:outline-none ${
                isAffirmation ? 'italic' : ''
              }`}
            />
          </motion.form>
        )}
      </AnimatePresence>

      {!isAdding && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => {
            submittedRef.current = false;
            setIsAdding(true);
          }}
          className="mt-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[#A09E9A] hover:text-[#2C2C2C] transition-colors"
        >
          <Plus className="w-3 h-3 stroke-[2]" />
          <span>Add {isAffirmation ? 'Affirmation' : 'Habit'}</span>
        </motion.button>
      )}
    </div>
  );
}

export default function PracticeView({ store }: PracticeViewProps) {
  const allHabits: MicroHabit[] = store.data.microHabits;
  const affirmations = allHabits.filter(h => (h.category ?? 'habit') === 'affirmation');
  const habits = allHabits.filter(h => (h.category ?? 'habit') === 'habit');

  return (
    <div className="pb-12">
      <div className="mb-10 pt-4">
        <p className="text-xs text-[#8C8C8C] leading-relaxed font-light tracking-wide italic">
          &ldquo;Every action you take is a vote for the type of person you wish to become.&rdquo;
        </p>
        <p className="text-[10px] text-[#A09E9A] tracking-widest uppercase mt-2">
          — James Clear
        </p>
      </div>

      <CategorySection
        title="Affirmations"
        category="affirmation"
        emptyText="Words you live by, repeated."
        habits={affirmations}
        store={store}
      />

      <CategorySection
        title="Habits"
        category="habit"
        emptyText="The beginning of a new chapter."
        habits={habits}
        store={store}
      />
    </div>
  );
}
