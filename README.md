# SaaS Authentication & MFA Boilerplate (NestJS)

A highly secure, robust, and production-ready authentication backend built with **NestJS (Fastify)**, **Prisma ORM**, and **PostgreSQL**. 

This system provides a complete, hardened foundation for any modern SaaS application requiring comprehensive identity management, Multi-Factor Authentication (MFA), and Role-Based Access Control (RBAC).

## 🚀 Core Features

### Authentication & Identity
- **Multi-Step Registration:** Email OTP initiation followed by password setup.
- **Robust Login Flow:** Secure login with JWT Access & Refresh Token generation.
- **Refresh Token Rotation (RTR):** Strict token rotation and family revocation to prevent replay attacks.
- **OAuth 2.0 SSO:** Seamless integration for Google and GitHub logins with built-in CSRF (`state`) protection.
- **Password Management:** Secure "Forgot Password" OTP flow and authenticated "Change Password" flows that instantly revoke older sessions.

### Multi-Factor Authentication (MFA)
- **TOTP Authenticator Apps:** Full support for apps like Google Authenticator and Authy.
- **Backup Codes:** Generates 8 cryptographically secure, single-use backup codes (~40 bits entropy).
- **Recovery Link Flow:** Fallback email-based account recovery to disable MFA in emergencies (segregated from password resets).
- **Hardened Replay Protection:** In-memory caching blocks TOTP code reuse within the 90-second drift window.

### Advanced Security
- **Device Verification:** Unknown devices/IPs trigger an email verification gate using strictly scoped `purpose: 'device_verify'` tokens.
- **Global Token Invalidation:** Changing a password automatically invalidates all previous sessions and refresh token families.
- **Granular RBAC:** Protect routes easily using `@Roles('admin')` and `@Permissions('read:users')` decorators (which enforce strict AND/OR logic).
- **Hardened Middleware & Guards:** Protects against `mfa_pending` token bypasses and enforces strict `sessionId` presence.

## 🛠 Tech Stack

- **Framework:** [NestJS](https://nestjs.com/) (Fastify adapter for high performance)
- **Database:** [PostgreSQL](https://www.postgresql.org/)
- **ORM:** [Prisma](https://www.prisma.io/)
- **Authentication:** Custom JWT/Bcrypt Implementation (No Passport.js overhead)
- **Language:** TypeScript

## 📦 Project Setup

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Environment Variables
Create a `.env` or `.env.development.local` file in the root directory and configure your PostgreSQL database connection, JWT secrets, and OAuth credentials:
```env
# Example .env configuration
DATABASE_URL="postgresql://user:password@localhost:5432/saas_db?schema=public"
JWT_SECRET="your-super-secret-jwt-key"
```

### 3. Database Migration & Prisma Client
Ensure your local development server is stopped before generating the Prisma client to prevent file lock (`EPERM`) errors.
```bash
npx prisma generate
npx prisma migrate dev
```

## 💻 Running the Application

```bash
# development
$ pnpm run start

# watch mode (recommended)
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## 🧪 Testing the API

The project includes a comprehensive Postman collection:
1. Navigate to the `postman/collections/` directory.
2. Import `saas_auth_mfa.postman_collection.json` into Postman.
3. The collection is pre-configured with environment variables and automation scripts that automatically capture JWTs and `mfaPendingTokens` to make testing the login/MFA flows effortless.

## 🔒 Security Posture

This boilerplate was recently subjected to a **17-point security hardening process**, which included:
- Enforcing `isUsed: true` on all one-time token verifications.
- Stamping `passwordChangedAt` timestamps to proactively reject any tokens minted before a password reset.
- Introducing a completely dedicated `MfaRecoveryToken` table to segregate MFA recovery tokens from password reset tokens.
- Implementing robust OAuth `state` CSRF validations.
- Safely handling missing tokens and session errors in public route middleware using NestJS `Logger`.

## License

This project is [MIT licensed](LICENSE).
