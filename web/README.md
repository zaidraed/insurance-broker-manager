# Broker Seguros — Web

Panel interno (Next.js 16 App Router + TypeScript + Tailwind v4) del broker.
Consume la API NestJS (`broker-seguros-api`) con JWT en cookie httpOnly.

## Desarrollo

```bash
npm install
npm run dev   # http://localhost:3001  (el backend debe correr en :3000)
```

Login dev: `admin@ejemplo.com` / `admin1234` (según el seed del backend).

## Variables de entorno

| Variable | Descripción |
| --- | --- |
| `BACKEND_INTERNAL_URL` | URL del backend NestJS. Dev: `http://localhost:3000` (fallback). Prod (Vercel): URL pública de Railway. |

## Arquitectura de auth

- `POST /api/auth/login` → backend `/auth/login`, setea cookie httpOnly `token`
  (`secure` con `NODE_ENV=production`, `sameSite lax`, 12h).
- `app/api/[...path]` (catch-all): reenvía al backend inyectando `Authorization: Bearer`.
- `lib/server-api.ts` `serverFetch()`: fetch de Server Components con el Bearer de la cookie.
- `proxy.ts`: redirige a `/login` sin sesión (en Next 16 "middleware" se llama "proxy").

## Producción (Vercel)

- Framework Next.js, build estándar (`npm run build`).
- Setear `BACKEND_INTERNAL_URL` = URL pública del backend en Railway.
- El browser solo habla con Vercel (`/api`); el server de Vercel reenvía a Railway
  con el Bearer → no hace falta CORS en el backend.
