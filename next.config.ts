import type { NextConfig } from "next";

const config: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_SHA: process.env.VERCEL_GIT_COMMIT_SHA || "local",
  },
  async headers() {
    return [{
      source: "/face-landmarker.worker.js",
      headers: [{
        key: "Content-Security-Policy",
        value: "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'",
      }],
    }];
  },
};

export default config;
