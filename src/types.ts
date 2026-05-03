export type MicroHabitCategory = 'habit' | 'affirmation';

export interface MicroHabit {
  id: string;
  title: string;
  createdAt: string; // ISO string
  active: boolean;
  userId: string;
  category: MicroHabitCategory;
}

export interface Task {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  habitId: string; // 现在必填，所有 task 都来自 habit
  userId: string;
}

export interface HabitPoolItem {
  id: string;
  habitId: string;
  title: string;
  achievedDate: string; // YYYY-MM-DD
  userId: string;
}
