import { Injectable, Logger } from '@nestjs/common';
import { EstadoVigencia, Prisma } from '@prisma/client';
import { diffCalendarDaysUTC } from '../../common/utils/date.util';
import { PrismaService } from '../../prisma/prisma.service';

interface CompaniaLite {
  id: string;
  nombre: string;
  alias: string[];
}

interface OrganismoLite {
  id: string;
  codigo: string;
  nombre: string;
}

interface RamoLite {
  id: string;
  nombre: string;
}

export interface CompaniaResult {
  id: string;
  nombre: string;
  created: boolean;
}

export interface RamoResult {
  ramoId: string | null;
  nombre: string | null;
  resolved: boolean;
}

/**
 * Aliases crudos conocidos -> nombre canónico de compañía.
 * Las claves se comparan ya normalizadas (trim + uppercase + espacios colapsados).
 */
const KNOWN_COMPANIA_ALIASES: Record<string, string> = {
  'ASEGURADORA A 001': 'ASEGURADORA A',
  'ASEGURADORA F 002': 'ASEGURADORA F',
  'ASEGURADORA F 001': 'ASEGURADORA F',
  'ASEGURADORA G': 'ASEGURADORA G',
  'ASEGURADORA H': 'ASEGURADORA H',
  'ASEGURADORA I': 'ASEGURADORA I',
  'ASEGURADORA B RETIRO': 'ASEGURADORA B RETIRO',
  'ASEGURADORA C': 'ASEGURADORA C',
};

/**
 * Reglas de ramo, ordenadas de más específica a más general.
 * `keywords` se comparan contra el texto normalizado (sin acentos, minúsculas).
 */
const RAMO_RULES: { ramo: string; keywords: string[] }[] = [
  { ramo: 'R.C. Profesional', keywords: ['rc profesional', 'r.c profesional', 'responsabilidad civil profesional', 'resp civil profesional'] },
  { ramo: 'Vida obligatorio', keywords: ['vida obligatorio'] },
  { ramo: 'Vida colectivo', keywords: ['vida colectivo'] },
  { ramo: 'Accidentes personales', keywords: ['accidentes personales', 'acc personales', 'acc. personales', 'ap'] },
  { ramo: 'Todo riesgo operativo', keywords: ['todo riesgo'] },
  { ramo: 'Combinados e integrales', keywords: ['combinado', 'integral'] },
  { ramo: 'Caución', keywords: ['caucion'] },
  { ramo: 'Automotor', keywords: ['automotor', 'automovil'] },
  { ramo: 'Incendio', keywords: ['incendio'] },
  { ramo: 'Responsabilidad Civil', keywords: ['responsabilidad civil', 'resp', 'r.c', 'civil'] },
  { ramo: 'Técnico', keywords: ['tecnico'] },
  { ramo: 'Robo y riesgos similares', keywords: ['robo'] },
  { ramo: 'Retiro', keywords: ['retiro'] },
  { ramo: 'ART', keywords: ['art'] },
  { ramo: 'Salud', keywords: ['salud'] },
  { ramo: 'Cascos', keywords: ['casco'] },
  { ramo: 'Cristales', keywords: ['cristal', 'vitrea'] },
];

/** Keywords cortas que exigen match por palabra completa para evitar falsos positivos. */
const SHORT_KEYWORDS = new Set(['ap', 'art']);

@Injectable()
export class ImportNormalizerService {
  private readonly logger = new Logger(ImportNormalizerService.name);

  private readonly companias = new Map<string, CompaniaLite>();
  private companiasLoaded = false;

  private readonly organismosByCodigo = new Map<string, OrganismoLite>();
  private readonly organismosByNombre = new Map<string, OrganismoLite>();

  private readonly ramos = new Map<string, RamoLite>();
  private ramosLoaded = false;

  private readonly ramoMappingSeen = new Set<string>();

  private ramoResolvers: {
    byCompaniaCodigo: Map<string, string>;
    byCodigo: Map<string, string>;
  } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  // -------------------------------------------------------------------------
  // Helpers de normalización de texto
  // -------------------------------------------------------------------------

  private collapse(raw: string): string {
    return raw.replace(/\s+/g, ' ').trim();
  }

  private stripAccents(raw: string): string {
    return raw.normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  // Clave de match de compañía: sin acentos + uppercase + espacios colapsados.
  // Así "ASEGURADORA IS" matchea "ASEGURADORA I".
  private normCompania(raw: string): string {
    return this.collapse(this.stripAccents(raw)).toUpperCase();
  }

  /** Expone la clave de match de compañía (reusada por el merge de duplicadas). */
  companiaMatchKey(raw: string): string {
    return this.normCompania(raw);
  }

  private normRamo(raw: string): string {
    return this.collapse(this.stripAccents(raw).toLowerCase());
  }

  private slug(raw: string): string {
    return this.collapse(this.stripAccents(raw).toUpperCase()).replace(/\s+/g, '_');
  }

  // -------------------------------------------------------------------------
  // Compañías
  // -------------------------------------------------------------------------

  private async ensureCompanias(): Promise<void> {
    if (this.companiasLoaded) return;
    const all = await this.prisma.compania.findMany({
      select: { id: true, nombre: true, alias: true },
    });
    for (const c of all) this.indexCompania(c);
    this.companiasLoaded = true;
  }

  private indexCompania(c: CompaniaLite): void {
    this.companias.set(this.normCompania(c.nombre), c);
    for (const a of c.alias) this.companias.set(this.normCompania(a), c);
  }

  private async createCompania(nombre: string, alias: string[]): Promise<CompaniaLite> {
    const created = await this.prisma.compania.create({
      data: { nombre, alias },
      select: { id: true, nombre: true, alias: true },
    });
    this.indexCompania(created);
    this.logger.warn(`Compañía creada: "${created.nombre}"`);
    return created;
  }

  private async ensureAlias(c: CompaniaLite, alias: string): Promise<void> {
    if (c.alias.some((a) => this.normCompania(a) === alias)) return;
    c.alias.push(alias);
    this.companias.set(alias, c);
    await this.prisma.compania.update({
      where: { id: c.id },
      data: { alias: { push: alias } },
    });
  }

  /**
   * Normaliza el texto crudo de compañía y devuelve la Compania (creándola si no existe).
   */
  async normalizeCompania(raw: unknown): Promise<CompaniaResult | null> {
    const norm = this.normCompania(raw == null ? '' : String(raw));
    if (!norm) return null;
    await this.ensureCompanias();

    const canonical = KNOWN_COMPANIA_ALIASES[norm];
    if (canonical) {
      const canonNorm = this.normCompania(canonical);
      const existing = this.companias.get(canonNorm);
      if (existing) {
        await this.ensureAlias(existing, norm);
        return { id: existing.id, nombre: existing.nombre, created: false };
      }
      const created = await this.createCompania(canonical, [norm]);
      return { id: created.id, nombre: created.nombre, created: true };
    }

    const found = this.companias.get(norm);
    if (found) return { id: found.id, nombre: found.nombre, created: false };

    const created = await this.createCompania(norm, [norm]);
    return { id: created.id, nombre: created.nombre, created: true };
  }

  // -------------------------------------------------------------------------
  // Organismos
  // -------------------------------------------------------------------------

  /**
   * "759550 - MUNICIPALIDAD DE EMBALSE" -> { codigo: "759550", nombre: "MUNICIPALIDAD DE EMBALSE" }
   * Sin patrón " - " -> codigo null (se genera uno sintético por nombre, ya que el schema lo exige unique).
   * Upsert por codigo (o por nombre cuando no hay código).
   */
  async splitOrganismo(raw: unknown): Promise<OrganismoLite | null> {
    const s = raw == null ? '' : String(raw).trim();
    if (!s) return null;

    let codigo: string | null = null;
    let nombre = s;
    const idx = s.indexOf(' - ');
    if (idx !== -1) {
      codigo = s.slice(0, idx).trim() || null;
      nombre = s.slice(idx + 3).trim();
    }
    if (!nombre) nombre = s;

    if (codigo) {
      const cached = this.organismosByCodigo.get(codigo);
      if (cached) return cached;
      const org = await this.prisma.organismo.upsert({
        where: { codigo },
        update: { nombre },
        create: { codigo, nombre },
        select: { id: true, codigo: true, nombre: true },
      });
      this.organismosByCodigo.set(org.codigo, org);
      this.organismosByNombre.set(this.normCompania(org.nombre), org);
      return org;
    }

    // Sin código: matchear por nombre (código sintético determinístico).
    const nombreKey = this.normCompania(nombre);
    const cached = this.organismosByNombre.get(nombreKey);
    if (cached) return cached;
    const synthetic = `SIN-COD:${this.slug(nombre)}`;
    const org = await this.prisma.organismo.upsert({
      where: { codigo: synthetic },
      update: { nombre },
      create: { codigo: synthetic, nombre },
      select: { id: true, codigo: true, nombre: true },
    });
    this.organismosByCodigo.set(org.codigo, org);
    this.organismosByNombre.set(nombreKey, org);
    return org;
  }

  // -------------------------------------------------------------------------
  // Ramos
  // -------------------------------------------------------------------------

  private async ensureRamos(): Promise<void> {
    if (this.ramosLoaded) return;
    const all = await this.prisma.ramo.findMany({ select: { id: true, nombre: true } });
    for (const r of all) this.ramos.set(this.normRamo(r.nombre), r);
    this.ramosLoaded = true;
  }

  private matchKeyword(norm: string, kw: string): boolean {
    if (SHORT_KEYWORDS.has(kw)) {
      return new RegExp(`\\b${kw}\\b`).test(norm);
    }
    return norm.includes(kw);
  }

  /** Resuelve el nombre canónico de ramo a partir de un texto, o null. */
  private resolveRamoNombre(raw: string | null): string | null {
    if (!raw) return null;
    const norm = this.normRamo(raw);
    if (!norm) return null;
    for (const rule of RAMO_RULES) {
      if (rule.keywords.some((kw) => this.matchKeyword(norm, kw))) {
        return rule.ramo;
      }
    }
    return null;
  }

  private async ensureRamoMapping(
    companiaId: string | null,
    codigo: string | null,
    texto: string | null,
    ramoId: string,
  ): Promise<void> {
    const key = `${companiaId ?? ''}|${codigo ?? ''}|${texto ?? ''}|${ramoId}`;
    if (this.ramoMappingSeen.has(key)) return;
    this.ramoMappingSeen.add(key);
    const existing = await this.prisma.ramoMapping.findFirst({
      where: { companiaId, codigoOrigen: codigo, textoOrigen: texto, ramoId },
      select: { id: true },
    });
    if (!existing) {
      await this.prisma.ramoMapping.create({
        data: { companiaId, codigoOrigen: codigo, textoOrigen: texto, ramoId },
      });
    }
  }

  /**
   * Resuelve el ramo por keywords contra los 18 ramos canónicos.
   * Si resuelve, registra un RamoMapping(companiaId, codigoOrigen, textoOrigen, ramoId).
   */
  async normalizeRamo(
    textoRaw: unknown,
    codigoRaw: unknown,
    compania: { id: string } | null,
  ): Promise<RamoResult> {
    await this.ensureRamos();

    const texto = textoRaw == null ? null : String(textoRaw).trim() || null;
    const codigo = codigoRaw == null ? null : String(codigoRaw).trim() || null;

    // Matchear por keywords sobre el texto (columna J); si no resuelve, intentar
    // sobre el código (columna C), que en algunas compañías trae el ramo como texto.
    let ramoNombre = this.resolveRamoNombre(texto);
    if (!ramoNombre) ramoNombre = this.resolveRamoNombre(codigo);

    if (!ramoNombre) {
      if (texto || codigo) {
        this.logger.warn(`Ramo no resuelto: texto="${texto ?? ''}" codigo="${codigo ?? ''}"`);
      }
      return { ramoId: null, nombre: null, resolved: false };
    }

    const ramo = this.ramos.get(this.normRamo(ramoNombre));
    if (!ramo) {
      this.logger.warn(`Ramo canónico ausente en DB: "${ramoNombre}"`);
      return { ramoId: null, nombre: null, resolved: false };
    }

    await this.ensureRamoMapping(compania?.id ?? null, codigo, texto, ramo.id);
    return { ramoId: ramo.id, nombre: ramo.nombre, resolved: true };
  }

  /**
   * Construye (y cachea) los resolutores de ramo por código desde RamoMapping:
   * un mapa (companiaId|codigo)->ramoId y uno global codigo->ramoId, ambos por mayoría.
   */
  private async ensureRamoResolvers(): Promise<{
    byCompaniaCodigo: Map<string, string>;
    byCodigo: Map<string, string>;
  }> {
    if (this.ramoResolvers) return this.ramoResolvers;

    const mappings = await this.prisma.ramoMapping.findMany({
      select: { companiaId: true, codigoOrigen: true, ramoId: true },
    });

    const ccCounts = new Map<string, Map<string, number>>();
    const cCounts = new Map<string, Map<string, number>>();
    const add = (m: Map<string, Map<string, number>>, key: string, ramoId: string): void => {
      const inner = m.get(key) ?? new Map<string, number>();
      inner.set(ramoId, (inner.get(ramoId) ?? 0) + 1);
      m.set(key, inner);
    };

    for (const m of mappings) {
      if (!m.codigoOrigen) continue;
      if (m.companiaId) add(ccCounts, `${m.companiaId}|${m.codigoOrigen}`, m.ramoId);
      add(cCounts, m.codigoOrigen, m.ramoId);
    }

    const top = (counts: Map<string, Map<string, number>>): Map<string, string> => {
      const out = new Map<string, string>();
      for (const [key, inner] of counts) {
        let bestRamo: string | null = null;
        let bestCount = -1;
        for (const [ramoId, c] of inner) {
          if (c > bestCount || (c === bestCount && bestRamo !== null && ramoId < bestRamo)) {
            bestCount = c;
            bestRamo = ramoId;
          }
        }
        if (bestRamo) out.set(key, bestRamo);
      }
      return out;
    };

    this.ramoResolvers = { byCompaniaCodigo: top(ccCounts), byCodigo: top(cCounts) };
    return this.ramoResolvers;
  }

  /**
   * Resuelve un ramo por su código de origen vía RamoMapping: primero el mapeo
   * específico de la compañía, luego el global (por mayoría). null si no hay mapping.
   */
  async resolveRamoByCode(
    companiaId: string | null,
    codigoOrigen: string | null,
  ): Promise<string | null> {
    if (!codigoOrigen) return null;
    const { byCompaniaCodigo, byCodigo } = await this.ensureRamoResolvers();
    if (companiaId) {
      const hit = byCompaniaCodigo.get(`${companiaId}|${codigoOrigen}`);
      if (hit) return hit;
    }
    return byCodigo.get(codigoOrigen) ?? null;
  }

  // -------------------------------------------------------------------------
  // Fechas, números y estados
  // -------------------------------------------------------------------------

  private excelSerialToDate(serial: number): Date {
    // Excel epoch: 1899-12-30. 25569 = días entre epoch Excel y epoch Unix.
    return new Date(Math.round((serial - 25569) * 86400000));
  }

  private parseDateString(s: string): Date | null {
    const dmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})/);
    if (dmy) {
      const dd = Number(dmy[1]);
      const mm = Number(dmy[2]);
      let yy = Number(dmy[3]);
      if (yy < 100) yy += yy < 50 ? 2000 : 1900;
      return new Date(Date.UTC(yy, mm - 1, dd));
    }
    const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) {
      return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
    }
    const t = Date.parse(s);
    return Number.isNaN(t) ? null : new Date(t);
  }

  /**
   * Parsea una fecha cruda. Devuelve null si es inválida, year < 1990 o year >= 2099
   * (las cauciones sin vencimiento suelen cargarse con años 2099/2100).
   * El año se evalúa en UTC: exceljs entrega las fechas como UTC midnight y leerlas
   * en hora local (UTC-3) correría el año un día hacia atrás (2099-01-01 -> 2098).
   */
  cleanDate(raw: unknown): Date | null {
    if (raw == null || raw === '') return null;

    let d: Date | null = null;
    if (raw instanceof Date) {
      d = raw;
    } else if (typeof raw === 'number') {
      d = this.excelSerialToDate(raw);
    } else {
      const s = String(raw).trim();
      if (!s) return null;
      d = this.parseDateString(s);
    }

    if (!d || Number.isNaN(d.getTime())) return null;
    const year = d.getUTCFullYear();
    if (year < 1990 || year >= 2099) return null;
    return d;
  }

  /** A string, quitando el ".0" que arrastran los números desde Excel. */
  normalizeNumeroPoliza(raw: unknown): string {
    return String(raw ?? '').trim().replace(/\.0$/, '');
  }

  /** null -> VIGENTE; dias<0 -> VENCIDO; dias<=30 -> A_VENCER; resto -> VIGENTE (diff en UTC). */
  computeEstadoVigencia(finVigencia: Date | null): EstadoVigencia {
    if (!finVigencia) return EstadoVigencia.VIGENTE;
    const dias = diffCalendarDaysUTC(finVigencia, new Date());
    if (dias < 0) return EstadoVigencia.VENCIDO;
    if (dias <= 30) return EstadoVigencia.A_VENCER;
    return EstadoVigencia.VIGENTE;
  }

  /** Parsea un importe (number directo o string con separadores AR) a Prisma.Decimal. */
  parseImporte(raw: unknown): Prisma.Decimal | null {
    if (raw == null || raw === '') return null;
    if (typeof raw === 'number') {
      return Number.isFinite(raw) ? new Prisma.Decimal(raw) : null;
    }
    let s = String(raw).trim().replace(/[^\d.,-]/g, '');
    if (!s) return null;
    if (s.includes('.') && s.includes(',')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (s.includes(',')) {
      s = s.replace(',', '.');
    }
    try {
      return new Prisma.Decimal(s);
    } catch {
      return null;
    }
  }

  /** Parsea cantidad de cuotas a entero, o null. */
  parseCantidad(raw: unknown): number | null {
    if (raw == null || raw === '') return null;
    if (typeof raw === 'number') return Number.isFinite(raw) ? Math.trunc(raw) : null;
    const digits = String(raw).replace(/[^\d]/g, '');
    if (!digits) return null;
    const n = Number.parseInt(digits, 10);
    return Number.isNaN(n) ? null : n;
  }
}
