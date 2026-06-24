-- AlterTable
ALTER TABLE "poliza" ADD COLUMN     "deudaActualizadaAl" TIMESTAMP(3),
ADD COLUMN     "deudaMonto" DECIMAL(14,2),
ADD COLUMN     "deudaObs" TEXT;
