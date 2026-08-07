import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stop `next dev` from appending its agent-rules block to CLAUDE.md —
  // that file is project governance and changes to it go through PRs.
  agentRules: false,
};

export default nextConfig;
