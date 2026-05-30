const REQUIRED_ENV_KEYS = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];

export function validateEnv(config: Record<string, unknown>) {
  const missing = REQUIRED_ENV_KEYS.filter((key) => !config[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}`,
    );
  }

  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    const value = String(config[key] ?? '');
    if (value.length < 32) {
      throw new Error(`${key} must be at least 32 characters long`);
    }
  }

  return config;
}
