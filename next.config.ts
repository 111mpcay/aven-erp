import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project. A stray lockfile in the home dir
  // otherwise makes Next infer the wrong root (file-tracing / build correctness).
  turbopack: { root: import.meta.dirname },

  // Build on Next 16's final caching model from day one (approved Phase 0 default).
  // Opts into Cache Components (PPR + the `use cache` directive). Note: dynamic
  // data (cookies/headers/auth) must sit behind <Suspense> or be explicitly
  // uncached, or the build will flag it.
  cacheComponents: true,
};

export default nextConfig;
