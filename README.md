# SaaS NestJS Enterprise API

Multi-tenant SaaS backend built with **NestJS (Fastify)**, **Prisma**, and **PostgreSQL**. It ships production-ready auth (JWT + MFA + OAuth), RBAC, tenant management, billing, media uploads, feature flags, audit logging, and runtime configuration.

API base path: `/api/v1`  
Interactive docs (non-production): `/docs`

## Features

### Authentication & identity
- Multi-step registration (email OTP → password setup)
- Login with JWT access + refresh tokens
- Refresh token rotation (RTR) with family revocation
- Google & GitHub OAuth SSO (CSRF `state` protection)
- Forgot / reset password OTP flows
- Change password with global session invalidation
- Tenant switch for multi-org users

### Multi-factor authentication (MFA)
- TOTP authenticator apps (Google Authenticator, Authy, etc.)
- Backup codes (single-use)
- Email recovery flow to disable MFA
- Device verification for unknown devices/IPs
- TOTP replay protection within the drift window

### Multi-tenancy & access control
- Tenants, invitations, and memberships
- Roles & permissions with permission groups
- Decorators: `@Roles(...)`, `@Permissions(...)`, `@Public()`, `@AuthThrottle()`
- Soft-delete with emailed restoration token; restore via `POST /tenants/restore`

### Platform modules
- **Billing** — plans, subscriptions, invoices, PDF generation
- **Media** — MinIO object storage uploads & presigned download URLs
- **Feature flags** — per-tenant overrides
- **Limits** — API usage interceptor + plan limit violation tracking
- **Audit** — request/action audit trail
- **Global / runtime config** — DB-backed settings with env fallbacks
- **Mail** — transactional email (Nodemailer)
- **Health** — Terminus checks at `GET /api/v1/health`
- **Throttling** — named `short` / `long` / `auth` rate limits via `@nestjs/throttler` (auth limits from GlobalConfig)

## Tech stack

| Layer        | Choice                                      |
| ------------ | ------------------------------------------- |
| Runtime      | Node.js ≥ 20, pnpm ≥ 9                      |
| Framework    | NestJS 11 + Fastify                         |
| Database     | PostgreSQL + Prisma ORM                     |
| Auth         | Custom JWT / bcrypt (no Passport)           |
| MFA          | otplib + QR codes                           |
| Storage      | MinIO                                       |
| Docs         | Swagger / OpenAPI at `/docs`                |
| Logging      | Pino (`nestjs-pino`)                        |
| Tooling      | ESLint, Prettier, Husky, Commitlint, Jest   |

## Project structure

```
src/
  core/            # Auth guards, throttling, AuthMiddleware
  auth/            # Registration, login, OAuth, sessions
  mfa/             # TOTP, backup codes, recovery, device verify
  users/           # User CRUD & profile (+ repository, response DTOs)
  tenants/         # Tenant lifecycle + restore (+ repository, response DTOs)
  tenant-members/  # Invites & memberships
  roles/           # Roles & role–user / role–permission links
  permissions/     # Permissions & permission groups
  billing/         # Plans, subscriptions, invoices
  media/           # Object storage via StorageProvider (MinIO default)
  feature-flags/   # Tenant feature flag overrides
  limits/          # Plan limits + API usage interceptor
  audit/           # Audit log API
  global-config/   # Global key/value config
  config/          # Env + runtime config
  mail/            # MailService facade over MailProvider (Nodemailer default)
  logger/          # Pino logger module
  common/          # Response envelope, filters, pagination, serialization
  prisma/          # Prisma service
prisma/
  schema.prisma
  migrations/
  seed.ts
postman/           # Postman collection for API flows
```

Feature modules expose public surfaces via `index.ts` barrels. API responses for users, tenants, roles, and media are mapped through response DTOs (`@Exclude()` for secrets such as `restorationToken` / `passwordHash`).

## Prerequisites

- Node.js **≥ 20**
- pnpm **≥ 9**
- PostgreSQL **≥ 14** (recommended)
- MinIO (required in production for media; local defaults allowed in development)
- SMTP credentials (or mock values for local mail)

## Getting started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

Copy [`.env.example`](.env.example) to `.env` or `.env.development.local` (both are loaded; do not commit secrets).

```bash
cp .env.example .env.development.local
```

**Required** (validated at startup — fail fast):

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/DB_NAME?schema=public"
JWT_SECRET="change-me-at-least-32-random-characters"
JWT_REFRESH_SECRET="change-me-different-32-char-secret"
MFA_ENCRYPTION_KEY="d3b07384d113edec49eaa6238ad5ff00b178e5d2900ee61f9d4d38c641ef65b9"
```

- `JWT_SECRET` and `JWT_REFRESH_SECRET` must each be **at least 32 characters**
- `MFA_ENCRYPTION_KEY` must be a **64-character hex** string (32 bytes)

**Recommended / optional** — see `.env.example` for `PORT`, CORS, mail, OAuth, MinIO, and throttle overrides (`THROTTLE_AUTH_TTL`, `THROTTLE_AUTH_LIMIT`, etc.).

### 3. Database setup

Stop the Nest process before `prisma generate` on Windows to avoid file locks (`EPERM`).

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

Useful Prisma scripts:

| Script                | Description                |
| --------------------- | -------------------------- |
| `pnpm db:generate`    | Generate Prisma Client     |
| `pnpm db:migrate`     | Run migrations (dev)       |
| `pnpm db:migrate:prod`| Deploy migrations (prod)   |
| `pnpm db:push`        | Push schema without migrate|
| `pnpm db:studio`      | Open Prisma Studio         |
| `pnpm db:seed`        | Seed roles, users, config  |
| `pnpm db:validate`    | Validate schema            |

### 4. Run the API

```bash
# watch mode (recommended for development)
pnpm start:dev

# one-shot
pnpm start

# production (after build)
pnpm build
pnpm start:prod
```

Default listen address: `0.0.0.0` on `PORT` (default **5000**).

| Resource        | URL                                      |
| --------------- | ---------------------------------------- |
| API root        | `http://localhost:5000/api/v1`           |
| Health check    | `http://localhost:5000/api/v1/health`    |
| Swagger UI      | `http://localhost:5000/docs`             |

Swagger is disabled when `NODE_ENV=production`.

## API overview

All routes are versioned under `/api/v1`.

| Area            | Prefix / examples                                              |
| --------------- | -------------------------------------------------------------- |
| Auth            | `/auth/register/*`, `/auth/login`, `/auth/refresh`, `/auth/oauth/*` |
| MFA             | `/mfa/setup`, `/mfa/verify-login`, `/mfa/recover`              |
| Users           | `/users`, `/users/me/profile`                                  |
| Tenants         | `/tenants`, `POST /tenants/restore`                            |
| Members         | `/tenants/:tenantId/members`, `/auth/invitations/accept`       |
| Roles           | `/roles`                                                       |
| Permissions     | `/permissions`, `/permissions/groups`                          |
| Billing         | `/billing/plans`, `/tenants/:tenantId/billing/*`               |
| Media           | `/tenants/:tenantId/media/upload`                              |
| Feature flags   | `/tenants/:tenantId/feature-flags`                             |
| Audit           | `/audit`                                                       |
| Global config   | `/global-config`                                               |

Authenticated routes expect:

```http
Authorization: Bearer <access_token>
```

## Testing with Postman

Import the collection under:

```
postman/collections/SaaS Enterprise Auth, MFA Roles and Permissions API/
```

It covers registration, login, MFA, roles/permissions, and related flows, with scripts that capture JWTs and MFA pending tokens.

You can also use Swagger at `/docs` for interactive exploration.

## Scripts

| Command            | Description                          |
| ------------------ | ------------------------------------ |
| `pnpm start:dev`   | Dev server with watch                |
| `pnpm build`       | Compile to `dist/`                   |
| `pnpm start:prod`  | Run compiled app                     |
| `pnpm lint`        | ESLint + fix                         |
| `pnpm format`      | Prettier                             |
| `pnpm test`        | Unit tests (Jest)                    |
| `pnpm test:e2e`    | End-to-end tests                     |
| `pnpm test:cov`    | Coverage report                      |
| `pnpm commit`      | Commitizen conventional commit       |

## Security notes

- Refresh tokens use rotation; reuse of an old refresh token can revoke the family.
- Password changes stamp `passwordChangedAt` and invalidate prior sessions.
- MFA recovery tokens are segregated from password-reset tokens.
- OAuth login validates `state` against CSRF (timing-safe comparison).
- Access/refresh JWTs carry a `purpose` claim; missing/wrong purpose is rejected.
- Helmet, compression, CORS allowlist, validation whitelist, and rate limiting are enabled globally.
- Auth-sensitive routes use `@AuthThrottle()` backed by GlobalConfig (`THROTTLE_AUTH_*`).
- Never commit `.env`, OTPs, recovery links, refresh tokens, or seed passwords.

## License

Private / `UNLICENSED` — not published as an open-source package.
