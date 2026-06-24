# Broker Seguros

Sistema de gestión de pólizas de seguros (herramienta interna). Monorepo.

- **`api/`** — Backend NestJS + Prisma + PostgreSQL (deploy: Railway). Ver [`api/README.md`](api/README.md).
- **`web/`** — Frontend Next.js (App Router) + Tailwind (deploy: Vercel). Ver [`web/README.md`](web/README.md).

## Desarrollo local

```bash
# Backend (:3000)
cd api && npm install && npm run start:dev

# Frontend (:3001) — en otra terminal
cd web && npm install && npm run dev
```

El frontend habla con el backend vía un proxy server-side que inyecta el JWT
(cookie httpOnly); el browser nunca pega directo a la API.

## Carga inicial de datos

El orden de migración/seed/imports está documentado en [`api/README.md`](api/README.md#carga-inicial-de-datos-orden).

## Deploy

- Backend → Railway (build `prisma generate && nest build`, pre-deploy `prisma migrate deploy`, start `node dist/main`).
- Frontend → Vercel (env `BACKEND_INTERNAL_URL` apuntando al backend de Railway).
