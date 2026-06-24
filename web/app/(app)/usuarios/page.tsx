"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { RolUsuario, Usuario } from "@/lib/types";
import { Badge, ErrorPanel } from "@/components/ui";

const ROLES: RolUsuario[] = ["ADMIN", "OPERADOR"];

function rolBadge(rol: RolUsuario) {
  return rol === "ADMIN"
    ? { label: "ADMIN", className: "bg-indigo-50 text-indigo-700 ring-indigo-600/20" }
    : { label: "OPERADOR", className: "bg-slate-100 text-slate-600 ring-slate-500/20" };
}

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // form crear
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rol, setRol] = useState<RolUsuario>("OPERADOR");
  const [creating, setCreating] = useState(false);

  // reset password inline
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetValue, setResetValue] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Usuario[]>("/usuarios");
      setUsuarios(data);
      setForbidden(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setForbidden(true);
      else setError(err instanceof ApiError ? `${err.status} · ${err.message}` : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const patch = async (id: string, body: Record<string, unknown>) => {
    setActionError(null);
    try {
      const updated = await api.patch<Usuario>(`/usuarios/${id}`, body);
      setUsuarios((prev) => prev.map((u) => (u.id === id ? updated : u)));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : String(err));
    }
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setActionError(null);
    try {
      await api.post("/usuarios", { nombre, email, password, rol });
      setNombre("");
      setEmail("");
      setPassword("");
      setRol("OPERADOR");
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  const onReset = async (id: string) => {
    if (resetValue.length < 6) {
      setActionError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    await patch(id, { password: resetValue });
    setResetFor(null);
    setResetValue("");
  };

  if (forbidden) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <h1 className="text-lg font-semibold text-slate-800">Usuarios</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          No tenés permisos para gestionar usuarios (solo ADMIN).
        </div>
      </div>
    );
  }

  const ctrl =
    "h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none";

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-lg font-semibold text-slate-800">Usuarios</h1>

      {/* Crear */}
      <form onSubmit={onCreate} className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <input className={`${ctrl} flex-1 min-w-40`} placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        <input className={`${ctrl} flex-1 min-w-48`} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className={`${ctrl} min-w-40`} type="password" placeholder="Contraseña (≥6)" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
        <select className={ctrl} value={rol} onChange={(e) => setRol(e.target.value as RolUsuario)}>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <button type="submit" disabled={creating} className="h-9 rounded-md bg-slate-800 px-3 text-sm font-medium text-white hover:enabled:bg-slate-700 disabled:opacity-50">
          {creating ? "Creando…" : "Crear usuario"}
        </button>
      </form>

      {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}
      {error ? <ErrorPanel title="No se pudieron cargar los usuarios" detail={error} /> : null}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2 font-medium">Nombre</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Rol</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={5} className="px-3 py-10 text-center text-slate-400">Cargando…</td></tr>
            ) : usuarios.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-10 text-center text-slate-400">Sin usuarios.</td></tr>
            ) : (
              usuarios.map((u) => {
                const rb = rolBadge(u.rol);
                return (
                  <tr key={u.id} className="align-middle">
                    <td className="px-3 py-2 font-medium text-slate-800">{u.nombre}</td>
                    <td className="px-3 py-2 text-slate-600">{u.email}</td>
                    <td className="px-3 py-2">
                      <select
                        value={u.rol}
                        onChange={(e) => patch(u.id, { rol: e.target.value })}
                        className="rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-xs text-slate-700"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      {u.activo ? (
                        <Badge label="Activo" className="bg-emerald-50 text-emerald-700 ring-emerald-600/20" />
                      ) : (
                        <Badge label="Inactivo" className="bg-slate-100 text-slate-500 ring-slate-400/20" />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => patch(u.id, { activo: !u.activo })}
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                        >
                          {u.activo ? "Desactivar" : "Activar"}
                        </button>
                        {resetFor === u.id ? (
                          <span className="flex items-center gap-1">
                            <input
                              type="password"
                              autoFocus
                              placeholder="Nueva (≥6)"
                              value={resetValue}
                              onChange={(e) => setResetValue(e.target.value)}
                              className="h-7 w-32 rounded-md border border-slate-300 px-1.5 text-xs"
                            />
                            <button type="button" onClick={() => onReset(u.id)} className="rounded-md bg-slate-800 px-2 py-1 text-xs text-white hover:bg-slate-700">OK</button>
                            <button type="button" onClick={() => { setResetFor(null); setResetValue(""); }} className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-500">✕</button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => { setResetFor(u.id); setResetValue(""); setActionError(null); }}
                            className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                          >
                            Resetear pass
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
