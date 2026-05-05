import { useState } from 'react';
import { format } from 'date-fns';
import { MicroHabit, Task, HabitPoolItem, MicroHabitCategory } from './types';

const DEMO_USER_ID = 'demo-user';

function makeInitial() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const now = new Date();
  // Backdate habit creation 30 days so daysSinceLastCompletion can look back.
  const createdAt = new Date(now.getTime() - 30 * 86400000).toISOString();

  const habits: MicroHabit[] = [
    { id: 'a1', title: 'I am enough.',          createdAt, active: true, userId: DEMO_USER_ID, category: 'affirmation' },
    { id: 'a2', title: 'Today, I choose calm.', createdAt, active: true, userId: DEMO_USER_ID, category: 'affirmation' },
    { id: 'h1', title: '散步 30 分钟',          createdAt, active: true, userId: DEMO_USER_ID, category: 'habit' },
    { id: 'h2', title: '读书 20 页',            createdAt, active: true, userId: DEMO_USER_ID, category: 'habit' },
  ];

  // Today's tasks (uncompleted).
  const tasks: Task[] = habits.map(h => ({
    id: `${h.id}_${today}`,
    title: h.title,
    date: today,
    completed: false,
    habitId: h.id,
    userId: DEMO_USER_ID,
  }));

  // Historical task data — designed to exercise both new features:
  //   • h1 (散步)         → 25 days completed → in Hall, no quiet streak
  //   • h2 (读书)         → 22 days completed → in Hall, no quiet streak
  //   • a1 (I am enough.) → 18 days completed, last 5 days silent → "5 days quiet"
  //   • a2 (calm)         →  4 days completed, completed yesterday → no quiet
  const h1SkipDays = [3, 7, 12];
  const h2SkipDays = [4, 8, 14, 18, 22, 28];
  for (let i = 1; i <= 28; i++) {
    const d = new Date(now.getTime() - i * 86400000);
    const ds = format(d, 'yyyy-MM-dd');

    if (!h1SkipDays.includes(i)) {
      tasks.push({ id: `h1_${ds}`, title: '散步 30 分钟', date: ds, completed: true, habitId: 'h1', userId: DEMO_USER_ID });
    }
    if (!h2SkipDays.includes(i)) {
      tasks.push({ id: `h2_${ds}`, title: '读书 20 页', date: ds, completed: true, habitId: 'h2', userId: DEMO_USER_ID });
    }
    // a1: completed days 6-25 except 10 and 15 → 18 total, last completion 6 days ago → 5 days quiet
    if (i >= 6 && i <= 25 && i !== 10 && i !== 15) {
      tasks.push({ id: `a1_${ds}`, title: 'I am enough.', date: ds, completed: true, habitId: 'a1', userId: DEMO_USER_ID });
    }
    // a2: sparse (4 total), most recent = yesterday → no quiet
    if ([1, 4, 8, 15].includes(i)) {
      tasks.push({ id: `a2_${ds}`, title: 'Today, I choose calm.', date: ds, completed: true, habitId: 'a2', userId: DEMO_USER_ID });
    }
  }

  return { habits, tasks };
}

export function useDemoStore() {
  const [{ habits: initHabits, tasks: initTasks }] = useState(makeInitial);
  const [microHabits, setMicroHabits] = useState<MicroHabit[]>(initHabits);
  const [tasks, setTasks] = useState<Task[]>(initTasks);
  const [habitPool] = useState<HabitPoolItem[]>([]);

  const today = format(new Date(), 'yyyy-MM-dd');

  return {
    data: { microHabits, tasks, habitPool, loaded: true },

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
