import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Resolved at build time: Vercel provides the commit SHA; locally we ask git.
function commit() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
  try {
    return execSync("git rev-parse --short=7 HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "unknown";
  }
}

const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
    NEXT_PUBLIC_COMMIT: commit(),
  },
};
export default nextConfig;
