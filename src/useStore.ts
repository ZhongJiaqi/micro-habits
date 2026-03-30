import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { MicroHabit, Task, HabitPoolItem } from './types';
import { db, auth } from './firebase';
import { collection, doc, setDoc, deleteDoc, updateDoc, onSnapshot, query } from 'firebase/firestore';

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

  useEffect(() => {
    if (!userId) {
      setData(defaultData);
      return;
    }

    const microHabitsPath = `users/${userId}/microHabits`;
    const tasksPath = `users/${userId}/tasks`;
    const habitPoolPath = `users/${userId}/habitPool`;

    const microHabitsRef = collection(db, microHabitsPath);
    const tasksRef = collection(db, tasksPath);
    const habitPoolRef = collection(db, habitPoolPath);

    const unsubMicroHabits = onSnapshot(query(microHabitsRef), (snapshot) => {
      const microHabits = snapshot.docs.map(doc => doc.data() as MicroHabit);
      setData(prev => ({ ...prev, microHabits }));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, microHabitsPath);
    });

    const unsubTasks = onSnapshot(query(tasksRef), (snapshot) => {
      const tasks = snapshot.docs.map(doc => doc.data() as Task);
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

  // --- Initialization / Daily Reset ---
  useEffect(() => {
    if (!userId || data.microHabits.length === 0) return;

    const today = format(new Date(), 'yyyy-MM-dd');
    
    // Check if active habits have tasks for today
    data.microHabits.forEach(habit => {
      if (habit.active) {
        const hasTaskToday = data.tasks.some(t => t.date === today && t.habitId === habit.id);
        if (!hasTaskToday) {
          const newTaskId = crypto.randomUUID();
          const newTask: Task = {
            id: newTaskId,
            title: habit.title,
            date: today,
            completed: false,
            type: 'habit',
            habitId: habit.id,
            userId,
          };
          const path = `users/${userId}/tasks/${newTaskId}`;
          setDoc(doc(db, path), newTask).catch(error => handleFirestoreError(error, OperationType.CREATE, path));
        }
      }
    });
  }, [data.microHabits, data.tasks, userId]);

  // --- Micro Habits ---
  const addMicroHabit = async (title: string) => {
    if (!userId) return;
    const newHabitId = crypto.randomUUID();
    const newHabit: MicroHabit = {
      id: newHabitId,
      title,
      createdAt: new Date().toISOString(),
      active: true,
      userId,
    };
    const path = `users/${userId}/microHabits/${newHabitId}`;
    try {
      await setDoc(doc(db, path), newHabit);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const updateMicroHabit = async (id: string, title: string) => {
    if (!userId) return;
    const path = `users/${userId}/microHabits/${id}`;
    try {
      await updateDoc(doc(db, path), { title });
      
      // Also update today's uncompleted habit tasks to match the new title
      const today = format(new Date(), 'yyyy-MM-dd');
      const tasksToUpdate = data.tasks.filter(t => t.habitId === id && t.date === today && !t.completed);
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
