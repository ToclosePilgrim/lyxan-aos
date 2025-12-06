/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standard output (no standalone) to avoid Windows symlink issues during local builds.
  // Docker image uses a multi-stage build and copies `.next` artifacts directly.
};

module.exports = nextConfig;

