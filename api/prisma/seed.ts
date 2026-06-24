import { PrismaClient, RolUsuario } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// 1. Ramos canónicos
// ---------------------------------------------------------------------------
const RAMOS = [
  'Automotor',
  'Caución',
  'Incendio',
  'Accidentes personales',
  'Responsabilidad Civil',
  'Combinados e integrales',
  'Técnico',
  'Robo y riesgos similares',
  'Retiro',
  'ART',
  'Vida obligatorio',
  'Vida colectivo',
  'Salud',
  'Cascos',
  'Cristales',
  'Todo riesgo operativo',
  'R.C. Profesional',
  'Sepelio',
];

// ---------------------------------------------------------------------------
// 2. Compañías (los import profiles requieren companiaId)
// ---------------------------------------------------------------------------
const COMPANIAS: { nombre: string; alias: string[] }[] = [
  { nombre: 'ASEGURADORA A', alias: ['ASEGURADORA A', 'ASEGURADORA A 001'] },
  { nombre: 'ASEGURADORA B', alias: ['ASEGURADORA B'] },
  { nombre: 'ASEGURADORA C', alias: ['ASEGURADORA C'] },
  { nombre: 'ASEGURADORA D', alias: ['ASEGURADORA D'] },
  { nombre: 'ASEGURADORA E', alias: ['ASEGURADORA E'] },
  { nombre: 'ASEGURADORA F', alias: ['ASEGURADORA F', 'ASEGURADORA F 001', 'ASEGURADORA F 002'] },
];

// ---------------------------------------------------------------------------
// 3. CompaniaImportProfile (de CONFIG_SISTEMA)
//    Columnas: colPoliza, colTomador, colRamo, colInicioVig, colFinVig,
//              colObservaciones, colBienAsegurado  ("-" => null)
// ---------------------------------------------------------------------------
interface ProfileSeed {
  compania: string;
  identificador: string;
  palabraClaveFila: string;
  colPoliza: string;
  colTomador: string;
  colRamo: string | null;
  colInicioVig: string;
  colFinVig: string | null;
  colObservaciones: string | null;
  colBienAsegurado: string | null;
  colFechaFacturado: string | null;
  colMedioPago: string | null;
}

const IMPORT_PROFILES: ProfileSeed[] = [
  // ASEGURADORA A 001 | Rama | B,H,A,E,F,Q,G
  {
    compania: 'ASEGURADORA A',
    identificador: 'ASEGURADORA A 001',
    palabraClaveFila: 'Rama',
    colPoliza: 'B',
    colTomador: 'H',
    colRamo: 'A',
    colInicioVig: 'E',
    colFinVig: 'F',
    colObservaciones: 'Q',
    colBienAsegurado: 'G',
    colFechaFacturado: 'R',
    colMedioPago: 'M',
  },
  // ASEGURADORA B | CLIENTE | H,A,D,K,L,P,G
  {
    compania: 'ASEGURADORA B',
    identificador: 'ASEGURADORA B',
    palabraClaveFila: 'CLIENTE',
    colPoliza: 'H',
    colTomador: 'A',
    colRamo: 'D',
    colInicioVig: 'K',
    colFinVig: 'L',
    colObservaciones: 'P',
    colBienAsegurado: 'G',
    colFechaFacturado: null,
    colMedioPago: null,
  },
  // ASEGURADORA C | Asegurado | H,L,K,C,D,-,A
  {
    compania: 'ASEGURADORA C',
    identificador: 'ASEGURADORA C',
    palabraClaveFila: 'Asegurado',
    colPoliza: 'H',
    colTomador: 'L',
    colRamo: 'K',
    colInicioVig: 'C',
    colFinVig: 'D',
    colObservaciones: null,
    colBienAsegurado: 'A',
    colFechaFacturado: null,
    colMedioPago: null,
  },
  // ASEGURADORA D | Poliza | A,D,-,C,-,O,K
  {
    compania: 'ASEGURADORA D',
    identificador: 'ASEGURADORA D',
    palabraClaveFila: 'Poliza',
    colPoliza: 'A',
    colTomador: 'D',
    colRamo: null,
    colInicioVig: 'C',
    colFinVig: null,
    colObservaciones: 'O',
    colBienAsegurado: 'K',
    colFechaFacturado: null,
    colMedioPago: null,
  },
  // ASEGURADORA E | Póliza | A,D,-,K,L,-,I
  {
    compania: 'ASEGURADORA E',
    identificador: 'ASEGURADORA E',
    palabraClaveFila: 'Póliza',
    colPoliza: 'A',
    colTomador: 'D',
    colRamo: null,
    colInicioVig: 'K',
    colFinVig: 'L',
    colObservaciones: null,
    colBienAsegurado: 'I',
    colFechaFacturado: null,
    colMedioPago: null,
  },
  // ASEGURADORA F 001 | Ramo | E,M,B,H,I,-,-
  {
    compania: 'ASEGURADORA F',
    identificador: 'ASEGURADORA F 001',
    palabraClaveFila: 'Ramo',
    colPoliza: 'E',
    colTomador: 'M',
    colRamo: 'B',
    colInicioVig: 'H',
    colFinVig: 'I',
    colObservaciones: null,
    colBienAsegurado: null,
    colFechaFacturado: null,
    colMedioPago: null,
  },
  // ASEGURADORA F 002 | Ramo | E,M,B,H,I,-,-
  {
    compania: 'ASEGURADORA F',
    identificador: 'ASEGURADORA F 002',
    palabraClaveFila: 'Ramo',
    colPoliza: 'E',
    colTomador: 'M',
    colRamo: 'B',
    colInicioVig: 'H',
    colFinVig: 'I',
    colObservaciones: null,
    colBienAsegurado: null,
    colFechaFacturado: null,
    colMedioPago: null,
  },
];

async function main(): Promise<void> {
  // Ramos canónicos (idempotente por nombre @unique)
  for (const nombre of RAMOS) {
    await prisma.ramo.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });
  }

  // Compañías (idempotente por nombre @unique)
  for (const c of COMPANIAS) {
    await prisma.compania.upsert({
      where: { nombre: c.nombre },
      update: { alias: c.alias },
      create: { nombre: c.nombre, alias: c.alias },
    });
  }

  // Mapa nombre -> id de compañía
  const companias = await prisma.compania.findMany();
  const companiaIdByNombre = new Map(companias.map((c) => [c.nombre, c.id]));

  // Import profiles: se regeneran completos (no tienen clave natural única)
  await prisma.companiaImportProfile.deleteMany();
  for (const p of IMPORT_PROFILES) {
    const companiaId = companiaIdByNombre.get(p.compania);
    if (!companiaId) {
      throw new Error(`Compañía no encontrada para import profile: ${p.compania}`);
    }
    await prisma.companiaImportProfile.create({
      data: {
        companiaId,
        identificador: p.identificador,
        palabraClaveFila: p.palabraClaveFila,
        colPoliza: p.colPoliza,
        colTomador: p.colTomador,
        colRamo: p.colRamo,
        colInicioVig: p.colInicioVig,
        colFinVig: p.colFinVig,
        colObservaciones: p.colObservaciones,
        colBienAsegurado: p.colBienAsegurado,
        colFechaFacturado: p.colFechaFacturado,
        colMedioPago: p.colMedioPago,
      },
    });
  }

  // Usuario ADMIN inicial (desde env, sin hardcodear credenciales)
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await prisma.usuario.upsert({
      where: { email: adminEmail },
      update: { passwordHash, rol: RolUsuario.ADMIN, activo: true },
      create: {
        nombre: 'Administrador',
        email: adminEmail,
        passwordHash,
        rol: RolUsuario.ADMIN,
        activo: true,
      },
    });
    console.log(`✅ Usuario ADMIN upserteado: ${adminEmail}`);
  } else {
    console.warn('⚠️  ADMIN_EMAIL/ADMIN_PASSWORD no seteados: no se creó usuario ADMIN.');
  }

  console.log(
    `✅ Seed OK: ${RAMOS.length} ramos, ${COMPANIAS.length} compañías, ${IMPORT_PROFILES.length} import profiles`,
  );
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
