import { z } from 'zod';

/**
 * Esquema de variables de entorno validado con zod.
 * Se ejecuta al arrancar la app via @nestjs/config (validate).
 */
export const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL es obligatoria')
    .url('DATABASE_URL debe ser una URL válida de PostgreSQL'),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET es obligatoria'),
  // Se usan en el seed para crear el usuario ADMIN inicial.
  // En producción son obligatorias (ver superRefine).
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(1).optional(),
}).superRefine((env, ctx) => {
  if (env.NODE_ENV === 'production') {
    if (!env.ADMIN_EMAIL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ADMIN_EMAIL'],
        message: 'ADMIN_EMAIL es obligatoria en producción',
      });
    }
    if (!env.ADMIN_PASSWORD) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ADMIN_PASSWORD'],
        message: 'ADMIN_PASSWORD es obligatoria en producción',
      });
    }
  }
});

export type Env = z.infer<typeof envSchema>;

/**
 * Función de validación usada por ConfigModule.forRoot({ validate }).
 * Lanza un error legible si falta o es inválida alguna variable.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`❌ Variables de entorno inválidas:\n${issues}`);
  }

  return parsed.data;
}
