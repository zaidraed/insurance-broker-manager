export interface PerfilImportReport {
  /** Identificador del perfil usado y compañía resuelta. */
  perfil: string;
  compania: string;
  /** Fila (1-based) donde se detectó el header por palabraClaveFila. */
  filaHeader: number;
  /** Filas de datos con número de póliza consideradas. */
  filasLeidas: number;
  creadas: number;
  actualizadas: number;
  /** Códigos/textos de ramo que no se pudieron resolver (se persiste ramoCodigoOrigen igual). */
  ramosNoResueltos: Set<string>;
  /** Organismos que el import tuvo que crear (no existían en la DB). */
  organismosNuevos: Set<string>;
}

/** Reporte serializable que devuelve el endpoint /import/run (Sets -> arrays). */
export interface UiImportReport {
  filasLeidas: number;
  creadas: number;
  actualizadas: number;
  ramosNoResueltos: string[];
  organismosNuevos: string[];
}
