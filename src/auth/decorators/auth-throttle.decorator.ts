import { SetMetadata } from '@nestjs/common';

/** Marks a route as auth-sensitive so the named `auth` throttler applies. */
export const AUTH_THROTTLE_KEY = 'authThrottle';

/**
 * Apply the GlobalConfig / RuntimeConfig-backed `auth` rate limit
 * (`THROTTLE_AUTH_TTL` / `THROTTLE_AUTH_LIMIT`).
 */
export const AuthThrottle = () => SetMetadata(AUTH_THROTTLE_KEY, true);
