/*
  Warnings:

  - The `rol` column on the `usuario` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ADMIN', 'OPERADOR');

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "passwordHash" TEXT,
DROP COLUMN "rol",
ADD COLUMN     "rol" "RolUsuario" NOT NULL DEFAULT 'OPERADOR';
