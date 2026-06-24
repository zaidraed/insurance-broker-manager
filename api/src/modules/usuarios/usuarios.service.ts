import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';

const SELECT = { id: true, nombre: true, email: true, rol: true, activo: true } as const;

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUsuarioDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    try {
      return await this.prisma.usuario.create({
        data: { nombre: dto.nombre, email: dto.email, passwordHash, rol: dto.rol },
        select: SELECT,
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ya existe un usuario con ese email');
      }
      throw e;
    }
  }

  list() {
    return this.prisma.usuario.findMany({ select: SELECT, orderBy: { nombre: 'asc' } });
  }

  async update(id: string, dto: UpdateUsuarioDto, currentUserId: string) {
    if (dto.activo === false && id === currentUserId) {
      throw new ForbiddenException('No podés desactivar tu propio usuario');
    }

    const data: Prisma.UsuarioUpdateInput = {};
    if (dto.nombre !== undefined) data.nombre = dto.nombre;
    if (dto.rol !== undefined) data.rol = dto.rol;
    if (dto.activo !== undefined) data.activo = dto.activo;
    if (dto.password !== undefined) data.passwordHash = await bcrypt.hash(dto.password, 10);

    try {
      return await this.prisma.usuario.update({ where: { id }, data, select: SELECT });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Usuario no encontrado');
      }
      throw e;
    }
  }
}
