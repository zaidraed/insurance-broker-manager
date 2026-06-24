import { SetMetadata } from '@nestjs/common';
import { RolUsuario } from '@prisma/client';

export const ROLES_KEY = 'roles';

/** Restringe una ruta/controlador a los roles indicados (usado por RolesGuard). */
export const Roles = (...roles: RolUsuario[]) => SetMetadata(ROLES_KEY, roles);
