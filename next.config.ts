import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@opentelemetry/sdk-node",
    "@langfuse/otel",
    "langfuse",
  ],
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize all OpenTelemetry + gRPC packages to avoid bundling
      // Node.js built-ins (http, https, zlib, net, tls, dns, etc.)
      const orig = config.externals;
      config.externals = [
        ...(Array.isArray(orig) ? orig : orig ? [orig] : []),
        (ctx: { request: string }, callback: (err: null, result?: string) => void) => {
          if (
            /^@opentelemetry\//.test(ctx.request) ||
            /^@grpc\//.test(ctx.request) ||
            ctx.request === "langfuse" ||
            /^@langfuse\//.test(ctx.request)
          ) {
            return callback(null, `commonjs ${ctx.request}`);
          }
          callback(null);
        },
      ];
    }
    return config;
  },
};

export default nextConfig;
