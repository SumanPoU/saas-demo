# AGENTS.md

## Project Overview
Multi-tenant SaaS backend providing authentication, MFA, RBAC, tenant management,
billing, media uploads, feature flags, and audit logging. Built as the identity
and platform API consumed by other services/frontends.

## Tech Stack
- Runtime: Node.js ≥ 20, pnpm ≥ 9
- Framework: NestJS 11 (Fastify adapter — not Express)
- Database: PostgreSQL + Prisma ORM
- Auth: Custom JWT/bcrypt (access + refresh tokens), no Passport.js
- MFA: TOTP (otplib) + backup codes + email recovery
- OAuth: Google, GitHub (state-based CSRF protection)
- Storage: MinIO (media module)
- Logging: Pino (`nestjs-pino`)
- Docs: Swagger/OpenAPI at `/docs` (non-production only)
- Testing: Jest (unit + e2e)

## Project Structure
```
src/
  auth/            # Registration, login, OAuth, sessions
  mfa/             # TOTP, backup codes, recovery, device verify
  users/           # User CRUD & profile
  tenants/         # Tenant lifecycle
  tenant-members/  # Invites & memberships
  roles/           # Roles & role–user / role–permission links
  permissions/     # Permissions & permission groups
  billing/         # Plans, subscriptions, invoices
  media/           # MinIO uploads
  feature-flags/   # Tenant feature flag overrides
  limits/          # Plan limit enforcement
  audit/           # Audit log API
  global-config/   # Global key/value config
  config/          # Env + runtime config
  mail/            # Email delivery
  logger/          # Pino logger module
  common/          # Response envelope, filters, pagination
  prisma/          # Prisma service
prisma/
  schema.prisma
  migrations/
  seed.ts
postman/           # Postman collection for manual API testing
```

## Setup Commands
```bash
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm start:dev
```
- API root: `http://localhost:5000/api/v1`
- Health check: `http://localhost:5000/api/v1/health`
- Swagger UI: `http://localhost:5000/docs` (disabled in production)

## Environment Variables
Required (must be set, no fallback):
```env
DATABASE_URL=
JWT_SECRET=            # ≥ 32 characters
JWT_REFRESH_SECRET=    # ≥ 32 characters, different from JWT_SECRET
```
Recommended:
```env
PORT=5000
NODE_ENV=development
ALLOWED_ORIGINS=
SEED_SUPERADMIN_PASSWORD=
SEED_USER_PASSWORD=
MAIL_USER=
MAIL_PASS=
MFA_ENCRYPTION_KEY=    # 64 hex chars / 32 bytes
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=
MINIO_ENDPOINT=
MINIO_PORT=
MINIO_ACCESS_KEY=
MINIO_SECRET_KEY=
MINIO_USE_SSL=
MINIO_BUCKET_NAME=
```
Any new required env var must be added to `.env.example` and validated at startup
(fail fast — never silently fall back to a default for a security-sensitive value).

## Core Principles the Agent Must Follow
1. **SOLID**
   - Single Responsibility: one job per class (controller routes, service holds logic, repository/Prisma service handles persistence).
   - Open/Closed: extend behavior via new guards/interceptors/strategies rather than adding conditional branches to existing shared code (e.g. don't patch the global auth guard with tenant-specific `if` checks — write a composable guard).
   - Liskov Substitution: interchangeable providers (mail, storage, OAuth strategy) must honor the same interface so one implementation can replace another without breaking callers.
   - Interface Segregation: modules export only what their consumers need; don't force consumers to depend on a module's full internal surface.
   - Dependency Inversion: depend on abstractions for swappable providers (storage, mail, OAuth) — inject via constructor, never instantiate manually.
2. **Layered architecture** — Controller → Service → Repository/Prisma. Controllers never touch Prisma directly; services never touch `Req`/`Res`.
3. **Security-first by default** — fail closed on ambiguous auth/permission checks. Every one-time token (OTP, reset, invite, MFA recovery) has a narrow `purpose` claim and is invalidated atomically, in the same transaction as its use.
4. **Multi-tenant isolation** — no cross-tenant data access, ever, even via a shared-guard oversight. Every tenant-scoped query filters by `tenantId` explicitly; never rely solely on route-level guards.
5. **DTOs everywhere** — never return raw Prisma entities from an endpoint. Sensitive fields (password hashes, MFA secrets, tokens) are excluded at the DTO layer (`@Exclude()`), not by manual deletion in controllers.

## Coding Standards
- TypeScript strict mode for all new code — no implicit `any`, fully typed function signatures and return types
- Relative imports within a feature folder; barrel (`index.ts`) exports for a module's public surface
- Async/await only — no raw `.then()` chains
- Errors are typed NestJS `HttpException` subclasses — never thrown strings/plain objects
- All new routes versioned under `/api/v1` and returned via the project's standard response envelope (`common/`)

## Package Management
- Always use `pnpm add <pkg>` for runtime dependencies and `pnpm add -D <pkg>` for dev/build/test tooling
- Never use npm or yarn commands or lockfiles
- Check `common/`, `config/`, and existing modules for existing capability before adding a new package

## Database (Prisma)
- Schema changes go through `pnpm db:generate` → `pnpm db:migrate` (dev) — never hand-edit the database or use `db push` outside prototyping
- Stop the running Nest process before `prisma generate` locally (Windows `EPERM` file-lock issue)
- Soft-delete pattern (`deletedAt`/`isActive`) for tenants and any record needing restoration — never hard-delete tenant-owned data
- Every multi-tenant model has a non-optional `tenantId` foreign key, indexed
- Multi-step writes that must be atomic use `$transaction` (e.g. user creation + role assignment, subscription + invoice)
- Never expose raw Prisma error messages in API responses — catch and map to safe, generic errors

## Authentication & MFA Rules
- Access and refresh tokens signed with separate secrets; refresh token rotation (RTR) is enforced — reuse of a rotated token revokes the whole token family
- Every issued token carries an explicit `purpose` claim (`mfa_pending`, `device_verify`, `password_reset`, etc.); guards reject tokens used outside their intended purpose
- Password changes stamp `passwordChangedAt`; any token issued earlier is rejected even if not expired
- Guards must explicitly reject requests missing `sessionId` rather than treating it as optional
- TOTP secrets encrypted at rest (`MFA_ENCRYPTION_KEY`); backup codes are single-use and marked `isUsed: true` in the same transaction as redemption
- MFA recovery tokens are fully segregated (separate table) from password-reset tokens
- OAuth callbacks validate `state` to prevent CSRF; never log OAuth tokens or authorization codes
- Login never reveals whether an email exists vs. password was wrong (no user enumeration)
- Auth-sensitive endpoints (login, OTP request, password reset) are rate-limited via `@nestjs/throttler`

## Commands the Agent Should Use
| Task | Command |
|---|---|
| Install deps | `pnpm add <pkg>` / `pnpm add -D <pkg>` |
| Generate Prisma client | `pnpm db:generate` |
| Run migration (dev) | `pnpm db:migrate` |
| Deploy migration (prod) | `pnpm db:migrate:prod` |
| Seed database | `pnpm db:seed` |
| Dev server | `pnpm start:dev` |
| Build | `pnpm build` |
| Production run | `pnpm start:prod` |
| Lint | `pnpm lint` |
| Format | `pnpm format` |
| Unit tests | `pnpm test` |
| E2E tests | `pnpm test:e2e` |
| Coverage | `pnpm test:cov` |
| Commit | `pnpm commit` (Commitizen conventional commits) |

## Testing Expectations
- Any new business logic in `auth/`, `mfa/`, `roles/`, `permissions/`, or `tenants/` requires unit tests (Nest's `Test.createTestingModule` with mocked Prisma/repository dependencies)
- Cover both the success path and realistic failure paths: expired token, reused/rotated refresh token, wrong tenant, insufficient permission
- Critical flows (register → login → refresh → logout, invite → accept) require e2e coverage
- Run `pnpm lint` and `pnpm format` before considering any change complete

## Things the Agent Must Never Do
- Never commit `.env*`, seed passwords, OTPs, recovery links, or refresh tokens
- Never hardcode secrets — always read via the validated config service
- Never bypass tenant scoping "for convenience" in any query or service method
- Never introduce Passport.js, TypeORM, or Express-specific middleware into this Fastify/NestJS/Prisma stack
- Never store or log MFA secrets, OAuth tokens, or authorization codes in plaintext
- Never return raw Prisma entities directly from a controller/endpoint

## Where to Look Before Adding Something New
- Response shape / pagination → `src/common/`
- Config & env validation → `src/config/`
- Token issuance / guards / strategies → `src/auth/`, `src/mfa/`
- Tenant scoping patterns → `src/tenants/`, `src/tenant-members/`
- Logging → `src/logger/`

## API Reference (current)
| Area | Prefix / examples |
|---|---|
| Auth | `/auth/register/*`, `/auth/login`, `/auth/refresh`, `/auth/oauth/*` |
| MFA | `/mfa/setup`, `/mfa/verify-login`, `/mfa/recover` |
| Users | `/users`, `/users/me/profile` |
| Tenants | `/tenants` |
| Members | `/tenants/:tenantId/members`, `/auth/invitations/accept` |
| Roles | `/roles` |
| Permissions | `/permissions`, `/permissions/groups` |
| Billing | `/billing/plans`, `/tenants/:tenantId/billing/*` |
| Media | `/tenants/:tenantId/media/upload` |
| Feature flags | `/tenants/:tenantId/feature-flags` |
| Audit | `/audit` |
| Global config | `/global-config` |

All authenticated routes expect: `Authorization: Bearer <access_token>`