import { Task } from '../types';

export interface TaskStats {
  total: number;
  completed: number;
  allCompleted: boolean;
  incompleteNames: string[];
}

/**
 * Deduplicates today's tasks and returns completion stats.
 * Habit tasks are deduped by habitId (preferring deterministic ID format).
 */
export function getTodayTaskStats(tasks: Task[], date: string): TaskStats {
  const todayTasks = tasks.filter(t => t.date === date);

  // Deduplicate habit tasks: keep only 1 per habitId (prefer deterministic ID)
  const rawHabitTasks = todayTasks.filter(t => t.type === 'habit');
  const seenHabitIds = new Set<string>();
  const habitTasks = rawHabitTasks
    .sort((a, b) => {
      const aIsDet = a.id === `${a.habitId}_${date}` ? 0 : 1;
      const bIsDet = b.id === `${b.habitId}_${date}` ? 0 : 1;
      return aIsDet - bIsDet;
    })
    .filter(t => {
      if (!t.habitId || seenHabitIds.has(t.habitId)) return false;
      seenHabitIds.add(t.habitId);
      return true;
    });

  const oneTimeTasks = todayTasks.filter(t => t.type === 'one-time');
  const dedupedTasks = [...habitTasks, ...oneTimeTasks];

  const completedCount = dedupedTasks.filter(t => t.completed).length;
  const incompleteNames = dedupedTasks.filter(t => !t.completed).map(t => t.title);

  return {
    total: dedupedTasks.length,
    completed: completedCount,
    allCompleted: dedupedTasks.length > 0 && completedCount === dedupedTasks.length,
    incompleteNames,
  };
}
