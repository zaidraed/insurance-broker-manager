import {
  PrismaClient,
  RolUsuario,
  EstadoVigencia,
  EstadoPago,
  CanalContacto,
  TipoSeguimiento,
} from '@prisma/client';
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

  // -------------------------------------------------------------------------
  // Datos DEMO (pólizas, cuotas, cobranza, seguimientos) — re-ejecutable.
  // Resetea solo lo transaccional; mantiene compañías/ramos/profiles/usuarios.
  // -------------------------------------------------------------------------
  await prisma.seguimiento.deleteMany();
  await prisma.poliza.deleteMany(); // cascada: cuota, cobranzaTracking, siniestro
  await prisma.contacto.deleteMany();
  await prisma.direccion.deleteMany();
  await prisma.organismo.deleteMany();
  await prisma.prospecto.deleteMany();

  // PRNG determinístico
  let _s = 20260624;
  const rng = (): number => {
    _s = (_s * 1103515245 + 12345) & 0x7fffffff;
    return _s / 0x7fffffff;
  };
  const randInt = (a: number, b: number): number => a + Math.floor(rng() * (b - a + 1));
  const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const daysFromNow = (d: number): Date => {
    const x = new Date();
    x.setDate(x.getDate() + d);
    return x;
  };

  // Operador demo (además del ADMIN de env)
  const operadorHash = await bcrypt.hash('Demo1234!', 10);
  await prisma.usuario.upsert({
    where: { email: 'operador@brokerseguros.demo' },
    update: { passwordHash: operadorHash, rol: RolUsuario.OPERADOR, activo: true },
    create: {
      nombre: 'Operadora Demo',
      email: 'operador@brokerseguros.demo',
      passwordHash: operadorHash,
      rol: RolUsuario.OPERADOR,
      activo: true,
    },
  });
  const responsables = (await prisma.usuario.findMany({ select: { id: true } })).map((u) => u.id);

  const ramos = await prisma.ramo.findMany();
  const companiaIds = [...companiaIdByNombre.values()];

  // Organismos + direcciones
  const organismos: string[] = [];
  const orgNames = ['Cooperativa Demo Ltda.', 'Municipalidad de San Ejemplo', 'Sindicato Demo'];
  for (const [i, nombre] of orgNames.entries()) {
    const org = await prisma.organismo.create({ data: { codigo: `ORG${i + 1}`, nombre } });
    await prisma.direccion.create({ data: { organismoId: org.id, nombre: 'Casa Central' } });
    organismos.push(org.id);
  }

  const TOMADORES = [
    'Juan Pérez', 'María González', 'Carlos Rodríguez', 'Lucía Fernández',
    'Transporte del Sur S.A.', 'Almacén La Esquina SRL', 'Estudio Jurídico Díaz',
    'Pedro Sánchez', 'Ana Martínez', 'Constructora Andes SRL', 'Gómez e Hijos SA', 'Valentina Romero',
  ];
  const BIENES = ['Vehículo Toyota Hilux', 'Inmueble Av. Central 742', 'Maquinaria agrícola', 'Local comercial', 'Flota de 3 unidades', 'Equipo electrónico'];
  const MEDIOS = ['Débito automático', 'Tarjeta de crédito', 'Transferencia', 'Efectivo'];

  let creadas = 0;
  for (let i = 0; i < 55; i++) {
    const r = rng();
    let vigenciaFin: Date;
    let estadoVigencia: EstadoVigencia;
    if (r < 0.2) {
      vigenciaFin = daysFromNow(-randInt(5, 120));
      estadoVigencia = EstadoVigencia.VENCIDO;
    } else if (r < 0.4) {
      vigenciaFin = daysFromNow(randInt(1, 30));
      estadoVigencia = EstadoVigencia.A_VENCER;
    } else {
      vigenciaFin = daysFromNow(randInt(45, 330));
      estadoVigencia = EstadoVigencia.VIGENTE;
    }
    const vigenciaInicio = new Date(vigenciaFin);
    vigenciaInicio.setFullYear(vigenciaInicio.getFullYear() - 1);
    const cantCuotas = pick([1, 3, 6, 12]);
    const importe = randInt(15000, 800000);

    const pr = rng();
    let estadoPago: EstadoPago;
    let deudaMonto: number | null = null;
    if (pr < 0.5) estadoPago = EstadoPago.PAGADA;
    else if (pr < 0.7) { estadoPago = EstadoPago.IMPAGA; deudaMonto = importe; }
    else if (pr < 0.85) { estadoPago = EstadoPago.PARCIAL; deudaMonto = Math.round(importe * (0.3 + rng() * 0.4)); }
    else estadoPago = EstadoPago.NA;

    const poliza = await prisma.poliza.create({
      data: {
        numero: `POL-${String(1000 + i)}`,
        companiaId: pick(companiaIds),
        organismoId: pick(organismos),
        ramoId: pick(ramos).id,
        tomador: pick(TOMADORES),
        bienAsegurado: pick(BIENES),
        vigenciaInicio,
        vigenciaFin,
        importe,
        cantCuotas,
        medioPago: pick(MEDIOS),
        estadoVigencia,
        estadoPago,
        deudaMonto,
        deudaActualizadaAl: deudaMonto ? daysFromNow(-randInt(1, 20)) : null,
        responsableId: pick(responsables),
      },
    });
    creadas++;

    // Cuotas
    const cuotaImporte = Math.round(importe / cantCuotas);
    const pagadasHasta =
      estadoPago === EstadoPago.PAGADA ? cantCuotas : estadoPago === EstadoPago.PARCIAL ? Math.floor(cantCuotas / 2) : 0;
    for (let c = 0; c < cantCuotas; c++) {
      const vencimiento = new Date(vigenciaInicio);
      vencimiento.setMonth(vencimiento.getMonth() + c);
      const pagada = c < pagadasHasta;
      await prisma.cuota.create({
        data: { polizaId: poliza.id, nroCuota: c + 1, vencimiento, importe: cuotaImporte, pagada, fechaPago: pagada ? vencimiento : null },
      });
    }

    // Cobranza tracking (solo con deuda)
    if (deudaMonto) {
      await prisma.cobranzaTracking.create({
        data: {
          polizaId: poliza.id,
          fechaEnvioDoc: daysFromNow(-randInt(3, 30)),
          ultimaActualizacion: daysFromNow(-randInt(1, 12)),
          queSigue: pick(['Esperando comprobante', 'Reenviar aviso de pago', 'Llamar al tomador', 'Coordinar refinanciación']),
          revisar: rng() < 0.5,
        },
      });
    }

    // Seguimientos esporádicos
    if (rng() < 0.4) {
      await prisma.seguimiento.create({
        data: {
          polizaId: poliza.id,
          usuarioId: pick(responsables),
          canal: pick([CanalContacto.TELEFONO, CanalContacto.WHATSAPP, CanalContacto.MAIL]),
          tipo: pick([TipoSeguimiento.RENOVACION, TipoSeguimiento.COBRANZA, TipoSeguimiento.NOTA]),
          texto: pick([
            'Cliente contactado, evalúa renovación.',
            'Se envió aviso de vencimiento.',
            'Pago comprometido para fin de mes.',
            'Solicita cobertura adicional.',
          ]),
        },
      });
    }
  }

  console.log(
    `✅ Seed OK: ${RAMOS.length} ramos, ${COMPANIAS.length} compañías, ${IMPORT_PROFILES.length} import profiles`,
  );
  console.log(`✅ Demo: ${organismos.length} organismos, ${creadas} pólizas con cuotas/cobranza/seguimientos`);
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
