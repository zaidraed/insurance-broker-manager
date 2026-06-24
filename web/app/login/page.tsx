"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.message ?? "No se pudo iniciar sesión");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-semibold text-slate-800">Broker Seguros</h1>
          <p className="text-sm text-slate-500">Panel interno</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block text-xs font-medium text-slate-500">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
            />
          </label>
          <label className="block text-xs font-medium text-slate-500">
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2 text-sm text-slate-700 focus:border-slate-400 focus:outline-none"
            />
          </label>
          {error ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600 ring-1 ring-inset ring-red-600/20">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="h-9 w-full rounded-md bg-slate-800 text-sm font-medium text-white hover:enabled:bg-slate-700 disabled:opacity-50"
          >
            {loading ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
