import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ImportNormalizerService } from './import-normalizer.service';

interface CompaniaLite {
  id: string;
  nombre: string;
  alias: string[];
}

export interface MergeDetalle {
  canonical: string;
  duplicadas: string[];
  polizasMovidas: number;
  colisionesEliminadas: number;
  profilesMovidos: number;
  mappingsMovidos: number;
}

export interface MergeReport {
  totalGruposColisionados: number;
  totalDuplicadasEliminadas: number;
  merges: MergeDetalle[];
}

@Injectable()
export class CompaniasMergeService {
  private readonly logger = new Logger(CompaniasMergeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly normalizer: ImportNormalizerService,
  ) {}

  private hasAccents(s: string): boolean {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '') !== s;
  }

  private pickCanonical(group: CompaniaLite[], countById: Map<string, number>): CompaniaLite {
    return [...group].sort((a, b) => {
      const ca = countById.get(a.id) ?? 0;
      const cb = countById.get(b.id) ?? 0;
      if (cb !== ca) return cb - ca; // más pólizas primero
      const aAcc = this.hasAccents(a.nombre);
      const bAcc = this.hasAccents(b.nombre);
      if (aAcc !== bAcc) return aAcc ? -1 : 1; // nombre con acentos correctos primero
      return a.nombre.localeCompare(b.nombre);
    })[0];
  }

  async run(): Promise<MergeReport> {
    const companias = await this.prisma.compania.findMany({
      select: { id: true, nombre: true, alias: true },
    });
    const counts = await this.prisma.poliza.groupBy({ by: ['companiaId'], _count: { _all: true } });
    const countById = new Map(counts.map((c) => [c.companiaId, c._count._all]));

    const groups = new Map<string, CompaniaLite[]>();
    for (const c of companias) {
      const key = this.normalizer.companiaMatchKey(c.nombre);
      const list = groups.get(key) ?? [];
      list.push(c);
      groups.set(key, list);
    }

    const report: MergeReport = {
      totalGruposColisionados: 0,
      totalDuplicadasEliminadas: 0,
      merges: [],
    };

    for (const group of groups.values()) {
      if (group.length < 2) continue;
      report.totalGruposColisionados++;

      const canonical = this.pickCanonical(group, countById);
      const dups = group.filter((c) => c.id !== canonical.id);

      const detalle: MergeDetalle = {
        canonical: canonical.nombre,
        duplicadas: dups.map((d) => d.nombre),
        polizasMovidas: 0,
        colisionesEliminadas: 0,
        profilesMovidos: 0,
        mappingsMovidos: 0,
      };

      // Set de números de póliza ya presentes en la canónica (se actualiza al mover).
      const canonNumeros = new Set(
        (
          await this.prisma.poliza.findMany({
            where: { companiaId: canonical.id },
            select: { numero: true },
          })
        ).map((p) => p.numero),
      );

      const aliasMerged = new Set(canonical.alias.map((a) => a));

      for (const dup of dups) {
        const dupPolizas = await this.prisma.poliza.findMany({
          where: { companiaId: dup.id },
          select: { id: true, numero: true },
        });

        const movibles: string[] = [];
        const colisiones: string[] = [];
        for (const p of dupPolizas) {
          if (canonNumeros.has(p.numero)) {
            colisiones.push(p.id); // misma póliza ya existe en la canónica
          } else {
            movibles.push(p.id);
            canonNumeros.add(p.numero);
          }
        }

        if (colisiones.length > 0) {
          await this.prisma.poliza.deleteMany({ where: { id: { in: colisiones } } });
          detalle.colisionesEliminadas += colisiones.length;
        }
        if (movibles.length > 0) {
          await this.prisma.poliza.updateMany({
            where: { id: { in: movibles } },
            data: { companiaId: canonical.id },
          });
          detalle.polizasMovidas += movibles.length;
        }

        const prof = await this.prisma.companiaImportProfile.updateMany({
          where: { companiaId: dup.id },
          data: { companiaId: canonical.id },
        });
        detalle.profilesMovidos += prof.count;

        const maps = await this.prisma.ramoMapping.updateMany({
          where: { companiaId: dup.id },
          data: { companiaId: canonical.id },
        });
        detalle.mappingsMovidos += maps.count;

        for (const a of dup.alias) aliasMerged.add(a);
        aliasMerged.add(this.normalizer.companiaMatchKey(dup.nombre));

        await this.prisma.compania.delete({ where: { id: dup.id } });
        report.totalDuplicadasEliminadas++;
      }

      await this.prisma.compania.update({
        where: { id: canonical.id },
        data: { alias: [...aliasMerged] },
      });

      this.logger.log(
        `Merge: "${detalle.canonical}" <- [${detalle.duplicadas.join(', ')}] ` +
          `(pólizas ${detalle.polizasMovidas}, colisiones ${detalle.colisionesEliminadas})`,
      );
      report.merges.push(detalle);
    }

    return report;
  }
}
