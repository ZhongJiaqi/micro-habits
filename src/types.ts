export interface MicroHabit {
  id: string;
  title: string;
  createdAt: string; // ISO string
  active: boolean;
  userId: string;
}

export interface Task {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  completed: boolean;
  type: 'habit' | 'one-time';
  habitId?: string; // Reference to MicroHabit if type is 'habit'
  priority?: 'low' | 'medium' | 'high';
  userId: string;
}

export interface HabitPoolItem {
  id: string;
  habitId: string;
  title: string;
  achievedDate: string; // YYYY-MM-DD
  userId: string;
}
