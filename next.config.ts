import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin should only run on server side
  serverExternalPackages: ["firebase-admin"],
};

export default nextConfig;
