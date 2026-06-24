import { Injectable, Logger } from '@nestjs/common';
import { CanalContacto, Prisma, TipoSeguimiento } from '@prisma/client';
import { Workbook, Worksheet } from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { ImportNormalizerService } from './import-normalizer.service';
import { PerfilImportReport, UiImportReport } from './perfil-import-report.types';
import { ResolvedImportMapping } from './import-mapping.types';
import { asString, cellValue, headerKey, readCol } from './xlsx-cell.util';

const BATCH_SIZE = 500;
/** Hasta qué fila buscar el header antes de rendirse. */
const MAX_HEADER_SCAN = 50;

interface ProfileRow {
  id: string;
  companiaId: string;
  identificador: string;
  palabraClaveFila: string;
  colPoliza: string;
  colTomador: string;
  colRamo: string | null;
  colInicioVig: string;
  colFinVig: string | null;
  colObservaciones: string | null;
  colBienAsegurado: string | null;
  colFechaFacturado: string | null;
  colMedioPago: string | null;
  compania: { id: string; nombre: string };
}

/** Snapshot de los campos que este import administra, para diffear en updates. */
interface PolizaSnapshot {
  id: string;
  organismoId: string;
  ramoId: string | null;
  tomador: string | null;
  bienAsegurado: string | null;
  vigenciaInicio: Date | null;
  vigenciaFin: Date | null;
  observacionRaw: string | null;
  facturadoHasta: Date | null;
  medioPago: string | null;
}

/**
 * Importador genérico de pólizas. El core (`runWithMapping`) trabaja sobre un
 * {@link ResolvedImportMapping} + companiaId; no sabe nada de perfiles guardados.
 * El path CLI (`run`) arma ese mapping desde el CompaniaImportProfile y delega.
 * El path UI (controller) le pasa el mapping armado desde el body.
 */
@Injectable()
export class PerfilImportService {
  private readonly logger = new Logger(PerfilImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly normalizer: ImportNormalizerService,
  ) {}

  // -------------------------------------------------------------------------
  // Carga del perfil (path CLI)
  // -------------------------------------------------------------------------

  private async loadProfile(opts: {
    identificador?: string;
    companiaId?: string;
  }): Promise<ProfileRow> {
    const { identificador, companiaId } = opts;
    if (!identificador && !companiaId) {
      throw new Error('Se requiere identificador o companiaId para cargar el perfil.');
    }
    const profile = await this.prisma.companiaImportProfile.findFirst({
      where: identificador ? { identificador } : { companiaId },
      include: { compania: { select: { id: true, nombre: true } } },
    });
    if (!profile) {
      throw new Error(
        `No se encontró CompaniaImportProfile para ${
          identificador ? `identificador="${identificador}"` : `companiaId="${companiaId}"`
        }.`,
      );
    }
    return profile as ProfileRow;
  }

  /** Convierte un perfil guardado al mapping resuelto que entiende el core. */
  private profileToMapping(profile: ProfileRow): ResolvedImportMapping {
    return {
      companiaId: profile.companiaId,
      palabraClaveFila: profile.palabraClaveFila,
      colPoliza: profile.colPoliza,
      colTomador: profile.colTomador,
      colRamo: profile.colRamo,
      colInicio: profile.colInicioVig,
      colFin: profile.colFinVig,
      colObs: profile.colObservaciones,
      colBien: profile.colBienAsegurado,
      colFechaFacturado: profile.colFechaFacturado,
      colMedioPago: profile.colMedioPago,
    };
  }

  // -------------------------------------------------------------------------
  // Ubicación del header
  // -------------------------------------------------------------------------

  /** Encuentra (solapa, fila) del header a partir del mapping resuelto. */
  private resolveHeader(
    wb: Workbook,
    mapping: ResolvedImportMapping,
  ): { ws: Worksheet; headerRow: number } {
    // 1) headerRow explícito (opcionalmente acotado a una solapa por nombre).
    if (mapping.headerRow && mapping.headerRow > 0) {
      const ws = mapping.sheet
        ? wb.worksheets.find((w) => w.name === mapping.sheet)
        : wb.worksheets[0];
      if (!ws) {
        throw new Error(`No se encontró la solapa "${mapping.sheet}" en el archivo.`);
      }
      return { ws, headerRow: mapping.headerRow };
    }
    // 2) palabra clave: primera fila con una celda == palabraClaveFila.
    if (mapping.palabraClaveFila) {
      const target = headerKey(mapping.palabraClaveFila);
      for (const ws of wb.worksheets) {
        const last = Math.min(ws.rowCount, MAX_HEADER_SCAN);
        for (let r = 1; r <= last; r++) {
          const row = ws.getRow(r);
          const cols = ws.columnCount || 1;
          for (let c = 1; c <= cols; c++) {
            if (headerKey(cellValue(row.getCell(c))) === target) {
              return { ws, headerRow: r };
            }
          }
        }
      }
      throw new Error(
        `No se encontró la fila header (palabra clave "${mapping.palabraClaveFila}") en ninguna solapa.`,
      );
    }
    throw new Error('El mapping no define headerRow ni palabraClaveFila para ubicar el header.');
  }

  // -------------------------------------------------------------------------
  // Diff para el seguimiento de update
  // -------------------------------------------------------------------------

  private dateEq(a: Date | null, b: Date | null): boolean {
    if (a === null || b === null) return a === b;
    return a.getTime() === b.getTime();
  }

  /** Lista de campos (legibles) que cambian entre el snapshot previo y los nuevos valores. */
  private camposCambiados(
    prev: PolizaSnapshot,
    next: PolizaSnapshot,
    mapping: ResolvedImportMapping,
  ): string[] {
    const out: string[] = [];
    if (prev.organismoId !== next.organismoId) out.push('organismo');
    if (mapping.colTomador && (prev.tomador ?? null) !== (next.tomador ?? null)) out.push('tomador');
    if (mapping.colRamo && prev.ramoId !== next.ramoId) out.push('ramo');
    if (prev.bienAsegurado !== next.bienAsegurado && mapping.colBien) out.push('bienAsegurado');
    if (!this.dateEq(prev.vigenciaInicio, next.vigenciaInicio)) out.push('vigenciaInicio');
    if (mapping.colFin && !this.dateEq(prev.vigenciaFin, next.vigenciaFin)) out.push('vigenciaFin');
    if (mapping.colObs && prev.observacionRaw !== next.observacionRaw) out.push('observacion');
    if (mapping.colFechaFacturado && !this.dateEq(prev.facturadoHasta, next.facturadoHasta)) {
      out.push('facturadoHasta');
    }
    if (mapping.colMedioPago && (prev.medioPago ?? null) !== (next.medioPago ?? null)) {
      out.push('medioPago');
    }
    return out;
  }

  // -------------------------------------------------------------------------
  // Wrappers de entrada
  // -------------------------------------------------------------------------

  /** Path CLI: arma el mapping desde el perfil guardado y corre el core. */
  async run(
    opts: { identificador?: string; companiaId?: string },
    filePath: string,
  ): Promise<PerfilImportReport> {
    const profile = await this.loadProfile(opts);
    const wb = new Workbook();
    await wb.xlsx.readFile(filePath);
    return this.runWithMapping(this.profileToMapping(profile), wb);
  }

  /**
   * Path UI: corre el import desde un buffer xlsx con un mapping armado en el
   * front. Si `guardarProfile`, upsertea el CompaniaImportProfile (reusable).
   */
  async runFromUi(
    mapping: ResolvedImportMapping,
    buffer: Buffer,
    guardarProfile: boolean,
  ): Promise<UiImportReport> {
    const wb = new Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const report = await this.runWithMapping(mapping, wb);
    if (guardarProfile) await this.upsertProfile(mapping, wb);
    return {
      filasLeidas: report.filasLeidas,
      creadas: report.creadas,
      actualizadas: report.actualizadas,
      ramosNoResueltos: [...report.ramosNoResueltos],
      organismosNuevos: [...report.organismosNuevos],
    };
  }

  /**
   * Upsert del perfil de la compañía (uno por compañía). Si el mapping ubica el
   * header por `headerRow`, deriva la palabra clave del texto del header sobre
   * la columna de póliza, para que el perfil siga siendo re-detectable por CLI.
   */
  private async upsertProfile(mapping: ResolvedImportMapping, wb: Workbook): Promise<void> {
    const compania = await this.prisma.compania.findUnique({
      where: { id: mapping.companiaId },
      select: { id: true, nombre: true },
    });
    if (!compania) throw new Error(`No existe la compañía con id="${mapping.companiaId}".`);

    let palabraClave = mapping.palabraClaveFila ?? null;
    if (!palabraClave) {
      const { ws, headerRow } = this.resolveHeader(wb, mapping);
      palabraClave = asString(readCol(ws.getRow(headerRow), mapping.colPoliza));
    }
    if (!palabraClave) {
      throw new Error(
        'No se pudo determinar la palabra clave del header para guardar el perfil.',
      );
    }

    const data = {
      palabraClaveFila: palabraClave,
      colPoliza: mapping.colPoliza,
      colTomador: mapping.colTomador,
      colRamo: mapping.colRamo ?? null,
      colInicioVig: mapping.colInicio,
      colFinVig: mapping.colFin ?? null,
      colObservaciones: mapping.colObs ?? null,
      colBienAsegurado: mapping.colBien ?? null,
      colFechaFacturado: mapping.colFechaFacturado ?? null,
      colMedioPago: mapping.colMedioPago ?? null,
    };

    // Sin @@unique sobre companiaId en el schema -> upsert manual (uno por compañía).
    const existente = await this.prisma.companiaImportProfile.findFirst({
      where: { companiaId: mapping.companiaId },
    });
    if (existente) {
      await this.prisma.companiaImportProfile.update({ where: { id: existente.id }, data });
    } else {
      await this.prisma.companiaImportProfile.create({
        data: { companiaId: mapping.companiaId, identificador: compania.nombre, ...data },
      });
    }
  }

  // -------------------------------------------------------------------------
  // Core: importa según un mapping resuelto
  // -------------------------------------------------------------------------

  async runWithMapping(
    mapping: ResolvedImportMapping,
    wb: Workbook,
  ): Promise<PerfilImportReport> {
    const compania = await this.prisma.compania.findUnique({
      where: { id: mapping.companiaId },
      select: { id: true, nombre: true },
    });
    if (!compania) {
      throw new Error(`No existe la compañía con id="${mapping.companiaId}".`);
    }

    const { ws, headerRow } = this.resolveHeader(wb, mapping);
    const firstDataRow = headerRow + 1;
    this.logger.log(
      `Import ${compania.nombre} — solapa "${ws.name}", header en fila ${headerRow}, datos desde ${firstDataRow}.`,
    );

    const report: PerfilImportReport = {
      perfil: mapping.palabraClaveFila ?? `fila ${headerRow}`,
      compania: compania.nombre,
      filaHeader: headerRow,
      filasLeidas: 0,
      creadas: 0,
      actualizadas: 0,
      ramosNoResueltos: new Set<string>(),
      organismosNuevos: new Set<string>(),
    };

    // Snapshot de pólizas existentes de la compañía (creadas vs actualizadas + diff).
    const existentes = await this.prisma.poliza.findMany({
      where: { companiaId: compania.id },
      select: {
        id: true,
        numero: true,
        organismoId: true,
        ramoId: true,
        tomador: true,
        bienAsegurado: true,
        vigenciaInicio: true,
        vigenciaFin: true,
        observacionRaw: true,
        facturadoHasta: true,
        medioPago: true,
      },
    });
    const prevByNumero = new Map(existentes.map((p) => [p.numero, p]));

    // Organismos preexistentes (para reportar los nuevos que crea splitOrganismo).
    const orgs = await this.prisma.organismo.findMany({ select: { codigo: true } });
    const codigosOrganismo = new Set(orgs.map((o) => o.codigo));

    let batch: Prisma.PrismaPromise<unknown>[] = [];
    const flush = async (): Promise<void> => {
      if (batch.length === 0) return;
      await this.prisma.$transaction(batch);
      batch = [];
    };

    const last = ws.rowCount;
    for (let r = firstDataRow; r <= last; r++) {
      const row = ws.getRow(r);

      const numero = this.normalizer.normalizeNumeroPoliza(readCol(row, mapping.colPoliza));
      if (!numero) continue;
      report.filasLeidas++;

      const organismo = await this.normalizer.splitOrganismo(readCol(row, mapping.colTomador));
      if (!organismo) {
        this.logger.warn(`Fila ${r}: póliza ${numero} sin tomador/organismo, se omite.`);
        continue;
      }
      if (!codigosOrganismo.has(organismo.codigo)) {
        codigosOrganismo.add(organismo.codigo);
        report.organismosNuevos.add(organismo.nombre);
      }

      // Ramo por código (col del mapping) vía RamoMapping; el código crudo se persiste.
      const codigoRamo = mapping.colRamo ? asString(readCol(row, mapping.colRamo)) : null;
      let ramoId: string | null = null;
      if (mapping.colRamo) {
        ramoId = await this.normalizer.resolveRamoByCode(compania.id, codigoRamo);
        if (!ramoId && codigoRamo) report.ramosNoResueltos.add(codigoRamo);
      }

      const vigenciaInicio = this.normalizer.cleanDate(readCol(row, mapping.colInicio));
      const vigenciaFin = mapping.colFin
        ? this.normalizer.cleanDate(readCol(row, mapping.colFin))
        : null;
      const bienAsegurado = mapping.colBien ? asString(readCol(row, mapping.colBien)) : null;
      const observacionRaw = mapping.colObs ? asString(readCol(row, mapping.colObs)) : null;
      const facturadoHasta = mapping.colFechaFacturado
        ? this.normalizer.cleanDate(readCol(row, mapping.colFechaFacturado))
        : null;
      const medioPago = mapping.colMedioPago ? asString(readCol(row, mapping.colMedioPago)) : null;

      // Solo escribimos los campos que el mapping define (no pisamos lo que no trae).
      const data: Prisma.PolizaUncheckedUpdateInput = {
        organismoId: organismo.id,
        tomador: organismo.nombre,
        vigenciaInicio,
        estadoVigencia: this.normalizer.computeEstadoVigencia(vigenciaFin),
      };
      if (mapping.colRamo) {
        data.ramoId = ramoId;
        data.ramoCodigoOrigen = codigoRamo;
      }
      if (mapping.colFin) data.vigenciaFin = vigenciaFin;
      if (mapping.colBien) data.bienAsegurado = bienAsegurado;
      if (mapping.colObs) data.observacionRaw = observacionRaw;
      if (mapping.colFechaFacturado) data.facturadoHasta = facturadoHasta;
      if (mapping.colMedioPago) data.medioPago = medioPago;

      const prev = prevByNumero.get(numero);
      if (prev) {
        report.actualizadas++;
        const next: PolizaSnapshot = {
          id: prev.id,
          organismoId: organismo.id,
          ramoId: mapping.colRamo ? ramoId : prev.ramoId,
          tomador: organismo.nombre,
          bienAsegurado: mapping.colBien ? bienAsegurado : prev.bienAsegurado,
          vigenciaInicio,
          vigenciaFin: mapping.colFin ? vigenciaFin : prev.vigenciaFin,
          observacionRaw: mapping.colObs ? observacionRaw : prev.observacionRaw,
          facturadoHasta: mapping.colFechaFacturado ? facturadoHasta : prev.facturadoHasta,
          medioPago: mapping.colMedioPago ? medioPago : prev.medioPago,
        };
        const cambios = this.camposCambiados(prev, next, mapping);
        batch.push(
          this.prisma.poliza.update({
            where: { companiaId_numero: { companiaId: compania.id, numero } },
            data,
          }),
        );
        if (cambios.length > 0 && prev.id) {
          batch.push(
            this.prisma.seguimiento.create({
              data: {
                polizaId: prev.id,
                tipo: TipoSeguimiento.NOTA,
                canal: CanalContacto.OTRO,
                texto: `import ${compania.nombre}: ${cambios.join(', ')}`,
              },
            }),
          );
        }
      } else {
        report.creadas++;
        // Evita doble-create si el número se repite dentro del mismo archivo.
        prevByNumero.set(numero, {
          id: '',
          numero,
          organismoId: organismo.id,
          ramoId: mapping.colRamo ? ramoId : null,
          tomador: organismo.nombre,
          bienAsegurado,
          vigenciaInicio,
          vigenciaFin,
          observacionRaw,
          facturadoHasta,
          medioPago,
        });
        batch.push(
          this.prisma.poliza.create({
            data: {
              ...(data as Prisma.PolizaUncheckedCreateInput),
              numero,
              companiaId: compania.id,
            },
          }),
        );
      }

      if (batch.length >= BATCH_SIZE) await flush();
    }

    await flush();
    return report;
  }
}
