import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  agentRules: false,
  turbopack: {
    // the app imports the harness from ../src, so the workspace root
    // has to be the parent dir, not web/ itself
    root: path.join(__dirname, ".."),
  },
};

export default nextConfig;
