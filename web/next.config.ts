import type { NextConfig } from "next";

// El proxy a backend ya no se hace por rewrites: lo maneja el route handler
// catch-all en app/api/[...path] (inyecta el Bearer desde la cookie httpOnly).
const nextConfig: NextConfig = {};

export default nextConfig;
