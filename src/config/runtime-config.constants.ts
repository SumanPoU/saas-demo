export const LEGACY_RUNTIME_CONFIG_KEY = 'runtime_settings';

export const RUNTIME_CONFIG_DEFINITIONS = {
  bcrypt: {
    category: 'security',
    defaults: {
      saltRounds: 10,
    },
    env: {
      saltRounds: 'BCRYPT_SALT_ROUNDS',
    },
  },
  throttle: {
    category: 'security',
    defaults: {
      shortTtl: 1000,
      shortLimit: 10,
      longTtl: 60000,
      longLimit: 100,
    },
    env: {
      shortTtl: 'THROTTLE_SHORT_TTL',
      shortLimit: 'THROTTLE_SHORT_LIMIT',
      longTtl: 'THROTTLE_LONG_TTL',
      longLimit: 'THROTTLE_LONG_LIMIT',
    },
  },
  jwt: {
    category: 'auth',
    defaults: {
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d',
      mfaPendingTokenExpiry: '5m',
    },
    env: {
      accessTokenExpiry: 'JWT_EXPIRES_IN',
      refreshTokenExpiry: 'JWT_REFRESH_EXPIRES_IN',
      mfaPendingTokenExpiry: 'MFA_PENDING_TOKEN_EXPIRY',
    },
  },
  app: {
    category: 'system',
    defaults: {
      name: 'SaaS Enterprise Demo',
      frontendUrl: 'http://localhost:3000',
    },
    env: {
      name: 'APP_NAME',
      frontendUrl: 'FRONTEND_URL',
    },
  },
  mail: {
    category: 'mail',
    defaults: {
      from: '"SaaS Demo" <noreply@demo.com>',
      host: 'localhost',
      port: 2525,
    },
    env: {
      from: 'MAIL_FROM',
      host: 'MAIL_HOST',
      port: 'MAIL_PORT',
    },
  },
} as const;

export const LEGACY_RUNTIME_CONFIG_MAP = {
  BCRYPT_SALT_ROUNDS: { key: 'bcrypt', field: 'saltRounds' },
  THROTTLE_SHORT_TTL: { key: 'throttle', field: 'shortTtl' },
  THROTTLE_SHORT_LIMIT: { key: 'throttle', field: 'shortLimit' },
  THROTTLE_LONG_TTL: { key: 'throttle', field: 'longTtl' },
  THROTTLE_LONG_LIMIT: { key: 'throttle', field: 'longLimit' },
  JWT_EXPIRES_IN: { key: 'jwt', field: 'accessTokenExpiry' },
  JWT_REFRESH_EXPIRES_IN: { key: 'jwt', field: 'refreshTokenExpiry' },
  MFA_PENDING_TOKEN_EXPIRY: { key: 'jwt', field: 'mfaPendingTokenExpiry' },
  APP_NAME: { key: 'app', field: 'name' },
  FRONTEND_URL: { key: 'app', field: 'frontendUrl' },
  MAIL_FROM: { key: 'mail', field: 'from' },
  MAIL_HOST: { key: 'mail', field: 'host' },
  MAIL_PORT: { key: 'mail', field: 'port' },
} as const;

export type RuntimeConfigDomainKey = keyof typeof RUNTIME_CONFIG_DEFINITIONS;
export type LegacyRuntimeConfigKey = keyof typeof LEGACY_RUNTIME_CONFIG_MAP;
export type RuntimeConfigKey = LegacyRuntimeConfigKey;

export const RUNTIME_CONFIG_DOMAIN_KEYS = Object.keys(
  RUNTIME_CONFIG_DEFINITIONS,
) as RuntimeConfigDomainKey[];

export const LEGACY_RUNTIME_CONFIG_KEYS = Object.keys(
  LEGACY_RUNTIME_CONFIG_MAP,
) as LegacyRuntimeConfigKey[];
