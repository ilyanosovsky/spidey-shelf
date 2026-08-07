import { generateReactHelpers } from "@uploadthing/react";

import type { BoxArtFileRouter } from "@/app/api/uploadthing/core";

/**
 * The typed client hook, generated once.
 *
 * `generateReactHelpers` is the *custom UI* entry point — the stock `<UploadButton />` is
 * deliberately not used: it ships its own look, and this site has one (pixel buttons, LCD
 * panels, toothed banners). What the admin panel wants from the SDK is `startUpload`,
 * `isUploading` and a progress number; everything on screen is ours.
 *
 * The import is `type`-only against the router, so nothing from `core.ts` — the token, the
 * database, the session verification — can follow it into a browser bundle.
 */
export const { useUploadThing } = generateReactHelpers<BoxArtFileRouter>();
