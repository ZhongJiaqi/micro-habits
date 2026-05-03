# Becoming Rebrand + 肯定语模块 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Micro Habits 改名为 Becoming，引入 affirmations 作为一等内容类型，删除 one-time tasks，平滑迁移现有数据。

**Architecture:** MicroHabit 加 `category: 'habit' | 'affirmation'` 字段；Task 删除 `type` 和 `priority` 字段；UI 在 Today / Practice / History 三个页面分两个视觉上区分的 section（Affirmations 在上、Habits 在下）；`useStore` 挂载时跑一次幂等 migration（补 category + 删除 one-time task）。

**Tech Stack:** React 19、TypeScript、Vite、Firebase Firestore、vitest、Playwright、Tailwind CSS、vite-plugin-pwa。

**Spec reference:** `docs/superpowers/specs/2026-05-03-becoming-rebrand-and-affirmation-module-design.md` (commit `c9ff37b`)

---

## 实施顺序与原则

按 5 个 Phase 推进，每个 Phase 内部 task 之间可以独立 commit。Phase 之间有依赖：

```
Phase 1 (types) → Phase 2 (useStore) → Phase 3 (UI) → Phase 4 (rebrand) → Phase 5 (E2E)
```

**全局原则**：
- TDD：先写失败测试 → 跑测试 verify 失败 → 写最小实现 → 跑测试 verify 通过 → commit。
- 每个 task 完成都要 commit（commit message 用 conventional commit format）。
- 不修改全局 git config（用 `-c user.email=... -c user.name=...` 一次性身份）。
- 不 push（push 留到 plan 全部完成 + smoke test 通过后再做）。
- 个人项目，不开 PR。

---

# Phase 1: 数据模型 + 类型定义

## Task 1: 更新 `types.ts` —— MicroHabit 加 category，Task 删 type/priority

**Files:**
- Modify: `src/types.ts`
- Test: 由后续 useStore tests 隐式覆盖（types.ts 是纯类型，无运行时行为，单独测试无意义）

- [ ] **Step 1: 修改 `src/types.ts`**

替换文件全部内容为：

```ts
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
```

- [ ] **Step 2: 跑 `npm run lint` 看 TypeScript error 范围**

```bash
npm run lint
```

预期：会有多个文件报错（`useStore.ts` 引用了 `Task.type`，`TodayView.tsx` 引用了 `task.type === 'one-time'` 等）。**这是预期的**，下个 task 修。记录报错文件清单。

- [ ] **Step 3: Commit types.ts 改动（即使有 lint error 也 commit，作为重构起点）**

```bash
git add src/types.ts
git -c user.email="jiaqii.zhong@gmail.com" -c user.name="ZhongJiaqi" -c commit.gpgsign=false commit -m "refactor(types): MicroHabit 加 category，Task 删 type/priority

为后续 affirmation 模块和 one-time task 删除做准备。
此 commit 后 lint 会暂时失败（usestore/TodayView 等仍引用旧字段），
后续 task 逐个修复。"
```

---

# Phase 2: useStore 数据层

## Task 2: 添加 lazy migration —— legacy MicroHabit 补 `category='habit'`

**Files:**
- Modify: `src/useStore.ts`
- Test: `tests/useStore.test.ts` (扩展已有文件)

- [ ] **Step 1: 写失败测试**

打开 `tests/useStore.test.ts`，在最后添加新 describe block：

```ts
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

    // 调用 migration helper（即将实现）
    await migrateMicroHabitCategory(legacyHabit, 'u1', setDocMock);

    expect(setDocMock).toHaveBeenCalledTimes(1);
    expect(setDocMock).toHaveBeenCalledWith(
      expect.anything(), // doc ref
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
```

在 test 文件顶部 import 添加：

```ts
import { migrateMicroHabitCategory } from '../src/useStore';
```

- [ ] **Step 2: 跑测试 verify 失败**

```bash
npm test -- --run tests/useStore.test.ts
```

预期：3 个新测试 fail，错误是 "migrateMicroHabitCategory is not a function" 或 import error。

- [ ] **Step 3: 在 `src/useStore.ts` 实现 migration helper 并 export**

在 `src/useStore.ts` 顶部 `import` 区域下面（第 7 行 enum 之前）添加：

```ts
export async function migrateMicroHabitCategory(
  habit: MicroHabit,
  userId: string,
  setDocFn: typeof setDoc = setDoc,
): Promise<void> {
  if (habit.category) return; // already migrated, skip
  const path = `users/${userId}/microHabits/${habit.id}`;
  await setDocFn(doc(db, path), { category: 'habit' }, { merge: true });
}
```

- [ ] **Step 4: 跑测试 verify 通过**

```bash
npm test -- --run tests/useStore.test.ts
```

预期：3 个新测试都 PASS。

- [ ] **Step 5: 在 useStore 主 useEffect 里调用迁移**

在 `src/useStore.ts` 的 `useEffect` 主体里（在 `unsubMicroHabits` 的 onSnapshot 回调中）加入迁移调用。把现有的：

```ts
const unsubMicroHabits = onSnapshot(query(microHabitsRef), (snapshot) => {
  const microHabits = snapshot.docs.map(doc => doc.data() as MicroHabit);
  setData(prev => ({ ...prev, microHabits }));
}, (error) => {
  handleFirestoreError(error, OperationType.LIST, microHabitsPath);
});
```

改为：

```ts
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
```

- [ ] **Step 6: 跑全部测试 verify 没破坏其他**

```bash
npm test -- --run
```

预期：全部 17 + 3 = 20 个测试通过（实际数字可能不同，关键是没新增 fail）。

- [ ] **Step 7: Commit**

```bash
git add src/useStore.ts tests/useStore.test.ts
git -c user.email="jiaqii.zhong@gmail.com" -c user.name="ZhongJiaqi" -c commit.gpgsign=false commit -m "feat(useStore): MicroHabit 加 category lazy migration

挂载 useStore 时若发现 microHabit 没 category 字段，
写 { category: 'habit' } merge 进去。幂等。"
```

---

## Task 3: One-time task 硬删除 migration

**Files:**
- Modify: `src/useStore.ts`
- Test: `tests/useStore.test.ts`

- [ ] **Step 1: 写失败测试**

在 `tests/useStore.test.ts` 末尾新建 describe：

```ts
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
```

在文件顶部 import 添加：

```ts
import { deleteOneTimeTasks } from '../src/useStore';
```

- [ ] **Step 2: 跑测试 verify 失败**

```bash
npm test -- --run tests/useStore.test.ts
```

预期：2 个新测试 fail，"deleteOneTimeTasks is not a function"。

- [ ] **Step 3: 在 `src/useStore.ts` 实现 + export**

在 `migrateMicroHabitCategory` 下面添加：

```ts
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
```

- [ ] **Step 4: 跑测试 verify 通过**

```bash
npm test -- --run tests/useStore.test.ts
```

预期：2 个新测试 PASS。

- [ ] **Step 5: 在 useStore tasks onSnapshot 里调用**

在 `src/useStore.ts` 的 tasks subscription 里把：

```ts
const unsubTasks = onSnapshot(query(tasksRef), (snapshot) => {
  const tasks = snapshot.docs.map(doc => doc.data() as Task);
  tasksLoadedRef.current = true;
  setData(prev => ({ ...prev, tasks }));
}, (error) => {
  handleFirestoreError(error, OperationType.LIST, tasksPath);
});
```

改为：

```ts
const oneTimeMigrationDoneRef = { current: false };

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
```

注意：把 `oneTimeMigrationDoneRef` 提到外层 `useEffect` 顶部和 `tasksLoadedRef` 同级，避免每次 snapshot 重置：

```ts
// 在 useEffect 内的顶部，跟 tasksLoadedRef 一起
const oneTimeMigrationDoneRef = { current: false };
```

- [ ] **Step 6: 跑全部测试 verify 没破坏其他**

```bash
npm test -- --run
```

预期：全部测试通过。

- [ ] **Step 7: Commit**

```bash
git add src/useStore.ts tests/useStore.test.ts
git -c user.email="jiaqii.zhong@gmail.com" -c user.name="ZhongJiaqi" -c commit.gpgsign=false commit -m "feat(useStore): 删除 legacy one-time tasks migration

挂载时一次性扫描所有 task，type==='one-time' 的全部 deleteDoc。
幂等。删除前 console.log 数量。同时在 in-memory data 里立即过滤掉，
避免它们在删除完成前显示出来。"
```

---

## Task 4: 移除 task.type === 'habit' 过滤；addMicroHabit 接受 category

**Files:**
- Modify: `src/useStore.ts`
- Test: `tests/useStore.test.ts`

- [ ] **Step 1: 写失败测试 —— affirmation 21 天也触发 Hall of Fame**

在 `tests/useStore.test.ts` 已有的 Hall of Fame describe 里加测试（如果没有就新建）：

```ts
describe('Hall of Fame: affirmation triggers entry', () => {
  it('writes HabitPoolItem when affirmation reaches 21 consecutive days', () => {
    // 这个测试以现有 streak 计算为基础。
    // 改前：只 type==='habit' 触发。改后：所有 task 都触发。
    // 关键断言：mock 21 天连续完成 + category='affirmation' 的 microHabit
    // → 调用 setDoc 写 habitPool 文档
    const habit = { id: 'a1', title: 'I am enough.', category: 'affirmation', active: true } as any;
    const tasks = Array.from({ length: 21 }, (_, i) => {
      const d = new Date('2026-05-03');
      d.setDate(d.getDate() - i);
      return {
        id: `t_${i}`,
        habitId: 'a1',
        date: d.toISOString().slice(0, 10),
        completed: true,
        title: 'I am enough.',
        userId: 'u1',
      };
    });
    // 此处具体的 mock 写法依赖 useStore 内部 toggleTask 的 testability。
    // 如果 toggleTask 不导出，此测试需要 import { calculateStreakAndMaybeAddToHall }
    // 或类似纯函数。
    // 对应实现见 Step 3：把 streak + Hall trigger 抽出成纯函数 export。
    expect(true).toBe(true); // 临时占位 — Step 3 实现后回来填断言
  });
});
```

> **注**：这个 task 的 TDD 严格度可以放宽——Hall of Fame trigger 内嵌在 toggleTask 副作用里，难单测。建议把 streak 计算提到独立纯函数（计算 + 决定是否写 pool），先 unit test 纯函数。

- [ ] **Step 2: 抽出 streak 计算成纯函数**

在 `src/useStore.ts` 的 `migrateMicroHabitCategory` 下面（其他 helper 同级）添加：

```ts
export function calculateStreak(
  habitId: string,
  fromDate: string, // YYYY-MM-DD
  allTasks: Pick<Task, 'habitId' | 'date' | 'completed'>[],
): number {
  const taskDates = new Set(
    allTasks
      .filter(t => t.habitId === habitId && t.completed)
      .map(t => t.date)
  );
  let streak = 0;
  const start = new Date(fromDate);
  for (let i = 0; i < 365; i++) {
    const d = new Date(start.getTime() - i * 24 * 60 * 60 * 1000);
    const ds = d.toISOString().slice(0, 10);
    if (taskDates.has(ds)) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}
```

- [ ] **Step 3: 写 calculateStreak 单元测试**

替换 Step 1 的占位 expect：

```ts
import { calculateStreak } from '../src/useStore';

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
```

跑：

```bash
npm test -- --run tests/useStore.test.ts
```

预期：4 个新测试 PASS（如果失败，调整 calculateStreak 实现）。

- [ ] **Step 4: 修改 toggleTask 用新的 calculateStreak（去掉 task.type filter）**

`src/useStore.ts` 的 toggleTask 函数里有：

```ts
if (newCompletedState && task.type === 'habit' && task.habitId) {
  const habitTasks = data.tasks
    .filter(t => t.habitId === task.habitId && (t.completed || t.id === id))
    .sort((a, b) => a.date.localeCompare(b.date));

  let currentStreak = 0;
  let lastDate = new Date(task.date);

  for (let i = 0; i < 21; i++) {
    const checkDate = format(new Date(lastDate.getTime() - i * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
    if (habitTasks.some(t => t.date === checkDate)) {
      currentStreak++;
    } else {
      break;
    }
  }

  if (currentStreak >= 21) {
    // ... write to habitPool
  }
}
```

替换为：

```ts
if (newCompletedState && task.habitId) {
  // 包含当前刚被勾选的 task（虚拟 completed=true），计算 streak
  const allTasksForStreak = data.tasks.map(t =>
    t.id === id ? { ...t, completed: true } : t
  );
  const currentStreak = calculateStreak(task.habitId, task.date, allTasksForStreak);

  if (currentStreak >= 21) {
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
      await setDoc(doc(db, poolPath), newPoolItem).catch(error =>
        handleFirestoreError(error, OperationType.CREATE, poolPath));
    }
  }
}
```

注意：删了 `task.type === 'habit'`，所有 task 都从 habit 来。

- [ ] **Step 5: 修改 addMicroHabit 接受 category 参数**

`src/useStore.ts` 的：

```ts
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
  // ... rest
};
```

改为：

```ts
const addMicroHabit = async (
  title: string,
  category: 'habit' | 'affirmation' = 'habit',
): Promise<MicroHabit | undefined> => {
  if (!userId) return;
  const newHabitId = crypto.randomUUID();
  const newHabit: MicroHabit = {
    id: newHabitId,
    title,
    createdAt: new Date().toISOString(),
    active: true,
    userId,
    category,
  };
  // ... rest unchanged
};
```

- [ ] **Step 6: 修改 daily reset effect —— 删除 task.type 过滤 + 同步 title 也不限于 type==='habit'**

`src/useStore.ts` 的 daily reset effect 里：

```ts
const todayHabitTasks = data.tasks.filter(t => t.date === today && t.type === 'habit' && t.habitId);
```

改为：

```ts
const todayHabitTasks = data.tasks.filter(t => t.date === today && t.habitId);
```

同样 title 同步：

```ts
data.tasks.forEach(task => {
  if (task.type === 'habit' && task.habitId) {
    // ...
  }
});
```

改为：

```ts
data.tasks.forEach(task => {
  if (task.habitId) {
    // ...
  }
});
```

并且 daily reset 里创建 task 的代码：

```ts
setDoc(doc(db, path), {
  id: taskKey,
  title: habit.title,
  date: today,
  completed: false,
  type: 'habit',  // ← 删掉这行
  habitId: habit.id,
  userId,
} as Task).catch(...);
```

把 `type: 'habit',` 删掉。

- [ ] **Step 7: 跑全部测试**

```bash
npm test -- --run
```

预期：全部通过。如果 HabitsView 测试 mock 调用 addMicroHabit 失败，因为签名变了——更新 mock。

- [ ] **Step 8: Commit**

```bash
git add src/useStore.ts tests/useStore.test.ts
git -c user.email="jiaqii.zhong@gmail.com" -c user.name="ZhongJiaqi" -c commit.gpgsign=false commit -m "refactor(useStore): 抽出 calculateStreak 纯函数，移除 task.type 过滤

addMicroHabit 加 category 参数（默认 'habit'）。
删除 daily reset / Hall of Fame trigger 里的 t.type === 'habit' 过滤。
所有 task 现在都来自 habit，不需要 type 字段。
肯定语连续 21 天也会进入 Hall of Fame。"
```

---

# Phase 3: UI 重构

## Task 5: TodayView 双 section 渲染 + 肯定语 italic + 引号

**Files:**
- Modify: `src/components/TodayView.tsx`
- Test: 视觉测试通过 E2E + manual smoke 覆盖（component-level snapshot 在该项目无现成基础设施，不引入新框架）

- [ ] **Step 1: 读现有 `src/components/TodayView.tsx` 全文，了解结构**

```bash
wc -l src/components/TodayView.tsx
```

预期：约 100-200 行。

- [ ] **Step 2: 全量改写 TodayView**

⚠️ **注**：此 task 不是 minimal change，是较大改动。完成后用 `git diff src/components/TodayView.tsx` 重新审视。

将 `src/components/TodayView.tsx` 改为以下结构（保留现有 import 和动画 wrapper，新增分组逻辑）：

```tsx
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Task, MicroHabit } from '../types';

interface TodayViewProps {
  store: any; // 沿用现有 type
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-medium text-[#A09E9A] uppercase tracking-[0.2em] mt-8 mb-3">
      {children}
    </div>
  );
}

function TaskRow({ task, isAffirmation, onToggle }: {
  task: Task;
  isAffirmation: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-[#EAE8E3]">
      <button
        onClick={onToggle}
        className={`w-4 h-4 rounded-full border-[1.5px] transition-all ${
          task.completed
            ? 'bg-[#8A9A86] border-[#8A9A86]'
            : 'border-[#C4C1B9]'
        }`}
        aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
      />
      <span
        className={`flex-1 text-[15px] font-serif transition-colors ${
          task.completed ? 'text-[#B0ADA5] line-through decoration-[#C4C1B9]' : 'text-[#2C2C2C]'
        } ${isAffirmation ? 'italic before:content-[\'\\201C\'] after:content-[\'\\201D\'] before:text-[#A09E9A] after:text-[#A09E9A]' : ''}`}
      >
        {task.title}
      </span>
    </div>
  );
}

export default function TodayView({ store }: TodayViewProps) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const tasksToday = store.data.tasks.filter((t: Task) => t.date === today);

  // build category map from microHabits
  const habitCategoryMap = new Map<string, 'habit' | 'affirmation'>();
  store.data.microHabits.forEach((h: MicroHabit) => {
    habitCategoryMap.set(h.id, h.category ?? 'habit');
  });

  const affirmations = tasksToday.filter((t: Task) =>
    habitCategoryMap.get(t.habitId) === 'affirmation'
  );
  const habits = tasksToday.filter((t: Task) =>
    habitCategoryMap.get(t.habitId) !== 'affirmation' // default to habit if missing
  );

  return (
    <div className="pb-12">
      <AnimatePresence>
        {affirmations.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <SectionLabel>Affirmations</SectionLabel>
            {affirmations.map((task: Task) => (
              <TaskRow
                key={task.id}
                task={task}
                isAffirmation
                onToggle={() => store.toggleTask(task.id)}
              />
            ))}
          </motion.div>
        )}

        {habits.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <SectionLabel>Habits</SectionLabel>
            {habits.map((task: Task) => (
              <TaskRow
                key={task.id}
                task={task}
                isAffirmation={false}
                onToggle={() => store.toggleTask(task.id)}
              />
            ))}
          </motion.div>
        )}

        {tasksToday.length === 0 && (
          <div className="py-16 text-center">
            <p className="font-serif italic text-sm text-[#B0ADA5]">
              No practices yet. Set up your first in Practice.
            </p>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

> **注**：`before:content-[\'\\201C\']` 是 Tailwind arbitrary value 写双引号 Unicode（U+201C `"`），`\\201D` 是 U+201D `"`。如果 Tailwind 不接受可改为 inline `<span>` 包裹。

- [ ] **Step 3: 跑 lint 看 TS error**

```bash
npm run lint
```

预期：之前因 `task.type` 引发的错误现在该消失了（Task 不再有 type 字段，新代码不引用）。如果还有 type error 修复。

- [ ] **Step 4: 跑 unit tests**

```bash
npm test -- --run
```

预期：全部通过。

- [ ] **Step 5: 跑 dev server 手动看一眼**

```bash
npm run dev
```

打开 http://localhost:3000，登录后访问 Today。
预期：看到分两个 section（如果有数据），肯定语 italic 带引号，习惯 serif 正立。

- [ ] **Step 6: Commit**

```bash
git add src/components/TodayView.tsx
git -c user.email="jiaqii.zhong@gmail.com" -c user.name="ZhongJiaqi" -c commit.gpgsign=false commit -m "feat(TodayView): 双 section 渲染（Affirmations 上 Habits 下）

肯定语 italic + 引号样式，习惯 serif 正立。
完成态圆形 check 填绿 + line-through。
空 section 标题不渲染。
删除 one-time UI（编辑 input、priority chip）。"
```

---

## Task 6: HabitsView → PracticeView 重命名 + 双 section + James Clear tagline

**Files:**
- Rename: `src/components/HabitsView.tsx` → `src/components/PracticeView.tsx`
- Modify: 改写为双 section
- Modify: `src/App.tsx`（改 import 名 + tab 标签）
- Test: E2E + manual

- [ ] **Step 1: git mv 重命名**

```bash
git mv src/components/HabitsView.tsx src/components/PracticeView.tsx
```

- [ ] **Step 2: 改写 PracticeView 为双 section**

将 `src/components/PracticeView.tsx` 改写为：

```tsx
import { useState, useRef, FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MicroHabit } from '../types';
import SwipeActions from './SwipeActions';

type Category = 'habit' | 'affirmation';

interface PracticeViewProps {
  store: any;
}

function CategorySection({
  title,
  category,
  emptyText,
  habits,
  store,
}: {
  title: string;
  category: Category;
  emptyText: string;
  habits: MicroHabit[];
  store: any;
}) {
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
                        isAffirmation
                          ? 'italic before:content-[\'\\201C\'] after:content-[\'\\201D\'] before:text-[#A09E9A] after:text-[#A09E9A]'
                          : ''
                      }`}
                    >
                      {habit.title}
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
              placeholder={isAffirmation ? '"Enter an affirmation..."' : 'Enter a new habit...'}
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
          "Every action you take is a vote for the type of person you wish to become."
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
```

- [ ] **Step 3: 修改 `src/App.tsx` —— 改 import 名**

`src/App.tsx` 顶部 import：

```tsx
import HabitsView from './components/HabitsView';
```

改为：

```tsx
import PracticeView from './components/PracticeView';
```

main JSX 里查找 `<HabitsView` 替换为 `<PracticeView`，`activeTab === 'habits'` 改为 `activeTab === 'practice'`。tab state 类型也跟着改：

```tsx
const [activeTab, setActiveTab] = useState<'today' | 'habits' | 'history'>('today');
```

改为：

```tsx
const [activeTab, setActiveTab] = useState<'today' | 'practice' | 'history'>('today');
```

底部 nav 那行（`onClick={() => setActiveTab('habits')}` 那个 button），把 `'habits'` 改为 `'practice'`，文案 `HABITS` 改为 `PRACTICE`。

- [ ] **Step 4: 跑 lint**

```bash
npm run lint
```

预期：通过。

- [ ] **Step 5: 跑 dev server 手动看**

```bash
npm run dev
```

预期：底部 nav 中间 tab 名为 PRACTICE，点进去看到双 section（Affirmations / Habits），各自有 + 按钮，James Clear 引文在顶部。

- [ ] **Step 6: Commit**

```bash
git add src/components/PracticeView.tsx src/App.tsx
git -c user.email="jiaqii.zhong@gmail.com" -c user.name="ZhongJiaqi" -c commit.gpgsign=false commit -m "feat(PracticeView): 重命名 HabitsView 并改为双 section CRUD

新增 Affirmations / Habits 两个 section，独立 + 按钮。
顶部加 James Clear tagline 替换原 intro。
肯定语 italic + 引号样式。
App.tsx tab 名 Habits → Practice。"
```

---

## Task 7: HistoryView filter + Active Practices + Hall affirmation 渲染

**Files:**
- Modify: `src/components/HistoryView.tsx`
- Test: 现有 useStore 测试覆盖底层算法；视觉手动验证

- [ ] **Step 1: 读现有 HistoryView 全文**

```bash
wc -l src/components/HistoryView.tsx
```

预期：约 200-220 行。

- [ ] **Step 2: 在 HistoryView 顶部加 filter state + helper**

`src/components/HistoryView.tsx` 顶部 import 不变，函数体里：

```tsx
type Filter = 'all' | 'habit' | 'affirmation';

export default function HistoryView({ store }: { store: any }) {
  const { tasks, habitPool, microHabits } = store.data;
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [filter, setFilter] = useState<Filter>('all');

  // build category map
  const habitCategoryMap = new Map<string, 'habit' | 'affirmation'>();
  microHabits.forEach((h: MicroHabit) =>
    habitCategoryMap.set(h.id, h.category ?? 'habit')
  );

  // apply filter to tasks
  const filteredTasks = filter === 'all'
    ? tasks
    : tasks.filter((t: Task) => habitCategoryMap.get(t.habitId) === filter);

  // ... 后续所有用到 tasks 的地方都改用 filteredTasks
```

注意 import 加 `useState` 和 `MicroHabit`：

```tsx
import { useState } from 'react';
import { Task, HabitPoolItem, MicroHabit } from '../types';
```

- [ ] **Step 3: 替换所有 `tasks` 引用为 `filteredTasks`（除了 habitPool 部分）**

具体在 HistoryView 内部（搜每一处）：

- `tasksByDate` 计算用 `filteredTasks`
- `weeklyData` 计算用 `filteredTasks`
- 日历内的 `dayTasks = tasks.filter(...)` 改为 `dayTasks = filteredTasks.filter(...)`

但 `habitPool` 计算（Hall of Fame 那段，约 line 188-189）的 completedDays 应该按当前 filter 也走 filteredTasks，**或**保持总数（建议保持总数，反正 Hall of Fame 不分类）。

把 line 189:

```tsx
const completedDays = tasks.filter((t: Task) => t.type === 'habit' && t.habitId === item.habitId && t.completed).length;
```

改为（删 type filter）：

```tsx
const completedDays = tasks.filter((t: Task) => t.habitId === item.habitId && t.completed).length;
```

- [ ] **Step 4: "Active Habits" → "Active Practices"，且按 filter 算**

找到：

```tsx
const activeHabitsCount = microHabits.filter((h: any) => h.active).length;
```

改为：

```tsx
const activeFilteredHabits = filter === 'all'
  ? microHabits.filter((h: MicroHabit) => h.active)
  : microHabits.filter((h: MicroHabit) => h.active && (h.category ?? 'habit') === filter);
const activePracticesCount = activeFilteredHabits.length;
```

JSX 里 `Active Habits` 文字 + `activeHabitsCount` 改为 `Active Practices` + `activePracticesCount`。

- [ ] **Step 5: 加 filter toggle UI**

在 History tab 顶部、`HISTORY` 标题和月份导航旁边加 filter toggle：

```tsx
<div className="flex items-center justify-between mb-8">
  <h2 className="text-[10px] font-medium text-[#A09E9A] uppercase tracking-[0.2em]">
    History
  </h2>
  <div className="flex items-center gap-3 text-[10px] tracking-[0.2em] uppercase">
    {(['all', 'habit', 'affirmation'] as Filter[]).map(f => (
      <button
        key={f}
        onClick={() => setFilter(f)}
        className={`transition-colors ${
          filter === f ? 'text-[#1A1A1A] font-medium' : 'text-[#A09E9A] hover:text-[#5C5A56]'
        }`}
      >
        {f === 'habit' ? 'Habits' : f === 'affirmation' ? 'Affirmations' : 'All'}
      </button>
    ))}
  </div>
  {/* 月份导航另起一行或保留在原位置 */}
</div>
```

> 注：月份导航的位置可能需要调整布局——可以让 filter 占顶部一行，月份导航另起一行。

- [ ] **Step 6: Hall of Fame 渲染肯定语用 italic + 引号**

找到 Hall 渲染那块，把 entry 内容：

```tsx
<span className="text-[15px] font-serif text-[#2C2C2C]">{item.title}</span>
```

改为：

```tsx
{(() => {
  const isAffirmation = habitCategoryMap.get(item.habitId) === 'affirmation';
  return (
    <span
      className={`text-[15px] font-serif text-[#2C2C2C] ${
        isAffirmation
          ? 'italic before:content-[\'\\201C\'] after:content-[\'\\201D\'] before:text-[#A09E9A] after:text-[#A09E9A]'
          : ''
      }`}
    >
      {item.title}
    </span>
  );
})()}
```

- [ ] **Step 7: 跑 lint + tests**

```bash
npm run lint && npm test -- --run
```

预期：全部通过。

- [ ] **Step 8: 跑 dev 手动看**

```bash
npm run dev
```

预期：History 顶部有 All / Habits / Affirmations 三个切换；切换时 calendar、streak、weekly 都更新；Hall 里肯定语 entry 是 italic + 引号。

- [ ] **Step 9: Commit**

```bash
git add src/components/HistoryView.tsx
git -c user.email="jiaqii.zhong@gmail.com" -c user.name="ZhongJiaqi" -c commit.gpgsign=false commit -m "feat(HistoryView): 加 filter All/Habits/Affirmations + Active Practices

filter 是视图镜头，不持久化（每次默认 All）。
Active Habits → Active Practices，按 filter 计数。
Hall of Fame 肯定语 entry 用 italic + 引号渲染。
删除 t.type === 'habit' 过滤。"
```

---

# Phase 4: 品牌 + 配置

## Task 8: App.tsx rebrand to Becoming + login subtitle

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 替换登录页品牌文字和 subtitle**

`src/App.tsx` 找登录页 JSX 块，把：

```tsx
<h1 className="text-4xl font-serif font-medium tracking-widest text-[#1A1A1A] mb-4">Micro Habits</h1>
<p className="text-[#8C8C8C] mb-12">Build better habits, one day at a time.</p>
```

改为：

```tsx
<h1 className="text-4xl font-serif font-medium tracking-widest text-[#1A1A1A] mb-4">Becoming</h1>
<p className="text-[#8C8C8C] mb-2 text-sm leading-relaxed italic">"Every action you take is a vote for the type of person you wish to become."</p>
<p className="text-[10px] text-[#A09E9A] tracking-widest uppercase mb-12">— James Clear</p>
```

- [ ] **Step 2: 替换主 header 品牌文字**

找：

```tsx
<h1 className="text-2xl font-serif font-medium tracking-widest text-[#1A1A1A]">Micro Habits</h1>
```

改为：

```tsx
<h1 className="text-2xl font-serif font-medium tracking-widest text-[#1A1A1A]">Becoming</h1>
```

- [ ] **Step 3: 跑 lint + dev 手动看**

```bash
npm run lint && npm run dev
```

预期：登录页和主 header 都显示 Becoming，登录页 subtitle 是 James Clear 引文。

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git -c user.email="jiaqii.zhong@gmail.com" -c user.name="ZhongJiaqi" -c commit.gpgsign=false commit -m "feat(App): rebrand 'Micro Habits' → 'Becoming'

登录页和主 header 应用名换为 Becoming。
登录页 subtitle 换为 James Clear tagline。"
```

---

## Task 9: index.html / vite.config.ts manifest / README

**Files:**
- Modify: `index.html`
- Modify: `vite.config.ts`
- Modify: `README.md`

- [ ] **Step 1: 修改 `index.html`**

把 `<title>MicroHabits</title>` 改为 `<title>Becoming</title>`。

- [ ] **Step 2: 修改 `vite.config.ts` 的 PWA manifest**

找：

```ts
manifest: {
  name: 'MicroHabits',
  short_name: 'MicroHabits',
  description: 'Build better habits, one day at a time.',
  ...
}
```

改为：

```ts
manifest: {
  name: 'Becoming',
  short_name: 'Becoming',
  description: 'Every action you take is a vote for who you wish to become.',
  ...
}
```

- [ ] **Step 3: 修改 `README.md` 顶部**

打开 `README.md`，把 H1 标题改为：

```markdown
# Becoming

肯定语和习惯的每日实践。每个行动，都是投给你想成为之人的一票。
```

（保留原 README 其余内容不动。如果原 README 没有这种结构，添加这个 H1 + 副标题在最顶部。）

- [ ] **Step 4: 重新 build 验证 manifest 生成正确**

```bash
npm run build
```

跑完后 grep 看新 manifest:

```bash
grep -i 'becoming\|micro' dist/manifest.webmanifest
```

预期：含 `Becoming`，**不含** `MicroHabits`。

- [ ] **Step 5: Commit**

```bash
git add index.html vite.config.ts README.md
git -c user.email="jiaqii.zhong@gmail.com" -c user.name="ZhongJiaqi" -c commit.gpgsign=false commit -m "chore: rebrand index.html / PWA manifest / README → Becoming

PWA manifest name + short_name + description 全部更新。
package.json 的 name 字段保留 micro-habits（不改避免 Vercel slug 重链接）。"
```

---

# Phase 5: E2E + 验收

## Task 10: E2E 测试新流程

**Files:**
- Modify: `tests/e2e/habits.spec.ts`（如存在）or Create: `tests/e2e/becoming.spec.ts`

- [ ] **Step 1: 看现有 E2E 测试**

```bash
ls tests/e2e/
cat tests/e2e/habits.spec.ts 2>/dev/null | head -30
```

了解现有 test pattern。

- [ ] **Step 2: 加 E2E test —— 验证登录页文案**

如果有现成的 spec 文件，加一个 test：

```ts
test('登录页显示 Becoming 和 James Clear tagline', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Becoming');
  await expect(page.locator('p').filter({ hasText: 'Every action you take' })).toBeVisible();
  await expect(page.locator('p').filter({ hasText: 'James Clear' })).toBeVisible();
});
```

> **注**：完整登录后流程（创建 affirmation、切换 filter）需要测试账号或 mock。如果没有 fixture 现成支持，本 task 只覆盖未登录态的视觉。完整 E2E 留到后续。

- [ ] **Step 3: 跑 E2E**

```bash
npm run test:e2e
```

预期：新测试 PASS。

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/
git -c user.email="jiaqii.zhong@gmail.com" -c user.name="ZhongJiaqi" -c commit.gpgsign=false commit -m "test(e2e): 验证登录页 Becoming + James Clear tagline"
```

---

## Task 11: 手动冒烟 + verification-before-completion + 部署准备

**Files:**
- 不修改代码

- [ ] **Step 1: 读取并遵循 verification-before-completion skill（CLAUDE.md 全局规则）**

按 superpowers:verification-before-completion skill 要求执行最终验证。

- [ ] **Step 2: 跑全部 lint + unit + E2E**

```bash
npm run lint
npm test -- --run
npm run test:e2e
```

全部通过。

- [ ] **Step 3: 跑 production build**

```bash
npm run build
```

预期：build 通过，dist/ 含 sw.js + workbox + assets。

- [ ] **Step 4: 跑 dev 完整冒烟**

```bash
npm run dev
```

完成下面所有步骤：

1. 浏览器打开 localhost:3000，看到登录页显示 Becoming + James Clear 引文。
2. 用真实 Google 账号登录。
3. 进入 Today 页：旧的 habit 还在，没有任何 one-time task（已被删除）。
4. 切到 Practice 页（之前叫 Habits）：看到 James Clear tagline，"Affirmations" section 空（emptyText: "Words you live by, repeated."），"Habits" section 显示现有 habits。
5. 在 Practice 页加一条 affirmation："I am enough."
6. 回 Today 页：看到 affirmation 在顶部 section（italic + 引号），habits 在下面 section。
7. 点击肯定语 checkbox：变绿 + line-through。
8. 点击习惯 checkbox：变绿 + line-through。
9. 切到 History：filter 默认 All，看到完成的天数；切到 Affirmations 看 calendar 只反映肯定语。
10. 关闭浏览器再打开，filter 应该重置为 All（不持久化）。

如果上面任意步骤失败，回到对应 task 修。

- [ ] **Step 5: 看 git log 确认 commits 清晰**

```bash
git log --oneline -15
```

预期：约 8-10 个 commit，每个对应一个 task，message 清楚。

- [ ] **Step 6: 部署预览（不直接 promote 到 prod）**

```bash
vercel
```

（不带 `--prod`）—— 这会建一个 preview deployment。注意 preview URL 因 Vercel SSO Protection 可能需要 bypass token；个人测试可以先在 dev 验证。

- [ ] **Step 7: 部署到生产（用户明确批准后）**

⚠️ **此步必须由用户明确批准 "部署到生产" 才能执行。** Agent 不可自行触发 prod deploy。

```
! vercel --prod
```

部署成功后，用 Playwright 模拟桌面 + iPhone UA 验证登录链路：参考之前 `c08d49f` commit 里建立的验证流程。

- [ ] **Step 8: Push commit 到 GitHub**

```bash
git push origin main
```

（不会触发 Vercel 重部署，因为 Vercel 是手动 CLI 模式。）

---

# 全局回滚预案

任何 phase 失败：

```bash
# 回滚到本 plan 实施前的 commit (c9ff37b)
git reset --hard c9ff37b   # ⚠️ 仅限未 push 的本地 commit
```

如果数据迁移问题（一次性删除了不该删的 one-time task）：用 Firebase 控制台的 PITR 在 7 天内恢复，命令参考 spec §8。

---

# Self-Review Checklist

**Spec 覆盖检查**：

- [x] Rebrand → Task 8, 9
- [x] MicroHabit.category 字段 → Task 1, 2
- [x] Task 删 type/priority → Task 1, 4
- [x] Practice 页双 section → Task 6
- [x] Today 页双 section + italic affirmation → Task 5
- [x] History filter + Active Practices + Hall affirmation → Task 7
- [x] One-time task 硬删除 → Task 3
- [x] Lazy migration → Task 2, 3
- [x] James Clear tagline → Task 6, 8
- [x] PWA manifest / index.html / README rebrand → Task 9
- [x] E2E + 冒烟 → Task 10, 11

**全部 spec 章节都有对应 task。**

**Placeholder 扫描**：除了 Task 4 Step 1 那个临时占位测试（在 Step 3 被替换为真实测试），全部步骤都有具体代码或具体命令。

**Type consistency**：`MicroHabitCategory` 在 types.ts 定义后，PracticeView 用 `'habit' | 'affirmation'`（等价类型）。`addMicroHabit(title, category)` 签名在 Task 4 Step 5 定义后，PracticeView Task 6 内调用 `store.addMicroHabit(t, category)` 一致。`calculateStreak` 在 Task 4 Step 2 定义后没有被其他 task 重命名。

无内部不一致。
