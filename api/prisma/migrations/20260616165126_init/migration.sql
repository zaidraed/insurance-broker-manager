-- CreateEnum
CREATE TYPE "EstadoVigencia" AS ENUM ('VIGENTE', 'A_VENCER', 'VENCIDO');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PAGADA', 'IMPAGA', 'PARCIAL', 'NA');

-- CreateEnum
CREATE TYPE "CanalContacto" AS ENUM ('TELEFONO', 'WHATSAPP', 'MAIL', 'OTRO');

-- CreateEnum
CREATE TYPE "TipoSeguimiento" AS ENUM ('RENOVACION', 'ENDOSO', 'COBRANZA', 'SINIESTRO', 'NOTA');

-- CreateTable
CREATE TABLE "compania" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "alias" TEXT[],

    CONSTRAINT "compania_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compania_import_profile" (
    "id" TEXT NOT NULL,
    "companiaId" TEXT NOT NULL,
    "identificador" TEXT NOT NULL,
    "palabraClaveFila" TEXT NOT NULL,
    "colPoliza" TEXT NOT NULL,
    "colTomador" TEXT NOT NULL,
    "colRamo" TEXT,
    "colInicioVig" TEXT NOT NULL,
    "colFinVig" TEXT,
    "colObservaciones" TEXT,
    "colBienAsegurado" TEXT,

    CONSTRAINT "compania_import_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organismo" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "organismo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direccion" (
    "id" TEXT NOT NULL,
    "organismoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "direccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacto" (
    "id" TEXT NOT NULL,
    "organismoId" TEXT,
    "direccionId" TEXT,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "email" TEXT,
    "rol" TEXT,

    CONSTRAINT "contacto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ramo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "ramo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ramo_mapping" (
    "id" TEXT NOT NULL,
    "companiaId" TEXT,
    "codigoOrigen" TEXT,
    "textoOrigen" TEXT,
    "ramoId" TEXT NOT NULL,

    CONSTRAINT "ramo_mapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poliza" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "companiaId" TEXT NOT NULL,
    "organismoId" TEXT NOT NULL,
    "direccionId" TEXT,
    "ramoId" TEXT,
    "tomador" TEXT,
    "bienAsegurado" TEXT,
    "vigenciaInicio" TIMESTAMP(3),
    "vigenciaFin" TIMESTAMP(3),
    "importe" DECIMAL(14,2),
    "cantCuotas" INTEGER,
    "observacionRaw" TEXT,
    "estadoVigencia" "EstadoVigencia" NOT NULL DEFAULT 'VIGENTE',
    "estadoPago" "EstadoPago" NOT NULL DEFAULT 'NA',
    "responsableId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "poliza_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuota" (
    "id" TEXT NOT NULL,
    "polizaId" TEXT NOT NULL,
    "nroCuota" INTEGER NOT NULL,
    "vencimiento" TIMESTAMP(3) NOT NULL,
    "importe" DECIMAL(14,2),
    "pagada" BOOLEAN NOT NULL DEFAULT false,
    "fechaPago" TIMESTAMP(3),

    CONSTRAINT "cuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seguimiento" (
    "id" TEXT NOT NULL,
    "polizaId" TEXT,
    "organismoId" TEXT,
    "usuarioId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "canal" "CanalContacto" NOT NULL,
    "tipo" "TipoSeguimiento" NOT NULL,
    "texto" TEXT NOT NULL,

    CONSTRAINT "seguimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cobranza_tracking" (
    "id" TEXT NOT NULL,
    "polizaId" TEXT NOT NULL,
    "fechaEnvioDoc" TIMESTAMP(3),
    "ultimaActualizacion" TIMESTAMP(3),
    "queSigue" TEXT,
    "revisar" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "cobranza_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "siniestro" (
    "id" TEXT NOT NULL,
    "polizaId" TEXT NOT NULL,
    "fechaDenuncia" TIMESTAMP(3),
    "estado" TEXT,
    "descripcion" TEXT,
    "ultimaActualizacion" TIMESTAMP(3),

    CONSTRAINT "siniestro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "rol" TEXT,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospecto" (
    "id" TEXT NOT NULL,
    "vendedorId" TEXT,
    "fechaVisita" TIMESTAMP(3),
    "nombre" TEXT NOT NULL,
    "dni" TEXT,
    "sexo" TEXT,
    "fechaNac" TIMESTAMP(3),
    "email" TEXT,
    "celular" TEXT,
    "reparticion" TEXT,
    "empresa" TEXT,
    "zona" TEXT,
    "localidad" TEXT,
    "contrataVida" BOOLEAN NOT NULL DEFAULT false,
    "contrataSepelio" BOOLEAN NOT NULL DEFAULT false,
    "contrataRetiro" BOOLEAN NOT NULL DEFAULT false,
    "seguroArma" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "prospecto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "compania_nombre_key" ON "compania"("nombre");

-- CreateIndex
CREATE INDEX "compania_import_profile_companiaId_idx" ON "compania_import_profile"("companiaId");

-- CreateIndex
CREATE UNIQUE INDEX "organismo_codigo_key" ON "organismo"("codigo");

-- CreateIndex
CREATE INDEX "direccion_organismoId_idx" ON "direccion"("organismoId");

-- CreateIndex
CREATE INDEX "contacto_organismoId_idx" ON "contacto"("organismoId");

-- CreateIndex
CREATE INDEX "contacto_direccionId_idx" ON "contacto"("direccionId");

-- CreateIndex
CREATE UNIQUE INDEX "ramo_nombre_key" ON "ramo"("nombre");

-- CreateIndex
CREATE INDEX "ramo_mapping_companiaId_idx" ON "ramo_mapping"("companiaId");

-- CreateIndex
CREATE INDEX "ramo_mapping_ramoId_idx" ON "ramo_mapping"("ramoId");

-- CreateIndex
CREATE INDEX "poliza_estadoVigencia_idx" ON "poliza"("estadoVigencia");

-- CreateIndex
CREATE INDEX "poliza_vigenciaFin_idx" ON "poliza"("vigenciaFin");

-- CreateIndex
CREATE INDEX "poliza_organismoId_idx" ON "poliza"("organismoId");

-- CreateIndex
CREATE INDEX "poliza_responsableId_idx" ON "poliza"("responsableId");

-- CreateIndex
CREATE UNIQUE INDEX "poliza_companiaId_numero_key" ON "poliza"("companiaId", "numero");

-- CreateIndex
CREATE INDEX "cuota_polizaId_idx" ON "cuota"("polizaId");

-- CreateIndex
CREATE INDEX "cuota_vencimiento_idx" ON "cuota"("vencimiento");

-- CreateIndex
CREATE INDEX "seguimiento_polizaId_idx" ON "seguimiento"("polizaId");

-- CreateIndex
CREATE INDEX "seguimiento_organismoId_idx" ON "seguimiento"("organismoId");

-- CreateIndex
CREATE INDEX "seguimiento_usuarioId_idx" ON "seguimiento"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "cobranza_tracking_polizaId_key" ON "cobranza_tracking"("polizaId");

-- CreateIndex
CREATE INDEX "siniestro_polizaId_idx" ON "siniestro"("polizaId");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE INDEX "prospecto_vendedorId_idx" ON "prospecto"("vendedorId");

-- AddForeignKey
ALTER TABLE "compania_import_profile" ADD CONSTRAINT "compania_import_profile_companiaId_fkey" FOREIGN KEY ("companiaId") REFERENCES "compania"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direccion" ADD CONSTRAINT "direccion_organismoId_fkey" FOREIGN KEY ("organismoId") REFERENCES "organismo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacto" ADD CONSTRAINT "contacto_organismoId_fkey" FOREIGN KEY ("organismoId") REFERENCES "organismo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacto" ADD CONSTRAINT "contacto_direccionId_fkey" FOREIGN KEY ("direccionId") REFERENCES "direccion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ramo_mapping" ADD CONSTRAINT "ramo_mapping_companiaId_fkey" FOREIGN KEY ("companiaId") REFERENCES "compania"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ramo_mapping" ADD CONSTRAINT "ramo_mapping_ramoId_fkey" FOREIGN KEY ("ramoId") REFERENCES "ramo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poliza" ADD CONSTRAINT "poliza_companiaId_fkey" FOREIGN KEY ("companiaId") REFERENCES "compania"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poliza" ADD CONSTRAINT "poliza_organismoId_fkey" FOREIGN KEY ("organismoId") REFERENCES "organismo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poliza" ADD CONSTRAINT "poliza_direccionId_fkey" FOREIGN KEY ("direccionId") REFERENCES "direccion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poliza" ADD CONSTRAINT "poliza_ramoId_fkey" FOREIGN KEY ("ramoId") REFERENCES "ramo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poliza" ADD CONSTRAINT "poliza_responsableId_fkey" FOREIGN KEY ("responsableId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cuota" ADD CONSTRAINT "cuota_polizaId_fkey" FOREIGN KEY ("polizaId") REFERENCES "poliza"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguimiento" ADD CONSTRAINT "seguimiento_polizaId_fkey" FOREIGN KEY ("polizaId") REFERENCES "poliza"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguimiento" ADD CONSTRAINT "seguimiento_organismoId_fkey" FOREIGN KEY ("organismoId") REFERENCES "organismo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguimiento" ADD CONSTRAINT "seguimiento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cobranza_tracking" ADD CONSTRAINT "cobranza_tracking_polizaId_fkey" FOREIGN KEY ("polizaId") REFERENCES "poliza"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "siniestro" ADD CONSTRAINT "siniestro_polizaId_fkey" FOREIGN KEY ("polizaId") REFERENCES "poliza"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospecto" ADD CONSTRAINT "prospecto_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
