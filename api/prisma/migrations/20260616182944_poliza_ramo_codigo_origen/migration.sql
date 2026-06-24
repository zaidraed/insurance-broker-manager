-- AlterTable
ALTER TABLE "poliza" ADD COLUMN     "ramoCodigoOrigen" TEXT;

-- CreateIndex
CREATE INDEX "poliza_ramoCodigoOrigen_idx" ON "poliza"("ramoCodigoOrigen");
