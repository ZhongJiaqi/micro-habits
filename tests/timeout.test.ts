import { describe, it, expect, vi, afterEach } from 'vitest';
import { withTimeout } from '../src/lib/timeout';

describe('withTimeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves when underlying promise resolves before timeout', async () => {
    const result = await withTimeout(Promise.resolve(42), 100, '测试步骤');
    expect(result).toBe(42);
  });

  it('forwards the original error when underlying promise rejects', async () => {
    await expect(
      withTimeout(Promise.reject(new Error('原始错误')), 100, '测试步骤'),
    ).rejects.toThrow('原始错误');
  });

  it('rejects with a timeout error when underlying promise hangs', async () => {
    vi.useFakeTimers();
    // 永不 settle 的 promise 模拟挂起的 serviceWorker.ready / pushManager.subscribe
    const hang = new Promise(() => {});
    const racing = withTimeout(hang, 1000, '订阅推送服务');
    // 提前挂上 expect 监听，避免 reject 落在没有 handler 的 microtask 里产生 unhandledRejection
    const assertion = expect(racing).rejects.toThrow(/订阅推送服务超时/);

    // 让定时器跨过超时阈值
    await vi.advanceTimersByTimeAsync(1001);
    await assertion;
  });

  it('does not reject if underlying promise settles after timeout duration but timer is cleared', async () => {
    vi.useFakeTimers();
    const promise = Promise.resolve('done');
    const result = await withTimeout(promise, 1000, '步骤');
    expect(result).toBe('done');
    // 推进时间，确认 timer 已被清理（不会再有 unhandled rejection）
    await vi.advanceTimersByTimeAsync(2000);
  });
});
