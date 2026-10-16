const production = process.env.NODE_ENV === "production";
const buildId = process.env.GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA;

// The browser opens the market-data feed directly: socket.io polls over http(s)
// and upgrades to ws(s), so both schemes are allowed for that origin.
function feedOrigins() {
  try {
    const { protocol, host } = new URL(process.env.NEXT_PUBLIC_WS_URL ?? "");
    const secure = protocol === "https:" || protocol === "wss:";
    return secure ? [`https://${host}`, `wss://${host}`] : [`http://${host}`, `ws://${host}`];
  } catch {
    return [];
  }
}

// Report-only until violations have been reviewed; see docs/operations.md.
// 'unsafe-inline' scripts are needed by the Next.js inline runtime; 'unsafe-eval'
// only by the development server.
function reportOnlyPolicy(frameAncestors) {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${production ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    ["connect-src 'self'", ...feedOrigins()].join(" "),
    `frame-ancestors ${frameAncestors}`,
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Content-Security-Policy-Report-Only", value: reportOnlyPolicy("'none'") },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  ...(production
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  poweredByHeader: false,
  ...(buildId ? { deploymentId: buildId } : {}),
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The email preview index frames its sibling templates (same origin). Later
      // entries override earlier ones for the same header key.
      {
        source: "/email-preview/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "Content-Security-Policy-Report-Only", value: reportOnlyPolicy("'self'") },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/email-preview",
        destination: "/email-preview/index.html",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
