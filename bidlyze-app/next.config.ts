import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";

// Explicitly load .env.local so vars are available for client-side inlining
loadEnvConfig(process.cwd());

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
