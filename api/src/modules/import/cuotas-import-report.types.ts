export interface CuotasImportReport {
  /** Filas con Póliza (D) presentes. */
  filas: number;
  cuotasCreadas: number;
  cuotasActualizadas: number;
  polizasNoEncontradas: {
    count: number;
    muestras: string[];
  };
  /** Valores crudos distintos de la columna N (Pago) con su frecuencia — para afinar la heurística. */
  valoresDistintosPago: Record<string, number>;
  /** Filas salteadas por no tener fecha de vencimiento válida o nro de cuota. */
  filasOmitidas: number;
}
