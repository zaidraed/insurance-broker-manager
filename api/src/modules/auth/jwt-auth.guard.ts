import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthUser } from './decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';

interface JwtPayload {
  sub: string;
  nombre: string;
  email: string;
  rol: AuthUser['rol'];
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user: AuthUser }>();
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autenticación faltante');
    }

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(header.slice(7));
      req.user = {
        id: payload.sub,
        nombre: payload.nombre,
        email: payload.email,
        rol: payload.rol,
      };
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
    return true;
  }
}
