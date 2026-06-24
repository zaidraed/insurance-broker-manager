/**
 * Reporte serializable del import de DEUDA scoped-por-compañía (endpoint UI).
 * El reset solo toca las compañías presentes en el archivo, así una carga
 * parcial no pisa la impaga de otras compañías.
 */
export interface DeudaScopedReport {
  /** Filas con número de póliza consideradas. */
  filasLeidas: number;
  /** Grupos (compañía, número) con deuda en el archivo. */
  polizasConDeuda: number;
  /** Pólizas efectivamente marcadas IMPAGA (matchearon en la DB). */
  marcadasImpaga: number;
  noEncontradas: {
    count: number;
    muestras: string[];
  };
  /** Suma de deudaMonto aplicada en la DB (Decimal como string). */
  deudaTotalAplicada: string;
  /** Nombres de las compañías presentes en el archivo (scope del reset). */
  companiasEnArchivo: string[];
}

export interface DeudaImportReport {
  /** Filas con Póliza (A) presentes. */
  filas: number;
  /** Grupos (compañía, número) con deuda en la solapa. */
  polizasConDeuda: number;
  /** Pólizas efectivamente marcadas IMPAGA (matchearon en la DB). */
  marcadasImpaga: number;
  noEncontradas: {
    count: number;
    muestras: string[];
  };
  /** Suma de deudaMonto aplicada en la DB (Decimal como string). */
  deudaTotal: string;
}
