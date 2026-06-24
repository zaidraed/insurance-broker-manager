/** Tipos de import soportados por la UI. */
export type ImportTipo = 'POLIZAS' | 'DEUDA';

/**
 * Mapping resuelto de columnas para el import por perfil.
 * Es la entrada genérica del core: o bien se arma desde un CompaniaImportProfile
 * guardado (path CLI) o desde el body del endpoint /import/run (path UI).
 *
 * La fila del header se ubica de dos formas, en este orden de prioridad:
 *  - `headerRow` (1-based) explícito, opcionalmente acotado por `sheet`.
 *  - `palabraClaveFila`: se busca esa palabra en las primeras filas de cada solapa.
 */
export interface ResolvedImportMapping {
  companiaId: string;
  palabraClaveFila?: string | null;
  headerRow?: number | null;
  sheet?: string | null;
  colPoliza: string;
  colTomador: string;
  colRamo?: string | null;
  colInicio: string;
  colFin?: string | null;
  colObs?: string | null;
  colBien?: string | null;
  colFechaFacturado?: string | null;
  colMedioPago?: string | null;
}

/** Campos canónicos -> letra de columna sugerida (todos opcionales). */
export interface SuggestedMapping {
  colPoliza?: string;
  colTomador?: string;
  colRamo?: string;
  colInicio?: string;
  colFin?: string;
  colObs?: string;
  colBien?: string;
  colFechaFacturado?: string;
  colMedioPago?: string;
}

/**
 * Mapping resuelto para el import de DEUDA. Multi-compañía: la compañía sale de
 * una columna del archivo, no de un parámetro. `colObs2` existe para que el CLI
 * conserve el comportamiento histórico (observaciones = col E + col F).
 */
export interface ResolvedDeudaMapping {
  sheet?: string | null;
  headerRow?: number | null;
  palabraClaveFila?: string | null;
  colPoliza: string;
  colCompania: string;
  colImporte: string;
  colObs?: string | null;
  colObs2?: string | null;
}
