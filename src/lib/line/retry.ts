// ============================================================================
// src/lib/line/retry.ts
// リトライロジック — 指数バックオフ付き共通ユーティリティ
// ============================================================================

export interface RetryOptions {
  maxRetries: number;
  delayMs: number;
  retryableStatuses?: readonly number[];
  onRetry?: (attempt: number, error: Error) => void;
}

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly responseBody?: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const { maxRetries, delayMs, retryableStatuses, onRetry } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLastAttempt = attempt === maxRetries;

      // retryableStatuses が指定されている場合、該当するステータスのみリトライ
      if (retryableStatuses && error instanceof HttpError) {
        if (!retryableStatuses.includes(error.status)) {
          throw error; // リトライ対象外のステータス
        }
      }

      if (isLastAttempt) {
        throw error;
      }

      const waitMs = delayMs * (attempt + 1); // 指数バックオフ
      console.log(
        `[retry] Attempt ${attempt + 1}/${maxRetries} failed, retrying in ${waitMs}ms...`,
        error instanceof Error ? error.message : String(error),
      );
      onRetry?.(attempt + 1, error instanceof Error ? error : new Error(String(error)));
      await sleep(waitMs);
    }
  }

  throw new Error('withRetry: unreachable');
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * fetch をラップし、非 OK レスポンスを HttpError として throw する
 */
export async function fetchWithHttpError(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = await response.text().catch(() => 'unknown');
    throw new HttpError(
      `HTTP ${response.status}: ${body.substring(0, 200)}`,
      response.status,
      body,
    );
  }
  return response;
}
