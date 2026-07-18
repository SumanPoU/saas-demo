import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const inputValidConfig: Record<string, unknown> = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    JWT_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
    MFA_ENCRYPTION_KEY:
      'd3b07384d113edec49eaa6238ad5ff00b178e5d2900ee61f9d4d38c641ef65b9',
  };

  it('returns the config when all required security vars are valid', () => {
    const actualConfig = validateEnv(inputValidConfig);
    expect(actualConfig).toBe(inputValidConfig);
  });

  it('rejects missing MFA_ENCRYPTION_KEY', () => {
    const { MFA_ENCRYPTION_KEY: _removed, ...inputWithoutMfa } =
      inputValidConfig;

    expect(() => validateEnv(inputWithoutMfa)).toThrow(
      /Missing required environment variable\(s\): MFA_ENCRYPTION_KEY/,
    );
  });

  it('rejects MFA_ENCRYPTION_KEY that is not 64 hex characters', () => {
    expect(() =>
      validateEnv({
        ...inputValidConfig,
        MFA_ENCRYPTION_KEY: 'not-a-valid-key',
      }),
    ).toThrow(/MFA_ENCRYPTION_KEY must be a 64-character hex string/);
  });

  it('rejects JWT secrets shorter than 32 characters', () => {
    expect(() =>
      validateEnv({
        ...inputValidConfig,
        JWT_SECRET: 'too-short',
      }),
    ).toThrow(/JWT_SECRET must be at least 32 characters long/);
  });
});
