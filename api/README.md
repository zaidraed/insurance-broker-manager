# Broker Seguros API

Backend NestJS (TypeScript) para un sistema de gestión de pólizas de seguros.

**Stack:** NestJS 11 · Prisma 6 · PostgreSQL · Swagger · class-validator · zod

## Requisitos

- Node.js 20+ (probado en Node 24)
- PostgreSQL en ejecución

## Setup

```bash
# 1. Instalar dependencias
npm install

# 2. Copiar variables de entorno y completarlas
cp .env.example .env

# 3. Aplicar migraciones (genera el cliente de Prisma)
npm run prisma:migrate

# 4. Cargar datos base (ramos, compañías, import profiles)
npm run prisma:seed
```

## Comandos

| Comando | Descripción |
| --- | --- |
| `npm run start:dev` | Levanta la API en modo watch |
| `npm run build` | Compila a `dist/` |
| `npm run start:prod` | Ejecuta el build (`node dist/main`) |
| `npm run prisma:migrate` | Crea/aplica migraciones (`prisma migrate dev`) |
| `npm run prisma:seed` | Carga datos base (ramos, compañías, import profiles) |
| `npm run prisma:studio` | Abre Prisma Studio |
| `npm run import:basededatos -- <ruta.xlsx>` | Importa la solapa `basededatos` del TABLERO |
| `npm run import:cuotas -- <ruta.xlsx>` | Importa la solapa `vencimientos` (cuotas Aseguradora A) |
| `npm run backfill:ramos -- <ruta.xlsx>` | Backfillea `ramoId` de pólizas con ramo solo-código |
| `npm run import:deuda -- <ruta.xlsx>` | Importa la solapa `DEUDA` (fuente de impaga) |
| `npm run merge:companias-dup` | Mergea compañías cuyo nombre normalizado colisiona |
| `npm run prisma:generate` | Regenera el cliente de Prisma |

## Endpoints

- `GET /docs` — documentación Swagger ("Broker Seguros API", v0.1)
- `GET /health` — healthcheck (verifica la conexión a PostgreSQL vía Prisma)

**Pólizas** (`src/modules/polizas`)
- `GET /polizas` — listado paginado (`estadoVigencia`, `companiaId`, `organismoId`, `ramoId`, `venceDesde`, `venceHasta`, `search`, `page`, `pageSize`, `sort`)
- `GET /polizas/resumen` — métricas para dashboard
- `GET /polizas/:id` — detalle con relaciones

**Seguimientos** (append-only, `src/modules/seguimientos`)
- `POST /polizas/:id/seguimientos` · `GET /polizas/:id/seguimientos`

**Cobranza** (`src/modules/cobranza`)
- `PUT /polizas/:id/cobranza` — upsert tracking + recálculo de `revisar`
- `GET /cobranza/revisar` — pólizas con `revisar=true`, más atrasadas primero

**Refacturación** (`src/modules/cuotas`)
- `GET /refacturacion?dias=30` — semáforo: cuotas impagas con vencimiento <= hoy+dias (incluye vencidas), ordenadas por más urgente; counts `vencidasImpagas / proximas30 / proximas60`

**Admin** (`src/modules/admin`)
- `POST /admin/recalcular` — recalcula `estadoVigencia` y `revisar`
- `GET /admin/ramos/no-mapeados` — pólizas sin ramo agrupadas por (compañía, código)
- `POST /admin/ramos/mapear` — crea `RamoMapping` y backfillea las pólizas afectadas
- Cron diario 03:00 (`@nestjs/schedule`) hace lo mismo automáticamente.

> Las fechas se manejan en **UTC** (`src/common/utils/date.util.ts`) para evitar
> el corrimiento de un día por zona horaria local.

## Variables de entorno

| Variable | Descripción | Default |
| --- | --- | --- |
| `DATABASE_URL` | Cadena de conexión PostgreSQL | — (obligatoria) |
| `PORT` | Puerto HTTP (lo inyecta Railway en prod) | `3000` |
| `NODE_ENV` | `development` \| `production` \| `test` | `development` |
| `JWT_SECRET` | Secreto para firmar los JWT | — (obligatoria) |
| `ADMIN_EMAIL` | Email del ADMIN inicial (lo usa el seed) | — (obligatoria en prod) |
| `ADMIN_PASSWORD` | Password del ADMIN inicial (lo usa el seed) | — (obligatoria en prod) |

Las variables se validan al arrancar con **zod** (`src/config/env.validation.ts`).
En `NODE_ENV=production`, `ADMIN_EMAIL` y `ADMIN_PASSWORD` también son obligatorias.

## Estructura

```
src/
├── common/        # filtros, pipes y decoradores transversales
│   └── filters/   # AllExceptionsFilter (normaliza errores HTTP)
├── config/        # validación de env (zod)
├── health/        # módulo de healthcheck
├── modules/       # módulos de negocio (vacío por ahora)
├── prisma/        # PrismaModule global + PrismaService
├── app.module.ts
└── main.ts
```

## Modelo de datos

Schema completo en `prisma/schema.prisma` (14 modelos): `Compania`,
`CompaniaImportProfile`, `Organismo`, `Direccion`, `Contacto`, `Ramo`,
`RamoMapping`, `Poliza`, `Cuota`, `Seguimiento`, `CobranzaTracking`,
`Siniestro`, `Usuario`, `Prospecto`. Ids `cuid`, tablas en snake_case.

El seed (`prisma/seed.ts`) carga 18 ramos canónicos, 6 compañías y 7
import profiles (de CONFIG_SISTEMA).

## Importación

`src/modules/import/` carga la solapa `basededatos` del TABLERO consolidado
(~8000 pólizas):

- `ImportNormalizerService`: normalizadores reutilizables (compañía + alias,
  organismo, ramo por keywords + RamoMapping, fechas en UTC, importes Decimal,
  estado de vigencia). Pensado para reusar en el futuro importador por-perfil.
- `BasededatosImportService`: lee el xlsx con exceljs (header fila 3, datos
  desde fila 4), upsert idempotente de `Poliza` por `[companiaId, numero]` en
  lotes de 500, y devuelve un reporte (creadas/actualizadas/descartadas/ramos
  no resueltos/compañías creadas).
- `CuotasImportService`: lee la solapa `vencimientos` (header fila 1, datos
  desde fila 2; todas las filas son de ASEGURADORA A / Nº Intermediario 001).
  Matchea `Poliza` por `[ASEGURADORA A, numero]`, upsert de `Cuota` por
  `[polizaId, nroCuota]`.
- `DeudaImportService`: lee la solapa `DEUDA` (**fuente de autoridad de impaga**).
  Agrupa por `[compañía, numero]` (**dedup de filas idénticas** importe+obs antes
  de sumar, concatena obs, toma la fecha `AL dd/mm/aaaa` más reciente), resetea
  `estadoPago=NA` en todas y marca `IMPAGA` + `deudaMonto/deudaObs/deudaActualizadaAl`
  en las que matchean.
- `CompaniasMergeService` + `npm run merge:companias-dup`: limpieza one-off que
  mergea compañías con nombre normalizado colisionante (sin acentos), eligiendo
  canónica (más pólizas / acentos correctos) y repunteando pólizas, profiles y
  mappings. El match de compañías ya es **accent-insensitive** (`normalizeCompania`).
- CLI: `npm run import:basededatos -- "<ruta>"` · `npm run import:cuotas -- "<ruta>"`

- `RamoBackfillService` + `npm run backfill:ramos`: para las pólizas con ramo
  solo-código (col C numérica, J vacía), persiste `Poliza.ramoCodigoOrigen` y
  resuelve `ramoId` vía `RamoMapping` (código→ramo, por compañía y con fallback
  global). El remanente se mapea a mano por `GET/POST /admin/ramos/*`.

> Nota 1: el backfill resolvió ~3000 de ~3083 pólizas sin ramo. El remanente
> (~84) son textos sin ramo canónico (p.ej. "Hogar", "Vida Individual") o
> códigos numéricos sin sibling resuelto; se completan vía `/admin/ramos/mapear`.
>
> Nota 2: en `vencimientos`, la columna **Pago** trae un único valor
> (`"Con cupones"`) que la heurística `interpretarPago` (`/pag|abonad|cobrad/i`)
> trata como **impaga**. El import reporta los valores distintos de Pago para
> ajustar la heurística cuando se sepa cómo marcar las pagadas.

## Carga inicial de datos (orden)

El orden importa (cada paso depende del anterior). Con la base migrada:

```bash
# 1. Migración + seed (ramos, compañías, import profiles, usuario ADMIN)
npm run migrate:deploy        # prod  (en dev: npm run prisma:migrate)
npm run prisma:seed

# 2. Pólizas consolidadas (crea las ~8000 pólizas)
npm run import:basededatos -- "<ruta>/TABLERO ... .xlsx"

# 3. Backfill de ramos por código (usa los RamoMapping sembrados en el paso 2)
npm run backfill:ramos -- "<ruta>/TABLERO ... .xlsx"

# 4. Consolidar compañías duplicadas (antes de la deuda, por el match sin acentos)
npm run merge:companias-dup

# 5. Cuotas (solapa vencimientos, Aseguradora A)
npm run import:cuotas -- "<ruta>/TABLERO ... .xlsx"

# 6. Deuda (autoridad de impaga; resetea estadoPago y marca IMPAGA)
npm run import:deuda -- "<ruta>/TABLERO ... .xlsx"
```

## Producción (Railway)

- **Build**: `npm run build` (corre `prisma generate` con el target Linux
  `debian-openssl-3.0.x` + `nest build`).
- **Pre-deploy command**: `npm run migrate:deploy` (aplica migraciones; las
  migraciones NO van en el start).
- **Start**: `npm run start:prod` (`node dist/main`, escucha en `process.env.PORT`).
- **Sin CORS**: el browser solo habla con el front (Vercel `/api`); el server de
  Vercel reenvía a Railway con el Bearer. La API no expone CORS a propósito.
- Variables obligatorias en Railway: `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`,
  `ADMIN_PASSWORD` (`PORT` lo inyecta Railway). Correr seed/imports una vez tras
  el primer deploy.

## Próximos pasos

- Agregar módulos de negocio en `src/modules/`.
