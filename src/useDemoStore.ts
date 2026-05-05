import { useState } from 'react';
import { format } from 'date-fns';
import { MicroHabit, Task, HabitPoolItem, MicroHabitCategory } from './types';

const DEMO_USER_ID = 'demo-user';

function makeInitial() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const now = new Date().toISOString();
  const habits: MicroHabit[] = [
    { id: 'a1', title: 'I am enough.', createdAt: now, active: true, userId: DEMO_USER_ID, category: 'affirmation' },
    { id: 'a2', title: 'Today, I choose calm.', createdAt: now, active: true, userId: DEMO_USER_ID, category: 'affirmation' },
    { id: 'h1', title: '散步 30 分钟', createdAt: now, active: true, userId: DEMO_USER_ID, category: 'habit' },
    { id: 'h2', title: '读书 20 页', createdAt: now, active: true, userId: DEMO_USER_ID, category: 'habit' },
  ];
  const tasks: Task[] = habits.map(h => ({
    id: `${h.id}_${today}`,
    title: h.title,
    date: today,
    completed: false,
    habitId: h.id,
    userId: DEMO_USER_ID,
  }));
  return { habits, tasks };
}

export function useDemoStore() {
  const [{ habits: initHabits, tasks: initTasks }] = useState(makeInitial);
  const [microHabits, setMicroHabits] = useState<MicroHabit[]>(initHabits);
  const [tasks, setTasks] = useState<Task[]>(initTasks);
  const [habitPool] = useState<HabitPoolItem[]>([]);

  const today = format(new Date(), 'yyyy-MM-dd');

  return {
    data: { microHabits, tasks, habitPool },

    toggleTaskCompletion: (id: string) => {
      setTasks(prev => prev.map(t => (t.id === id ? { ...t, completed: !t.completed } : t)));
    },

    addMicroHabit: async (title: string, category: MicroHabitCategory = 'habit'): Promise<MicroHabit> => {
      const id = crypto.randomUUID();
      const newHabit: MicroHabit = {
        id,
        title,
        createdAt: new Date().toISOString(),
        active: true,
        userId: DEMO_USER_ID,
        category,
      };
      setMicroHabits(prev => [...prev, newHabit]);
      setTasks(prev => [
        ...prev,
        { id: `${id}_${today}`, title, date: today, completed: false, habitId: id, userId: DEMO_USER_ID },
      ]);
      return newHabit;
    },

    updateMicroHabit: async (id: string, title: string): Promise<void> => {
      setMicroHabits(prev => prev.map(h => (h.id === id ? { ...h, title } : h)));
      setTasks(prev => prev.map(t => (t.habitId === id ? { ...t, title } : t)));
    },

    deleteMicroHabit: async (id: string): Promise<void> => {
      setMicroHabits(prev => prev.filter(h => h.id !== id));
      setTasks(prev => prev.filter(t => t.habitId !== id));
    },

    deleteTask: async (id: string): Promise<void> => {
      setTasks(prev => prev.filter(t => t.id !== id));
    },

    updateTask: async (id: string, updates: Partial<Task>): Promise<void> => {
      setTasks(prev => prev.map(t => (t.id === id ? { ...t, ...updates } : t)));
    },

    updateTaskPriority: async (): Promise<void> => {
      // legacy no-op (priority field removed in Becoming refactor)
    },
  };
}

export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).has('demo');
}
