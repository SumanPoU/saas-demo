/** Stricter rate limits for auth-sensitive public endpoints (overrides named "short" throttler). */
export const AUTH_SENSITIVE_THROTTLE = {
  short: { limit: 5, ttl: 60_000 },
} as const;
