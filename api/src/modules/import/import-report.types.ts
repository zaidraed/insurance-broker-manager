export interface DescartadaInfo {
  fila: number;
  motivo: string;
}

export interface ImportReport {
  /** Filas con datos consideradas (excluye filas totalmente vacías). */
  total: number;
  creadas: number;
  actualizadas: number;
  descartadas: DescartadaInfo[];
  /** Textos/códigos de ramo que no se pudieron resolver. */
  ramosNoResueltos: Set<string>;
  /** Nombres de compañías que el importador tuvo que crear. */
  companiasCreadas: Set<string>;
}
