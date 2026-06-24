export interface CodigoNoMapeado {
  compania: string;
  codigo: string | null;
  count: number;
}

export interface BackfillRamosReport {
  sinRamoAntes: number;
  resueltas: number;
  siguenSinRamo: number;
  codigosNoMapeados: CodigoNoMapeado[];
}
