/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Prisma client is a server-only external package.
    serverComponentsExternalPackages: ['@prisma/client', '.prisma/client'],
  },
};

export default nextConfig;
