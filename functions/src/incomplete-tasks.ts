/**
 * 推送提醒所需的"未完成任务名"纯函数。
 * 从 index.ts 抽出独立文件，无 firebase 依赖，便于单元测试。
 *
 * 历史背景：
 * 之前 Task 接口含 `type: 'habit' | 'one-time'` 字段，是"持续 vs 一次性"的区分。
 * 在 commit 1fcb28e 后该字段从前端 Task 接口删除（一次性任务功能已废弃，
 * 现在所有 task 都从 microHabit 派生）。Cloud Function 一直依赖 type 字段过滤，
 * 导致 5-04 起新创建的 task 被全部过滤掉，cron 误判"全部完成"。
 *
 * 修复：移除 type 过滤，所有有 habitId 的 task 都纳入未完成判断。
 * 习惯 vs 肯定语的区分由 microHabit.category 在前端处理，与推送提醒无关。
 */

export interface Task {
  id: string;
  title: string;
  date: string;
  completed: boolean;
  habitId?: string;
  userId: string;
}

/**
 * 取出指定日期的未完成 task 标题列表。
 * - 按 habitId 去重（保留确定性 ID `{habitId}_{date}` 格式那条，丢弃旧 random ID）
 * - 排除无 habitId 的脏数据
 */
export function getIncompleteTaskNames(tasks: Task[], date: string): string[] {
  const todayTasks = tasks.filter(t => t.date === date);

  const seenHabitIds = new Set<string>();
  const dedupedTasks = todayTasks
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

  return dedupedTasks.filter(t => !t.completed).map(t => t.title);
}

/**
 * 格式化推送 body：1-3 项直接拼接，>3 项显示前 3 + 总数。
 */
export function formatNotificationBody(names: string[]): string {
  if (names.length <= 3) {
    return names.join('、');
  }
  return `${names.slice(0, 3).join('、')} 等 ${names.length} 项未完成`;
}
