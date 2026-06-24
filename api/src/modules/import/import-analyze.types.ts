import { ImportTipo, ResolvedImportMapping } from './import-mapping.types';

export interface AnalyzeHeader {
  /** Letra de columna ("A", "M", ...). */
  col: string;
  /** Texto del header tal como aparece en la planilla. */
  nombre: string;
}

/** Campo canónico de un tipo de import (para que la UI arme la tabla de mapeo). */
export interface CampoCanonico {
  /** Clave del campo (colPoliza, colImporte, ...). */
  key: string;
  /** Etiqueta legible. */
  label: string;
  /** Si es obligatorio. */
  req: boolean;
}

export interface CompaniaSugerida {
  id: string;
  nombre: string;
  /** Cómo se detectó (identificador/productor/nombre encontrado en el archivo). */
  match: string;
}

export interface AnalyzeResult {
  /** Tipo de import analizado. */
  tipo: ImportTipo;
  /** Campos canónicos a mapear para este tipo. */
  campos: CampoCanonico[];
  /** Nombres de todas las solapas del archivo. */
  sheets: string[];
  /** Solapa donde se detectó el header. */
  sheet: string;
  /** Fila (1-based) del header detectado. */
  headerRowDetectada: number;
  /** Headers de la fila detectada (columnas con texto). */
  headers: AnalyzeHeader[];
  /** Hasta ~8 filas de datos posteriores al header, keyed por letra de columna. */
  sampleRows: Record<string, unknown>[];
  /** Compañía sugerida (solo POLIZAS; DEUDA es multi-compañía -> null). */
  companiaSugerida: CompaniaSugerida | null;
  /** Perfil ya guardado para esa compañía (solo POLIZAS), si existe. */
  profileExistente: ResolvedImportMapping | null;
  /** Mapping sugerido: campo canónico -> letra de columna. */
  mappingSugerido: Record<string, string>;
}
