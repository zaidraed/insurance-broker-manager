-- AlterTable
ALTER TABLE "compania_import_profile" ADD COLUMN     "colFechaFacturado" TEXT,
ADD COLUMN     "colMedioPago" TEXT;

-- AlterTable
ALTER TABLE "poliza" ADD COLUMN     "facturadoHasta" TIMESTAMP(3),
ADD COLUMN     "medioPago" TEXT;
