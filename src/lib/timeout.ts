/**
 * 给一个 Promise 加上超时限制。
 * 超时时以包含 label 的中文错误消息 reject，便于在 UI 上展示具体卡在哪一步。
 *
 * 设计要点：
 * - 不取消底层 promise（浏览器 push/subscribe API 无 AbortController），
 *   只是不再等待它，避免 UI 永远卡死。
 * - 即便底层 promise 之后 settle，clearTimeout 已避免误触发。
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label}超时（${Math.round(ms / 1000)}s）`));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
