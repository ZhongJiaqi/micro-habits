/**
 * 测试 Cloud Function 的 getIncompleteTaskNames 纯函数。
 *
 * 这个函数是 cron 推送的"判断是否还有未完成"的核心逻辑。
 * 之前的 bug：Function 用 t.type === 'habit' 过滤，但前端在 commit 1fcb28e 后
 * 创建的 task 文档不带 type 字段（前端 Task 接口删掉了），导致所有 task 被过滤掉，
 * 误判"全部完成"，cron 跳过推送。
 */
import { describe, it, expect } from 'vitest';
import {
  getIncompleteTaskNames,
  formatNotificationBody,
  type Task,
} from '../functions/src/incomplete-tasks';

const D = '2026-05-06';

function task(partial: Partial<Task>): Task {
  return {
    id: partial.id ?? 'default-id',
    title: partial.title ?? 'task',
    date: partial.date ?? D,
    completed: partial.completed ?? false,
    habitId: partial.habitId,
    userId: 'u1',
    ...partial,
  };
}

describe('getIncompleteTaskNames', () => {
  it('当 task 不带 type 字段（当前数据格式）时仍然返回未完成项', () => {
    const tasks: Task[] = [
      task({ id: 'h1_2026-05-06', title: '冥想 10 分钟', completed: false, habitId: 'h1' }),
      task({ id: 'h2_2026-05-06', title: '跳绳 10 分钟', completed: true, habitId: 'h2' }),
    ];
    const names = getIncompleteTaskNames(tasks, D);
    expect(names).toEqual(['冥想 10 分钟']);
  });

  it('全部完成时返回空数组', () => {
    const tasks: Task[] = [
      task({ id: 'h1_2026-05-06', title: 'a', completed: true, habitId: 'h1' }),
      task({ id: 'h2_2026-05-06', title: 'b', completed: true, habitId: 'h2' }),
    ];
    expect(getIncompleteTaskNames(tasks, D)).toEqual([]);
  });

  it('忽略其他日期的 task', () => {
    const tasks: Task[] = [
      task({ id: 'h1_2026-05-05', title: '昨天', completed: false, habitId: 'h1', date: '2026-05-05' }),
      task({ id: 'h2_2026-05-06', title: '今天', completed: false, habitId: 'h2' }),
    ];
    expect(getIncompleteTaskNames(tasks, D)).toEqual(['今天']);
  });

  it('同 habitId 出现重复 task 时按确定性 ID 去重，保留 {habitId}_{date} 格式那条', () => {
    const tasks: Task[] = [
      task({ id: 'random-uuid', title: '冥想（旧）', completed: true, habitId: 'h1' }),
      task({ id: 'h1_2026-05-06', title: '冥想（新）', completed: false, habitId: 'h1' }),
    ];
    const names = getIncompleteTaskNames(tasks, D);
    expect(names).toEqual(['冥想（新）']);
  });

  it('排除没有 habitId 的脏数据 task', () => {
    const tasks: Task[] = [
      task({ id: 'orphan', title: '孤儿任务', completed: false, habitId: undefined }),
      task({ id: 'h1_2026-05-06', title: '正常', completed: false, habitId: 'h1' }),
    ];
    expect(getIncompleteTaskNames(tasks, D)).toEqual(['正常']);
  });
});

describe('formatNotificationBody', () => {
  it('1-3 项时直接拼接', () => {
    expect(formatNotificationBody(['冥想'])).toBe('冥想');
    expect(formatNotificationBody(['冥想', '跳绳'])).toBe('冥想、跳绳');
    expect(formatNotificationBody(['a', 'b', 'c'])).toBe('a、b、c');
  });

  it('超过 3 项时显示前 3 项 + 总数', () => {
    expect(formatNotificationBody(['a', 'b', 'c', 'd', 'e'])).toBe('a、b、c 等 5 项未完成');
  });
});
