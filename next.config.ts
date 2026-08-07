import type { NextConfig } from "next";

/**
 * The UploadThing app's CDN host, pinned (ADR-011).
 *
 * Files are served from `https://<APP_ID>.ufs.sh/f/<FILE_KEY>`, and the app id is public —
 * it is in the URL of every image this site shows, which is why it can sit in a committed
 * file. Pinned rather than `*.ufs.sh` on purpose: a wildcard would make `/_next/image` an
 * open optimizer proxy for **every** UploadThing account on the internet, and Vercel Hobby
 * bills 5,000 transformations a month.
 *
 * If the account is ever recreated, this string and `UPLOADTHING_TOKEN` change together.
 */
const UPLOADTHING_CDN_HOST = "si4zn51deh.ufs.sh";

const nextConfig: NextConfig = {
  // Stop `next dev` from appending its agent-rules block to CLAUDE.md —
  // that file is project governance and changes to it go through PRs.
  agentRules: false,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: UPLOADTHING_CDN_HOST,
        pathname: "/f/**",
      },
    ],
  },
};

export default nextConfig;
