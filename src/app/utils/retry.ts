export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  shouldRetry?: (err: unknown, attempt: number) => boolean;
}

/**
 * Runs `fn`, retrying with exponential backoff on failure. `shouldRetry` lets the
 * caller opt out of retrying errors that are pointless to retry (bad input,
 * intentional cancellation, etc). Defaults to always retrying up to `retries` times.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { retries = 2, baseDelayMs = 500, shouldRetry } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const canRetry = attempt < retries && (!shouldRetry || shouldRetry(err, attempt));
      if (!canRetry) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise((res) => setTimeout(res, delay));
    }
  }

  throw lastError;
}
