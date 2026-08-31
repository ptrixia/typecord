# Typecord — Security Audit / Production Hardening

Date: 2026-08-26

This package contains the hardened source tree produced from the supplied Typecord project. The changes focus on authentication, authorization, data exposure, realtime access control, storage security, and the Developer Portal.

## Critical / high-severity issues addressed

### Developer Portal information disclosure
- `/developers` is authenticated in its server layout before client UI is rendered.
- API documentation is an explicit allowlist. It documents only the intended Bot API/Gateway surface.
- Private session APIs, DM APIs, user APIs, upload/storage APIs, LiveKit internals, realtime internals, admin endpoints and legacy endpoints are not serialized into the Developer Page bundle.

### Bot authentication and token lifecycle
- Bot tokens are stored as hashes rather than plaintext.
- Token regeneration is checked against `ownerId`, not the bot user's `userId`.
- Gateway sessions are temporary, hashed, expire, and can be revoked.
- Desktop app PIN hashes are kept in the platform keychain and never persisted in browser storage.
- Regenerating a bot token revokes existing gateway sessions.
- Bot API operations are rate limited and scoped to the authenticated bot.

### Channel authorization / PermissionOverwrite
- Effective permissions are centralized in `src/lib/channel-permissions.ts`.
- Channel access evaluates the guild owner/admin path, @everyone permissions, member roles, role overwrites and member overwrites in the expected precedence.
- HTTP message access, Gateway channel subscriptions, LiveKit access, and bot event fanout use effective channel permissions rather than only checking guild membership.
- Bot MESSAGE_* broadcasts are filtered so bots without `VIEW_CHANNEL` do not receive channel events.

### Sensitive data exposure
- Message/history handlers use explicit Prisma `select` shapes instead of returning broad `User` records.
- Password hashes and other authentication-only fields are not intentionally serialized from those hardened handlers.
- Error responses return generic production-safe messages while detailed failures remain server-side logs.

### File upload / S3 / stored XSS
- Storage configuration is centralized in `src/lib/storage.ts`.
- `S3_ACCESS_KEY` / `S3_SECRET_KEY` are the canonical names; legacy AWS-style aliases are accepted for compatibility.
- Object keys are validated and user uploads are namespaced by user ID.
- File reads require an authenticated user and authorization to the referenced DM/guild content or ownership of the upload.
- HTML, XHTML, XML, SVG and JavaScript are never served inline.
- File responses include `X-Content-Type-Options: nosniff`, restrictive CSP and same-origin resource policy.
- Upload MIME/size checks and object-existence checks were strengthened.

### Legacy unauthenticated realtime/webhook surfaces
- Legacy Pusher-based `/api/typing` and `/api/gateway/auth` return `410 Gone`.
- The old unsigned generic channel webhook route returns `410 Gone` until a per-webhook secret design is implemented.
- The generic legacy LiveKit endpoint is disabled; the scoped token endpoint remains.
- Pusher client/server dependencies and source references were removed from the hardened tree.

### LiveKit webhook
- LiveKit webhook processing verifies the provider signature using `WebhookReceiver`.
- Webhook event IDs are deduplicated in Redis.

### Public guild discovery
- Guilds are private by default through the new `Guild.discoverable` field.
- Discover/join only returns or joins guilds explicitly marked discoverable.
- A Prisma migration is included under `prisma/migrations/20260826150000_security_hardening`.

### Registration / request abuse
- Registration uses runtime Zod validation, normalized email, generic duplicate response, bcrypt cost 12 and rate limiting.
- Password minimum was raised to 10 characters (maximum 128).
- Same-origin validation is used on sensitive browser mutations.
- Middleware adds an additional cross-site mutation guard for session-based API routes.

### Build hardening
- `typescript.ignoreBuildErrors` is not enabled.
- `poweredByHeader` is disabled.
- Production security headers include HSTS, nosniff, anti-framing, referrer policy, permissions policy and a baseline CSP.
- Real secrets are not included; only `.env.example` is packaged.

## Medium / operational notes

- Keep Redis, PostgreSQL, MinIO/S3 and LiveKit on private networks where possible.
- Terminate TLS at a trusted reverse proxy and use HTTPS/WSS in production.
- Set `NEXTAUTH_SECRET` and `REALTIME_JWT_SECRET` to independent cryptographically random values of at least 32 bytes.
- Restrict `GATEWAY_ALLOWED_ORIGINS` to actual production origins.
- Restrict the public Giphy key at the provider.
- Do not expose MinIO/S3 administrative interfaces publicly.
- Use database backups and Redis persistence appropriate to your deployment.
- Add dependency scanning, SAST and integration tests to CI.

## Validation performed on this package

- Compared against the user-supplied `typecord(2).zip` source tree.
- Parsed all TypeScript/TSX source files with the TypeScript compiler parser: **0 syntax errors**.
- Checked the Developer Page source for documented private-route strings: none found.
- Checked source/package files for legacy `pusher` references: none found.
- Checked for `ignoreBuildErrors`: none found.
- Scanned the tree for common committed-secret patterns and Discord webhook URLs: none found.
- Removed incremental compiler cache/build artifacts from the package.

## Validation limitation

The supplied archive does not contain `node_modules` or a dependency lockfile. A full `next build` / Prisma-generated-client typecheck could not be completed offline from the archive alone. Run the steps in `PRODUCTION_README.md` after installing dependencies. Security is also an operational property; no source review can truthfully guarantee "100% secure" without deployment, dependency, infrastructure and penetration testing.
