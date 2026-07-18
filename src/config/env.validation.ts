const REQUIRED_ENV_KEYS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'MFA_ENCRYPTION_KEY',
] as const;

const HEX_64 = /^[a-fA-F0-9]{64}$/;

export function validateEnv(config: Record<string, unknown>) {
  const missing = REQUIRED_ENV_KEYS.filter((key) => !config[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}`,
    );
  }

  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET'] as const) {
    const value = String(config[key] ?? '');
    if (value.length < 32) {
      throw new Error(`${key} must be at least 32 characters long`);
    }
  }

  const mfaKey = String(config.MFA_ENCRYPTION_KEY ?? '');
  if (!HEX_64.test(mfaKey)) {
    throw new Error(
      'MFA_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)',
    );
  }

  return config;
}
