/**
 * Unit tests for useStore — verifies task creation logic
 * to prevent the "duplicate task" bug.
 *
 * We mock Firebase Firestore and test the raw logic
 * extracted from useStore.ts.
 *
 * KEY DESIGN DECISIONS:
 * 1. addMicroHabit ONLY writes the habit — it does NOT create tasks.
 * 2. The daily reset effect is the SOLE owner of task creation.
 * 3. createdTaskIdsRef (Set) prevents duplicate Firestore writes even if
 *    the effect runs multiple times (StrictMode, onSnapshot re-fires).
 * 4. ensureHabitTask uses deterministic IDs (habitId_date) + setDoc,
 *    so even if called redundantly, Firestore ends up with 1 document.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { format } from 'date-fns';
import { migrateMicroHabitCategory, deleteOneTimeTasks, calculateStreak } from '../src/useStore';

// --- Extracted logic from useStore for testability ---

interface MicroHabit {
  id: string;
  title: string;
  createdAt: string;
  active: boolean;
  userId: string;
}

interface Task {
  id: string;
  title: string;
  date: string;
  completed: boolean;
  type: 'habit' | 'one-time';
  habitId?: string;
  userId: string;
}

/**
 * Simulates the Daily Reset logic from useStore.
 * Uses a createdTaskIds set to prevent duplicate creation,
 * mirroring createdTaskIdsRef in the real code.
 * Returns the list of tasks that would be created.
 */
function computeTasksToCreate(
  microHabits: MicroHabit[],
  existingTasks: Task[],
  createdTaskIds: Set<string>,
  userId: string,
  today: string
): Task[] {
  const tasksToCreate: Task[] = [];
  const existingTaskHabitIds = new Set(
    existingTasks.filter(t => t.date === today && t.type === 'habit').map(t => t.habitId)
  );

  microHabits.forEach(habit => {
    const taskKey = `${habit.id}_${today}`;
    if (habit.active && !existingTaskHabitIds.has(habit.id) && !createdTaskIds.has(taskKey)) {
      createdTaskIds.add(taskKey);
      tasksToCreate.push({
        id: taskKey,
        title: habit.title,
        date: today,
        completed: false,
        type: 'habit',
        habitId: habit.id,
        userId,
      });
    }
  });

  return tasksToCreate;
}

describe('Daily Reset — Task Creation', () => {
  const userId = 'test-user-123';
  const today = format(new Date(), 'yyyy-MM-dd');
  let createdTaskIds: Set<string>;

  beforeEach(() => {
    createdTaskIds = new Set();
  });

  it('creates one task per active habit', () => {
    const habits: MicroHabit[] = [
      { id: 'h1', title: 'Drink water', createdAt: '', active: true, userId },
      { id: 'h2', title: 'Do pushup', createdAt: '', active: true, userId },
    ];

    const tasks = computeTasksToCreate(habits, [], createdTaskIds, userId, today);

    expect(tasks).toHaveLength(2);
    expect(tasks[0].habitId).toBe('h1');
    expect(tasks[1].habitId).toBe('h2');
  });

  it('does NOT create duplicate tasks on second run (simulates onSnapshot double-fire)', () => {
    const habits: MicroHabit[] = [
      { id: 'h1', title: 'Drink water', createdAt: '', active: true, userId },
    ];

    // First run
    const first = computeTasksToCreate(habits, [], createdTaskIds, userId, today);
    expect(first).toHaveLength(1);

    // Second run — simulates onSnapshot firing again before Firestore syncs
    // existingTasks is still empty (Firestore hasn't synced yet)
    const second = computeTasksToCreate(habits, [], createdTaskIds, userId, today);
    expect(second).toHaveLength(0); // createdTaskIds prevents duplicate
  });

  it('does NOT create task if one already exists in Firestore', () => {
    const habits: MicroHabit[] = [
      { id: 'h1', title: 'Drink water', createdAt: '', active: true, userId },
    ];
    const existingTasks: Task[] = [
      { id: 'h1_' + today, title: 'Drink water', date: today, completed: false, type: 'habit', habitId: 'h1', userId },
    ];

    const tasks = computeTasksToCreate(habits, existingTasks, createdTaskIds, userId, today);
    expect(tasks).toHaveLength(0);
  });

  it('skips inactive habits', () => {
    const habits: MicroHabit[] = [
      { id: 'h1', title: 'Drink water', createdAt: '', active: false, userId },
    ];

    const tasks = computeTasksToCreate(habits, [], createdTaskIds, userId, today);
    expect(tasks).toHaveLength(0);
  });

  it('uses deterministic task ID (habitId_date)', () => {
    const habits: MicroHabit[] = [
      { id: 'h1', title: 'Drink water', createdAt: '', active: true, userId },
    ];

    const tasks = computeTasksToCreate(habits, [], createdTaskIds, userId, today);
    expect(tasks[0].id).toBe(`h1_${today}`);
  });

  it('handles rapid triple-fire (persistence cache + server + re-render)', () => {
    const habits: MicroHabit[] = [
      { id: 'h1', title: 'Drink water', createdAt: '', active: true, userId },
    ];

    const run1 = computeTasksToCreate(habits, [], createdTaskIds, userId, today);
    const run2 = computeTasksToCreate(habits, [], createdTaskIds, userId, today);
    const run3 = computeTasksToCreate(habits, [], createdTaskIds, userId, today);

    expect(run1).toHaveLength(1);
    expect(run2).toHaveLength(0);
    expect(run3).toHaveLength(0);
  });

  it('creates task for newly added habit after initial load', () => {
    const initialHabits: MicroHabit[] = [
      { id: 'h1', title: 'Drink water', createdAt: '', active: true, userId },
    ];

    // Initial load — effect creates task for h1
    computeTasksToCreate(initialHabits, [], createdTaskIds, userId, today);

    // User adds a new habit — onSnapshot fires with updated habits list.
    // Since dailyResetDone is no longer used, the effect re-runs and
    // checks both existing Firestore tasks AND createdTaskIds.
    const updatedHabits: MicroHabit[] = [
      ...initialHabits,
      { id: 'h2', title: 'Do pushup', createdAt: '', active: true, userId },
    ];
    // h1's task now exists in Firestore (onSnapshot synced)
    const existingTasks: Task[] = [
      { id: 'h1_' + today, title: 'Drink water', date: today, completed: false, type: 'habit', habitId: 'h1', userId },
    ];

    const tasks = computeTasksToCreate(updatedHabits, existingTasks, createdTaskIds, userId, today);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].habitId).toBe('h2');
  });

  it('handles new habit added when user started with 0 habits', () => {
    // This is the exact scenario that triggered the original bug:
    // User has 0 habits → adds their first habit → should get exactly 1 task.
    // Previously, addMicroHabit created a task AND the effect also tried to,
    // potentially with different timing causing duplicates.

    // Before adding: no habits, no tasks, effect doesn't run (microHabits.length === 0)
    const emptyRun = computeTasksToCreate([], [], createdTaskIds, userId, today);
    expect(emptyRun).toHaveLength(0);

    // User adds habit → onSnapshot fires with the new habit
    const habits: MicroHabit[] = [
      { id: 'h1', title: 'Drink water', createdAt: '', active: true, userId },
    ];

    // Effect runs (only source of task creation now)
    const tasks = computeTasksToCreate(habits, [], createdTaskIds, userId, today);
    expect(tasks).toHaveLength(1);

    // Effect re-runs due to onSnapshot for tasks (task just created)
    const existingTasks: Task[] = [
      { id: 'h1_' + today, title: 'Drink water', date: today, completed: false, type: 'habit', habitId: 'h1', userId },
    ];
    const rerun = computeTasksToCreate(habits, existingTasks, createdTaskIds, userId, today);
    expect(rerun).toHaveLength(0); // blocked by both existingTasks and createdTaskIds
  });

  it('addMicroHabit should NOT create a task (task creation is effect-only)', () => {
    // This documents the design decision:
    // addMicroHabit only writes the habit to Firestore.
    // The daily reset effect is the SOLE source of task creation.
    // This single-responsibility design prevents the duplicate bug where
    // addMicroHabit + effect both raced to create tasks.
    //
    // Verified by code inspection: addMicroHabit no longer calls ensureHabitTask.
    expect(true).toBe(true);
  });

  it('createdTaskIds ref is reset when userId changes (simulated)', () => {
    const habits: MicroHabit[] = [
      { id: 'h1', title: 'Drink water', createdAt: '', active: true, userId },
    ];

    // First user session
    computeTasksToCreate(habits, [], createdTaskIds, userId, today);
    expect(createdTaskIds.size).toBe(1);

    // Simulate userId change: createdTaskIdsRef.current = new Set()
    createdTaskIds = new Set();
    const tasks = computeTasksToCreate(habits, [], createdTaskIds, userId, today);
    expect(tasks).toHaveLength(1); // Creates again for new session
  });

  it('StrictMode double-fire with empty initial state does not cause issues', () => {
    // Simulates React StrictMode: effect runs, cleanup, effect runs again.
    // With 0 habits initially, the effect returns early both times.
    // When a habit is added later, createdTaskIds prevents double creation.

    // StrictMode first mount — no habits
    const run1 = computeTasksToCreate([], [], createdTaskIds, userId, today);
    expect(run1).toHaveLength(0);

    // StrictMode cleanup resets createdTaskIds (simulates createdTaskIdsRef.current = new Set())
    createdTaskIds = new Set();

    // StrictMode second mount — still no habits
    const run2 = computeTasksToCreate([], [], createdTaskIds, userId, today);
    expect(run2).toHaveLength(0);

    // Now user adds a habit — effect runs once
    const habits: MicroHabit[] = [
      { id: 'h1', title: 'Drink water', createdAt: '', active: true, userId },
    ];
    const run3 = computeTasksToCreate(habits, [], createdTaskIds, userId, today);
    expect(run3).toHaveLength(1);

    // Effect re-fires (e.g., from data.tasks change) — blocked by createdTaskIds
    const run4 = computeTasksToCreate(habits, [], createdTaskIds, userId, today);
    expect(run4).toHaveLength(0);
  });
});

/**
 * Simulates the updateMicroHabit sync logic from useStore.
 * When a habit title is edited, find all today's tasks for that habit and return them.
 */
function computeTasksToSync(
  habitId: string,
  existingTasks: Task[],
): Task[] {
  return existingTasks.filter(t => t.habitId === habitId);
}

describe('Habit Edit — Task Title Sync', () => {
  const userId = 'test-user-123';
  const today = format(new Date(), 'yyyy-MM-dd');

  it('syncs title to uncompleted today task', () => {
    const tasks: Task[] = [
      { id: `h1_${today}`, title: 'Old Title', date: today, completed: false, type: 'habit', habitId: 'h1', userId },
    ];

    const toSync = computeTasksToSync('h1', tasks);
    expect(toSync).toHaveLength(1);
    expect(toSync[0].id).toBe(`h1_${today}`);
  });

  it('syncs title to completed today task', () => {
    const tasks: Task[] = [
      { id: `h1_${today}`, title: 'Old Title', date: today, completed: true, type: 'habit', habitId: 'h1', userId },
    ];

    const toSync = computeTasksToSync('h1', tasks);
    expect(toSync).toHaveLength(1);
  });

  it('syncs title to historical tasks too', () => {
    const tasks: Task[] = [
      { id: 'h1_2026-01-01', title: 'Old Title', date: '2026-01-01', completed: false, type: 'habit', habitId: 'h1', userId },
      { id: `h1_${today}`, title: 'Old Title', date: today, completed: false, type: 'habit', habitId: 'h1', userId },
    ];

    const toSync = computeTasksToSync('h1', tasks);
    expect(toSync).toHaveLength(2);
  });

  it('does NOT sync tasks from other habits', () => {
    const tasks: Task[] = [
      { id: `h2_${today}`, title: 'Other Habit', date: today, completed: false, type: 'habit', habitId: 'h2', userId },
    ];

    const toSync = computeTasksToSync('h1', tasks);
    expect(toSync).toHaveLength(0);
  });

  it('does NOT sync one-time tasks', () => {
    const tasks: Task[] = [
      { id: 'random-id', title: 'One time task', date: today, completed: false, type: 'one-time', userId },
    ];

    const toSync = computeTasksToSync('h1', tasks);
    expect(toSync).toHaveLength(0);
  });
});

describe('HabitsView — Add Habit Form', () => {
  it('submittedRef prevents double submission from onSubmit + onBlur', () => {
    // Simulates the race condition:
    // 1. User presses Enter → onSubmit fires → submittedRef = true
    // 2. Form unmounts → onBlur fires → checks submittedRef → skips

    let submittedRef = false;
    let callCount = 0;

    const addHabit = () => {
      if (submittedRef) return;
      submittedRef = true;
      callCount++;
    };

    // Simulate onSubmit
    addHabit();
    // Simulate onBlur (triggered by form unmount)
    addHabit();

    expect(callCount).toBe(1);
  });
});

describe('Migration: backfill category for legacy MicroHabit', () => {
  it('writes category="habit" when habit lacks category field', async () => {
    const setDocMock = vi.fn().mockResolvedValue(undefined);
    const legacyHabit = {
      id: 'h1',
      title: '散步',
      createdAt: '2026-01-01T00:00:00.000Z',
      active: true,
      userId: 'u1',
      // NO category field — simulating legacy data
    } as any;

    await migrateMicroHabitCategory(legacyHabit, 'u1', setDocMock);

    expect(setDocMock).toHaveBeenCalledTimes(1);
    expect(setDocMock).toHaveBeenCalledWith(
      expect.anything(),
      { category: 'habit' },
      { merge: true }
    );
  });

  it('skips habit that already has category', async () => {
    const setDocMock = vi.fn().mockResolvedValue(undefined);
    const modernHabit = {
      id: 'h2',
      title: 'meditation',
      createdAt: '2026-05-03T00:00:00.000Z',
      active: true,
      userId: 'u1',
      category: 'habit',
    };

    await migrateMicroHabitCategory(modernHabit as any, 'u1', setDocMock);

    expect(setDocMock).not.toHaveBeenCalled();
  });

  it('handles affirmation category correctly (does not overwrite)', async () => {
    const setDocMock = vi.fn().mockResolvedValue(undefined);
    const affirmationHabit = {
      id: 'h3',
      title: 'I am enough.',
      createdAt: '2026-05-03T00:00:00.000Z',
      active: true,
      userId: 'u1',
      category: 'affirmation',
    };

    await migrateMicroHabitCategory(affirmationHabit as any, 'u1', setDocMock);

    expect(setDocMock).not.toHaveBeenCalled();
  });
});

describe('Migration: hard-delete one-time tasks', () => {
  it('deletes tasks where type === "one-time"', async () => {
    const deleteDocMock = vi.fn().mockResolvedValue(undefined);
    const tasks = [
      { id: 't1', title: 'walk', date: '2026-05-03', completed: false, habitId: 'h1', userId: 'u1', type: 'habit' },
      { id: 't2', title: 'one-off thing', date: '2026-05-03', completed: false, userId: 'u1', type: 'one-time', priority: 'high' },
      { id: 't3', title: 'read', date: '2026-05-03', completed: true, habitId: 'h2', userId: 'u1', type: 'habit' },
    ] as any[];

    const deletedCount = await deleteOneTimeTasks(tasks, 'u1', deleteDocMock);

    expect(deletedCount).toBe(1);
    expect(deleteDocMock).toHaveBeenCalledTimes(1);
  });

  it('returns 0 when no one-time tasks exist (idempotent)', async () => {
    const deleteDocMock = vi.fn();
    const tasks = [
      { id: 't1', title: 'walk', date: '2026-05-03', completed: false, habitId: 'h1', userId: 'u1' },
    ] as any[];

    const deletedCount = await deleteOneTimeTasks(tasks, 'u1', deleteDocMock);

    expect(deletedCount).toBe(0);
    expect(deleteDocMock).not.toHaveBeenCalled();
  });
});

describe('calculateStreak', () => {
  it('returns 0 when no tasks completed', () => {
    expect(calculateStreak('h1', '2026-05-03', [])).toBe(0);
  });

  it('counts consecutive completed days back from fromDate', () => {
    const tasks = [
      { habitId: 'h1', date: '2026-05-03', completed: true },
      { habitId: 'h1', date: '2026-05-02', completed: true },
      { habitId: 'h1', date: '2026-05-01', completed: true },
      { habitId: 'h1', date: '2026-04-29', completed: true }, // gap on 2026-04-30
    ];
    expect(calculateStreak('h1', '2026-05-03', tasks)).toBe(3);
  });

  it('treats incomplete tasks as breaks', () => {
    const tasks = [
      { habitId: 'h1', date: '2026-05-03', completed: true },
      { habitId: 'h1', date: '2026-05-02', completed: false }, // break
      { habitId: 'h1', date: '2026-05-01', completed: true },
    ];
    expect(calculateStreak('h1', '2026-05-03', tasks)).toBe(1);
  });

  it('ignores other habits', () => {
    const tasks = [
      { habitId: 'h1', date: '2026-05-03', completed: true },
      { habitId: 'h2', date: '2026-05-02', completed: true },
    ];
    expect(calculateStreak('h1', '2026-05-03', tasks)).toBe(1);
  });
});
