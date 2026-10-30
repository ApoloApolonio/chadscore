import type { NextConfig } from "next";

const config: NextConfig = {
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
