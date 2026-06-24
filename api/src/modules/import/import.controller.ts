import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { DeudaImportService } from './deuda-import.service';
import { ImportAnalyzeService } from './import-analyze.service';
import { PerfilImportService } from './perfil-import.service';
import { RunImportDto } from './dto/run-import.dto';
import { ImportTipo, ResolvedDeudaMapping, ResolvedImportMapping } from './import-mapping.types';

/** Forma mínima del archivo subido (memory storage de multer) sin depender de @types/multer. */
interface UploadedXlsx {
  buffer: Buffer;
  originalname: string;
  size: number;
  mimetype: string;
}

const MAX_FILE_SIZE = 8 * 1024 * 1024; // ~8MB

@ApiTags('Import')
@ApiBearerAuth()
@Roles(RolUsuario.ADMIN)
@Controller('import')
export class ImportController {
  constructor(
    private readonly analyzeService: ImportAnalyzeService,
    private readonly perfilService: PerfilImportService,
    private readonly deudaService: DeudaImportService,
  ) {}

  @Post('analyze')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Analiza un xlsx (no importa): detecta header/columnas y sugiere mapping según tipo',
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({ name: 'tipo', enum: ['POLIZAS', 'DEUDA'], required: false })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }))
  analyze(@UploadedFile() file: UploadedXlsx, @Query('tipo') tipo?: string) {
    this.assertXlsx(file);
    return this.analyzeService.analyze(file.buffer, this.parseTipo(tipo));
  }

  @Post('run')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Importa el xlsx con el mapping indicado (tipo POLIZAS o DEUDA)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({ name: 'tipo', enum: ['POLIZAS', 'DEUDA'], required: false })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'mapping'],
      properties: {
        file: { type: 'string', format: 'binary' },
        companiaId: { type: 'string', description: 'Requerido en tipo POLIZAS' },
        mapping: { type: 'string', description: 'JSON del mapping de columnas (ImportMappingDto)' },
        guardarProfile: { type: 'boolean', description: 'Solo POLIZAS' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE } }))
  run(@UploadedFile() file: UploadedXlsx, @Body() dto: RunImportDto, @Query('tipo') tipo?: string) {
    this.assertXlsx(file);
    return this.parseTipo(tipo) === 'DEUDA'
      ? this.runDeuda(file, dto)
      : this.runPolizas(file, dto);
  }

  // -------------------------------------------------------------------------

  private runPolizas(file: UploadedXlsx, dto: RunImportDto) {
    if (!dto.companiaId) {
      throw new BadRequestException('Falta companiaId (requerido en tipo POLIZAS).');
    }
    const m = dto.mapping;
    for (const req of ['colPoliza', 'colTomador', 'colInicio'] as const) {
      if (!m[req]) throw new BadRequestException(`Falta el campo requerido "${req}" en el mapping.`);
    }
    const mapping: ResolvedImportMapping = {
      companiaId: dto.companiaId,
      palabraClaveFila: m.palabraClaveFila ?? null,
      headerRow: m.headerRow ?? null,
      sheet: m.sheet ?? null,
      colPoliza: m.colPoliza!,
      colTomador: m.colTomador!,
      colRamo: m.colRamo ?? null,
      colInicio: m.colInicio!,
      colFin: m.colFin ?? null,
      colObs: m.colObs ?? null,
      colBien: m.colBien ?? null,
      colFechaFacturado: m.colFechaFacturado ?? null,
      colMedioPago: m.colMedioPago ?? null,
    };
    return this.perfilService.runFromUi(mapping, file.buffer, dto.guardarProfile ?? false);
  }

  private runDeuda(file: UploadedXlsx, dto: RunImportDto) {
    const m = dto.mapping;
    for (const req of ['colPoliza', 'colCompania', 'colImporte'] as const) {
      if (!m[req]) throw new BadRequestException(`Falta el campo requerido "${req}" en el mapping.`);
    }
    const mapping: ResolvedDeudaMapping = {
      sheet: m.sheet ?? null,
      headerRow: m.headerRow ?? null,
      palabraClaveFila: m.palabraClaveFila ?? null,
      colPoliza: m.colPoliza!,
      colCompania: m.colCompania!,
      colImporte: m.colImporte!,
      colObs: m.colObs ?? null,
      colObs2: m.colObs2 ?? null,
    };
    return this.deudaService.runFromUi(file.buffer, mapping);
  }

  private parseTipo(tipo?: string): ImportTipo {
    if (!tipo) return 'POLIZAS';
    const t = tipo.toUpperCase();
    if (t === 'POLIZAS' || t === 'DEUDA') return t;
    throw new BadRequestException('tipo inválido (POLIZAS | DEUDA).');
  }

  private assertXlsx(file: UploadedXlsx | undefined): asserts file is UploadedXlsx {
    if (!file || !file.buffer?.length) {
      throw new BadRequestException('Falta el archivo xlsx (campo "file").');
    }
    const nombre = file.originalname?.toLowerCase() ?? '';
    if (!nombre.endsWith('.xlsx')) {
      throw new BadRequestException('El archivo debe ser .xlsx.');
    }
  }
}
