import { useState, FormEvent } from 'react';
import { Plus, X, Edit2, Sparkles, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MicroHabit } from '../types';
import { GoogleGenAI, Type } from "@google/genai";

export default function HabitsView({ store }: { store: any }) {
  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  
  const [isAiInputVisible, setIsAiInputVisible] = useState(false);
  const [aiGoal, setAiGoal] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const habits = store.data.microHabits;

  const handleAddHabit = (e: FormEvent) => {
    e.preventDefault();
    if (!newHabitTitle.trim()) return;
    store.addMicroHabit(newHabitTitle.trim());
    setNewHabitTitle('');
    setIsAdding(false);
  };

  const handleSaveEdit = (id: string) => {
    if (editTitle.trim()) {
      store.updateMicroHabit(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleGenerateHabits = async (e: FormEvent) => {
    e.preventDefault();
    if (!aiGoal.trim() || isGenerating) return;

    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate 3 to 5 highly actionable, extremely small "micro-habits" based on this goal: "${aiGoal}". 
A micro-habit should take less than 2 minutes to do.
Return ONLY a JSON array of strings.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.STRING,
            },
          },
        },
      });

      const generatedHabits = JSON.parse(response.text || "[]");
      generatedHabits.forEach((habit: string) => {
        store.addMicroHabit(habit);
      });
      setAiGoal('');
      setIsAiInputVisible(false);
    } catch (error) {
      console.error("Failed to generate habits:", error);
    } finally {
      setIsGenerating(false);
    }
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
          {habits.length === 0 && !isAdding && !isAiInputVisible ? (
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
                className="group flex items-center justify-between py-4 border-b border-[#EAE8E3] transition-all"
              >
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

                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 ml-4 gap-2">
                  {editingId !== habit.id && (
                    <button 
                      onClick={() => {
                        setEditingId(habit.id);
                        setEditTitle(habit.title);
                      }}
                      className="p-1.5 text-[#C4C1B9] hover:text-[#8A9A86] transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5 stroke-[1.5]" />
                    </button>
                  )}
                  <button 
                    onClick={() => store.deleteMicroHabit(habit.id)}
                    className="p-1.5 text-[#C4C1B9] hover:text-[#A35D5D] transition-colors"
                  >
                    <X className="w-4 h-4 stroke-[1.5]" />
                  </button>
                </div>
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
                  if (!newHabitTitle.trim()) setIsAdding(false);
                }}
                className="flex-1 bg-transparent text-[15px] font-serif placeholder:text-[#C4C1B9] placeholder:italic focus:outline-none"
              />
            </motion.form>
          )}

          {isAiInputVisible && (
            <motion.form 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleGenerateHabits} 
              className="flex items-center gap-4 py-4 border-b border-[#8A9A86]"
            >
              <span className="text-[10px] font-medium text-[#8A9A86] w-4 tracking-widest">
                AI
              </span>
              <input
                autoFocus
                type="text"
                placeholder="E.g. I want to be more productive..."
                value={aiGoal}
                onChange={(e) => setAiGoal(e.target.value)}
                disabled={isGenerating}
                className="flex-1 bg-transparent text-[15px] font-serif placeholder:text-[#C4C1B9] placeholder:italic focus:outline-none text-[#8A9A86]"
              />
              {isGenerating ? (
                <Loader2 className="w-4 h-4 text-[#8A9A86] animate-spin" />
              ) : (
                <button type="button" onClick={() => setIsAiInputVisible(false)} className="text-[#C4C1B9] hover:text-[#A35D5D]">
                  <X className="w-4 h-4 stroke-[1.5]" />
                </button>
              )}
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-8 flex items-center gap-6">
        {!isAdding && !isAiInputVisible && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[#A09E9A] hover:text-[#2C2C2C] transition-colors"
          >
            <Plus className="w-3 h-3 stroke-[2]" />
            <span>Add Habit</span>
          </motion.button>
        )}
        
        {!isAdding && !isAiInputVisible && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setIsAiInputVisible(true)}
            className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[#8A9A86] hover:text-[#6A7A66] transition-colors"
          >
            <Sparkles className="w-3 h-3 stroke-[2]" />
            <span>Generate with AI</span>
          </motion.button>
        )}
      </div>
    </div>
  );
}
