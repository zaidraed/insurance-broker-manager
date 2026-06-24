export type EstadoVigencia = "VIGENTE" | "A_VENCER" | "VENCIDO";
export type EstadoPago = "PAGADA" | "IMPAGA" | "PARCIAL" | "NA";
export type CanalContacto = "TELEFONO" | "WHATSAPP" | "MAIL" | "OTRO";
export type TipoSeguimiento = "RENOVACION" | "ENDOSO" | "COBRANZA" | "SINIESTRO" | "NOTA";

export type RolUsuario = "ADMIN" | "OPERADOR";

export interface AuthUser {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
}

export interface Ref {
  id: string;
  nombre: string;
}

export interface CompaniaCount {
  companiaId: string;
  nombre: string;
  count: number;
}

export interface ResumenResponse {
  porEstadoVigencia: Record<EstadoVigencia, number>;
  porCompania: CompaniaCount[];
  proximasAVencer: { en30: number; en60: number; en90: number };
  // Decimal serializado como string desde la API.
  deudaTotal: string;
  cantidadImpaga: number;
}

export interface PolizaListItem {
  id: string;
  numero: string;
  estadoVigencia: EstadoVigencia;
  estadoPago: EstadoPago;
  tomador: string | null;
  bienAsegurado: string | null;
  importe: string | null;
  deudaMonto: string | null;
  deudaActualizadaAl: string | null;
  vigenciaInicio: string | null;
  vigenciaFin: string | null;
  compania: Ref;
  organismo: Ref | null;
  ramo: Ref | null;
}

export interface CobranzaRevisarItem {
  polizaId: string;
  numero: string;
  organismo: Ref | null;
  ultimaActualizacion: string | null;
  queSigue: string | null;
  diasSinRevisar: number | null;
}

export interface RefacturacionItem {
  cuotaId: string;
  nroCuota: number;
  poliza: { id: string; numero: string };
  organismo: Ref | null;
  importe: string | null;
  vencimiento: string;
  diasParaVencer: number;
}

export interface RefacturacionResponse {
  dias: number;
  counts: { vencidasImpagas: number; proximas30: number; proximas60: number };
  data: RefacturacionItem[];
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
}

// ---- Import por UI ----

/** Tipo de reporte a importar. */
export type ImportTipo = "POLIZAS" | "DEUDA";

/** Mapping genérico: campo canónico -> letra de columna. */
export type ImportMapping = Record<string, string>;

/** Campo canónico de un tipo de import (metadata para armar la tabla de mapeo). */
export interface CampoCanonico {
  key: string;
  label: string;
  req: boolean;
}

export interface AnalyzeHeader {
  col: string;
  nombre: string;
}

export interface CompaniaSugerida {
  id: string;
  nombre: string;
  match: string;
}

export interface AnalyzeResult {
  tipo: ImportTipo;
  campos: CampoCanonico[];
  sheets: string[];
  sheet: string;
  headerRowDetectada: number;
  headers: AnalyzeHeader[];
  sampleRows: Record<string, unknown>[];
  companiaSugerida: CompaniaSugerida | null;
  profileExistente: unknown | null;
  mappingSugerido: ImportMapping;
}

/** Report del run POLIZAS. */
export interface ImportRunReport {
  filasLeidas: number;
  creadas: number;
  actualizadas: number;
  ramosNoResueltos: string[];
  organismosNuevos: string[];
}

/** Report del run DEUDA. */
export interface DeudaRunReport {
  filasLeidas: number;
  polizasConDeuda: number;
  marcadasImpaga: number;
  noEncontradas: { count: number; muestras: string[] };
  deudaTotalAplicada: string;
  companiasEnArchivo: string[];
}

export interface Direccion {
  id: string;
  nombre: string;
  organismoId: string;
}

export interface Cuota {
  id: string;
  polizaId: string;
  nroCuota: number;
  vencimiento: string;
  importe: string | null;
  pagada: boolean;
  fechaPago: string | null;
}

export interface Seguimiento {
  id: string;
  polizaId: string | null;
  organismoId: string | null;
  usuarioId: string | null;
  fecha: string;
  canal: CanalContacto;
  tipo: TipoSeguimiento;
  texto: string;
}

export interface CobranzaTracking {
  id: string;
  polizaId: string;
  fechaEnvioDoc: string | null;
  ultimaActualizacion: string | null;
  queSigue: string | null;
  revisar: boolean;
}

export interface PolizaDetail {
  id: string;
  numero: string;
  estadoVigencia: EstadoVigencia;
  estadoPago: EstadoPago;
  tomador: string | null;
  bienAsegurado: string | null;
  importe: string | null;
  deudaMonto: string | null;
  deudaObs: string | null;
  deudaActualizadaAl: string | null;
  vigenciaInicio: string | null;
  vigenciaFin: string | null;
  observacionRaw: string | null;
  compania: Ref;
  organismo: (Ref & { codigo: string }) | null;
  direccion: Direccion | null;
  ramo: Ref | null;
  responsable: Usuario | null;
  cuotas: Cuota[];
  seguimientos: Seguimiento[];
  cobranzaTracking: CobranzaTracking | null;
}
