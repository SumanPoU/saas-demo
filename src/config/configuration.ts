export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  node_env: process.env.NODE_ENV ?? 'development',

  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? [
      'http://localhost:4200',
    ],
  },

  database: {
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    name: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },

  mail: {
    host: process.env.MAIL_HOST ?? 'localhost',
    port: parseInt(process.env.MAIL_PORT ?? '2525', 10),
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
    from: process.env.MAIL_FROM ?? '"SaaS Demo" <noreply@demo.com>',
  },

  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackUrl: process.env.GOOGLE_CALLBACK_URL,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackUrl: process.env.GITHUB_CALLBACK_URL,
    },
  },

  throttle: {
    short: {
      ttl: parseInt(process.env.THROTTLE_SHORT_TTL ?? '1000', 10),
      limit: parseInt(process.env.THROTTLE_SHORT_LIMIT ?? '10', 10),
    },
    long: {
      ttl: parseInt(process.env.THROTTLE_LONG_TTL ?? '60000', 10),
      limit: parseInt(process.env.THROTTLE_LONG_LIMIT ?? '100', 10),
    },
  },

  mfa: {
    encryptionKey: process.env.MFA_ENCRYPTION_KEY,
    pendingTokenExpiry: process.env.MFA_PENDING_TOKEN_EXPIRY ?? '5m',
  },
  appName: process.env.APP_NAME ?? 'SaaS_Enterprise_Demo',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
});
