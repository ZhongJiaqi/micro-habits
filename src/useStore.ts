import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { MicroHabit, Task, HabitPoolItem } from './types';
import { db, auth } from './firebase';
import { collection, doc, setDoc, deleteDoc, updateDoc, onSnapshot, query } from 'firebase/firestore';

export async function migrateMicroHabitCategory(
  habit: MicroHabit,
  userId: string,
  setDocFn: typeof setDoc = setDoc,
): Promise<void> {
  if (habit.category) return; // already migrated, skip
  const path = `users/${userId}/microHabits/${habit.id}`;
  await setDocFn(doc(db, path), { category: 'habit' }, { merge: true });
}

export async function deleteOneTimeTasks(
  tasks: any[],
  userId: string,
  deleteDocFn: typeof deleteDoc = deleteDoc,
): Promise<number> {
  const oneTimeTasks = tasks.filter(t => t.type === 'one-time');
  if (oneTimeTasks.length === 0) return 0;
  console.log(`[migration] deleting ${oneTimeTasks.length} legacy one-time tasks`);
  await Promise.all(
    oneTimeTasks.map(t =>
      deleteDocFn(doc(db, `users/${userId}/tasks/${t.id}`)).catch(() => {})
    )
  );
  return oneTimeTasks.length;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface AppData {
  microHabits: MicroHabit[];
  tasks: Task[];
  habitPool: HabitPoolItem[];
}

const defaultData: AppData = {
  microHabits: [],
  tasks: [],
  habitPool: [],
};

export function useStore(userId?: string) {
  const [data, setData] = useState<AppData>(defaultData);
  const tasksLoadedRef = useRef(false);
  // Track which habit-date combos we've already initiated task creation for,
  // to avoid redundant Firestore writes (even though setDoc is idempotent).
  const createdTaskIdsRef = useRef(new Set<string>());

  useEffect(() => {
    tasksLoadedRef.current = false;
    const oneTimeMigrationDoneRef = { current: false };
    createdTaskIdsRef.current = new Set();
    if (!userId) {
      setData(defaultData);
      return;
    }

    // Ensure user document exists (needed for Cloud Function to discover users)
    setDoc(doc(db, `users/${userId}`), { lastSeen: new Date().toISOString() }, { merge: true }).catch(() => {});

    const microHabitsPath = `users/${userId}/microHabits`;
    const tasksPath = `users/${userId}/tasks`;
    const habitPoolPath = `users/${userId}/habitPool`;

    const microHabitsRef = collection(db, microHabitsPath);
    const tasksRef = collection(db, tasksPath);
    const habitPoolRef = collection(db, habitPoolPath);

    const unsubMicroHabits = onSnapshot(query(microHabitsRef), (snapshot) => {
      const microHabits = snapshot.docs.map(doc => doc.data() as MicroHabit);
      // Lazy migration: backfill category for legacy entries
      microHabits.forEach(h => {
        migrateMicroHabitCategory(h, userId).catch(() => {
          /* migration failure non-fatal, will retry next session */
        });
      });
      setData(prev => ({ ...prev, microHabits }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, microHabitsPath);
    });

    const unsubTasks = onSnapshot(query(tasksRef), (snapshot) => {
      const rawTasks = snapshot.docs.map(doc => doc.data() as any);
      // One-shot migration: delete legacy one-time tasks
      if (!oneTimeMigrationDoneRef.current) {
        oneTimeMigrationDoneRef.current = true;
        deleteOneTimeTasks(rawTasks, userId).catch(() => {
          oneTimeMigrationDoneRef.current = false; // retry next snapshot
        });
      }
      // Filter out one-time tasks from the live data immediately
      const tasks = rawTasks.filter(t => t.type !== 'one-time') as Task[];
      tasksLoadedRef.current = true;
      setData(prev => ({ ...prev, tasks }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, tasksPath);
    });

    const unsubHabitPool = onSnapshot(query(habitPoolRef), (snapshot) => {
      const habitPool = snapshot.docs.map(doc => doc.data() as HabitPoolItem);
      setData(prev => ({ ...prev, habitPool }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, habitPoolPath);
    });

    return () => {
      unsubMicroHabits();
      unsubTasks();
      unsubHabitPool();
    };
  }, [userId]);

  // --- Daily Reset + Dedup ---
  // 1. Clean up duplicate habit tasks (same habitId + date, different doc IDs)
  // 2. Ensure each active habit has exactly one task for today
  useEffect(() => {
    if (!userId || !tasksLoadedRef.current || data.microHabits.length === 0) return;

    const today = format(new Date(), 'yyyy-MM-dd');

    // --- Step 1: Delete duplicate tasks ---
    // Group today's habit tasks by habitId, keep only one (prefer deterministic ID)
    const todayHabitTasks = data.tasks.filter(t => t.date === today && t.type === 'habit' && t.habitId);
    const tasksByHabitId = new Map<string, Task[]>();
    todayHabitTasks.forEach(t => {
      const arr = tasksByHabitId.get(t.habitId!) || [];
      arr.push(t);
      tasksByHabitId.set(t.habitId!, arr);
    });

    tasksByHabitId.forEach((tasks, habitId) => {
      if (tasks.length > 1) {
        // Keep the one with deterministic ID (habitId_date), delete the rest
        const deterministicId = `${habitId}_${today}`;
        const toDelete = tasks.filter(t => t.id !== deterministicId);
        toDelete.forEach(t => {
          const path = `users/${userId}/tasks/${t.id}`;
          deleteDoc(doc(db, path)).catch(() => {});
        });
      }
    });

    // --- Step 2: Sync habit title to tasks if they diverged ---
    const habitTitleMap = new Map(data.microHabits.map(h => [h.id, h.title]));
    data.tasks.forEach(task => {
      if (task.type === 'habit' && task.habitId) {
        const habitTitle = habitTitleMap.get(task.habitId);
        if (habitTitle && habitTitle !== task.title) {
          const path = `users/${userId}/tasks/${task.id}`;
          updateDoc(doc(db, path), { title: habitTitle }).catch(error =>
            handleFirestoreError(error, OperationType.UPDATE, path));
        }
      }
    });

    // --- Step 3: Create missing tasks ---
    const existingHabitIds = new Set(todayHabitTasks.map(t => t.habitId));

    data.microHabits.forEach(habit => {
      const taskKey = `${habit.id}_${today}`;
      if (habit.active && !existingHabitIds.has(habit.id) && !createdTaskIdsRef.current.has(taskKey)) {
        createdTaskIdsRef.current.add(taskKey);
        const path = `users/${userId}/tasks/${taskKey}`;
        setDoc(doc(db, path), {
          id: taskKey,
          title: habit.title,
          date: today,
          completed: false,
          type: 'habit',
          habitId: habit.id,
          userId,
        } as Task).catch(error => handleFirestoreError(error, OperationType.CREATE, path));
      }
    });
  }, [data.microHabits, data.tasks, userId]);

  // --- Micro Habits ---
  const addMicroHabit = async (title: string): Promise<MicroHabit | undefined> => {
    if (!userId) return;
    const newHabitId = crypto.randomUUID();
    const newHabit: MicroHabit = {
      id: newHabitId,
      title,
      createdAt: new Date().toISOString(),
      active: true,
      userId,
    };
    const habitPath = `users/${userId}/microHabits/${newHabitId}`;
    try {
      await setDoc(doc(db, habitPath), newHabit);
      // Task creation is handled solely by the daily reset effect.
      // The effect will pick up this new habit via onSnapshot and create
      // the task with a deterministic ID. This avoids duplicate creation
      // from both addMicroHabit and the effect racing each other.
      return newHabit;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, habitPath);
    }
  };

  const updateMicroHabit = async (id: string, title: string) => {
    if (!userId) return;
    const path = `users/${userId}/microHabits/${id}`;
    try {
      await updateDoc(doc(db, path), { title });
      
      // Update ALL tasks for this habit (today + history)
      const tasksToUpdate = data.tasks.filter(t => t.habitId === id);
      for (const task of tasksToUpdate) {
        const taskPath = `users/${userId}/tasks/${task.id}`;
        await updateDoc(doc(db, taskPath), { title }).catch(error => handleFirestoreError(error, OperationType.UPDATE, taskPath));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const deleteMicroHabit = async (id: string) => {
    if (!userId) return;
    const path = `users/${userId}/microHabits/${id}`;
    try {
      await deleteDoc(doc(db, path));
      
      // Remove uncompleted tasks for today and future
      const tasksToDelete = data.tasks.filter(t => t.habitId === id && !t.completed);
      for (const task of tasksToDelete) {
        const taskPath = `users/${userId}/tasks/${task.id}`;
        await deleteDoc(doc(db, taskPath)).catch(error => handleFirestoreError(error, OperationType.DELETE, taskPath));
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  // --- Tasks ---
  const addOneTimeTask = async (title: string, date: string, priority: 'low' | 'medium' | 'high' = 'medium') => {
    if (!userId) return;
    const newTaskId = crypto.randomUUID();
    const newTask: Task = {
      id: newTaskId,
      title,
      date,
      completed: false,
      type: 'one-time',
      priority,
      userId,
    };
    const path = `users/${userId}/tasks/${newTaskId}`;
    try {
      await setDoc(doc(db, path), newTask);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const toggleTaskCompletion = async (id: string) => {
    if (!userId) return;
    const task = data.tasks.find(t => t.id === id);
    if (!task) return;

    const newCompletedState = !task.completed;
    const path = `users/${userId}/tasks/${id}`;

    try {
      await updateDoc(doc(db, path), { completed: newCompletedState });

      // Check for 21-day streak if it's a habit task being completed
      if (newCompletedState && task.type === 'habit' && task.habitId) {
        // We need to calculate streak. We can use the current data.tasks array
        // but considering the current task is now completed.
        const habitTasks = data.tasks
          .filter(t => t.habitId === task.habitId && (t.completed || t.id === id))
          .sort((a, b) => a.date.localeCompare(b.date));
        
        let currentStreak = 0;
        let lastDate = new Date(task.date);
        
        // Simple streak calculation going backwards from today
        for (let i = 0; i < 21; i++) {
          const checkDate = format(new Date(lastDate.getTime() - i * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
          if (habitTasks.some(t => t.date === checkDate)) {
            currentStreak++;
          } else {
            break;
          }
        }

        if (currentStreak >= 21) {
          // Check if already in pool
          if (!data.habitPool.some(p => p.habitId === task.habitId)) {
            const newPoolId = crypto.randomUUID();
            const newPoolItem: HabitPoolItem = {
              id: newPoolId,
              habitId: task.habitId,
              title: task.title,
              achievedDate: format(new Date(), 'yyyy-MM-dd'),
              userId,
            };
            const poolPath = `users/${userId}/habitPool/${newPoolId}`;
            await setDoc(doc(db, poolPath), newPoolItem).catch(error => handleFirestoreError(error, OperationType.CREATE, poolPath));
          }
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const deleteTask = async (id: string) => {
    if (!userId) return;
    const path = `users/${userId}/tasks/${id}`;
    try {
      await deleteDoc(doc(db, path));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const updateTask = async (id: string, title: string, priority?: 'low' | 'medium' | 'high') => {
    if (!userId) return;
    const path = `users/${userId}/tasks/${id}`;
    try {
      const updateData: any = { title };
      if (priority) updateData.priority = priority;
      await updateDoc(doc(db, path), updateData);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const updateTaskPriority = async (id: string, priority: 'low' | 'medium' | 'high') => {
    if (!userId) return;
    const path = `users/${userId}/tasks/${id}`;
    try {
      await updateDoc(doc(db, path), { priority });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  return {
    data,
    addMicroHabit,
    updateMicroHabit,
    deleteMicroHabit,
    addOneTimeTask,
    toggleTaskCompletion,
    deleteTask,
    updateTask,
    updateTaskPriority,
  };
}
