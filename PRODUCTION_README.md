# Typecord — Production setup

## 1. Install dependencies

Use one package manager consistently and commit its generated lockfile.

```bash
npm install
```

## 2. Configure environment

Copy the template and replace every placeholder with a real secret/value:

```bash
cp .env.example .env
```

Important production values:

- `NEXTAUTH_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXTAUTH_SECRET`
- `DATABASE_URL`
- `REDIS_URL`
- `REALTIME_JWT_SECRET`
- `GATEWAY_ALLOWED_ORIGINS`
- `TYPECORD_GATEWAY_PUBLIC_URL`
- LiveKit credentials
- S3/MinIO credentials

Never commit `.env`.

## 3. Prisma

Generate the client and deploy migrations:

```bash
npx prisma generate
npx prisma migrate deploy
```

The security migration makes existing guilds private by default by adding `Guild.discoverable = false`.

## 4. Validate

```bash
npx tsc --noEmit
npm run lint
npm run build
```

Do not restore `typescript.ignoreBuildErrors` to bypass failures. Fix build/type errors instead.

## 5. Start application and Gateway

Web app:

```bash
npm run start
```

Gateway:

```bash
npm run gateway:start
```

Run them as separate supervised services/containers in production.

## 6. Reverse proxy / TLS

Expose only the required public services over HTTPS/WSS. Keep PostgreSQL, Redis and MinIO administrative interfaces private. Forward the correct host/proto headers to Next.js and configure `GATEWAY_ALLOWED_ORIGINS` explicitly.

## 7. Developer API policy

The Developer Portal intentionally documents only the public Bot API/Gateway contract. Do not dynamically crawl `src/app/api` to generate public documentation. Any newly public endpoint should be added manually to the `PUBLIC_API_DOCS` allowlist after a security review.
