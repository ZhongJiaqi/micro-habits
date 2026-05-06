import { describe, it, expect, vi } from 'vitest';
import { signOutAndClearCache } from '../src/lib/auth';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

// 单独 mock firebase/auth 和 firebase/firestore 的导出函数。
// 这里测的是"顺序契约"——sign out 流程必须按 signOut → terminate → clearIndexedDbPersistence → reload
// 顺序执行，否则 IndexedDB 残留 / 死锁 / 上个用户数据泄漏。
vi.mock('firebase/auth', async () => {
  const actual = await vi.importActual<typeof import('firebase/auth')>('firebase/auth');
  return { ...actual, signOut: vi.fn(async () => {}) };
});
vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore');
  return {
    ...actual,
    terminate: vi.fn(async () => {}),
    clearIndexedDbPersistence: vi.fn(async () => {}),
  };
});

import { signOut } from 'firebase/auth';
import { terminate, clearIndexedDbPersistence } from 'firebase/firestore';

const fakeAuth = {} as Auth;
const fakeDb = {} as Firestore;

describe('signOutAndClearCache', () => {
  it('调用顺序：signOut → terminate → clearIndexedDbPersistence → reload', async () => {
    const calls: string[] = [];
    (signOut as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      calls.push('signOut');
    });
    (terminate as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      calls.push('terminate');
    });
    (clearIndexedDbPersistence as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      calls.push('clearIndexedDbPersistence');
    });
    const reload = vi.fn(() => {
      calls.push('reload');
    });

    await signOutAndClearCache(fakeAuth, fakeDb, reload);

    expect(calls).toEqual(['signOut', 'terminate', 'clearIndexedDbPersistence', 'reload']);
  });

  it('signOut 抛错时仍然 reload（兜底，避免按钮卡死或数据残留）', async () => {
    (signOut as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('网络挂了'));
    (terminate as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (clearIndexedDbPersistence as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const reload = vi.fn();

    await signOutAndClearCache(fakeAuth, fakeDb, reload);

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('clearIndexedDbPersistence 抛错（如有 listener 未释放）也仍然 reload', async () => {
    (signOut as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (terminate as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (clearIndexedDbPersistence as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Persistence cannot be cleared while there are open connections'),
    );
    const reload = vi.fn();

    await signOutAndClearCache(fakeAuth, fakeDb, reload);

    expect(reload).toHaveBeenCalledTimes(1);
  });
});
