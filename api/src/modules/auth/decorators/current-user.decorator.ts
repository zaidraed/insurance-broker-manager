import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RolUsuario } from '@prisma/client';
import { Request } from 'express';

export interface AuthUser {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
}

/** Inyecta el usuario autenticado (req.user) seteado por el JwtAuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const req = ctx.switchToHttp().getRequest<Request & { user: AuthUser }>();
    return req.user;
  },
);
