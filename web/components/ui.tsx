import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </Card>
  );
}

const ACCENTS = {
  slate: "text-slate-900",
  emerald: "text-emerald-600",
  amber: "text-amber-600",
  red: "text-red-600",
} as const;

export type Accent = keyof typeof ACCENTS;

export function StatCard({
  label,
  value,
  hint,
  accent = "slate",
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: Accent;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${ACCENTS[accent]}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </Card>
  );
}

export function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}
    >
      {label}
    </span>
  );
}

export function ErrorPanel({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <p className="font-semibold">{title}</p>
      {detail ? <p className="mt-1 text-red-600">{detail}</p> : null}
      <p className="mt-2 text-xs text-red-500">
        Verificá que el backend esté corriendo en <code>http://localhost:3000</code>.
      </p>
    </div>
  );
}
