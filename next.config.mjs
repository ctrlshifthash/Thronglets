/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lets CI/tooling build into a separate folder (NEXT_DIST_DIR=.next-check)
  // without clobbering a running dev server's .next.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;
