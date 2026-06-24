import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import { AuthUser, CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UsuariosService } from './usuarios.service';

@ApiTags('Usuarios')
@ApiBearerAuth()
@Roles(RolUsuario.ADMIN)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post()
  @ApiOperation({ summary: 'Crea un usuario (solo ADMIN)' })
  create(@Body() dto: CreateUsuarioDto) {
    return this.usuariosService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista usuarios (solo ADMIN)' })
  list() {
    return this.usuariosService.list();
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualiza nombre/rol/activo/password de un usuario (solo ADMIN)' })
  update(@Param('id') id: string, @Body() dto: UpdateUsuarioDto, @CurrentUser() user: AuthUser) {
    return this.usuariosService.update(id, dto, user.id);
  }
}
