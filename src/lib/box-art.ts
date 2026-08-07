/**
 * Owner-uploaded box art, minus the browser and minus the network.
 *
 * ADR-011: pops.today never answered, so the interim image source is the owner himself —
 * he photographs or saves a box, the browser normalizes it, UploadThing stores it and
 * `reference_figures.image_path` points at it. The *uniform look* ADR-004 demanded is not
 * negotiable, so the normalization is not a suggestion: every accepted file becomes exactly
 * one thing, an 800×800 WebP on the navy panel colour, whatever shape it arrived in.
 *
 * Everything in this file is pure. The canvas lives in `src/lib/box-art-canvas.ts` (browser
 * only), the upload router in `src/app/api/uploadthing/core.ts`, and the panel that drives
 * both in `src/app/admin/collection/[id]/edit/box-art-panel.tsx`. Splitting it this way is
 * what makes the geometry, the URL parsing and the screen's state machine testable without
 * a DOM, a token or a network.
 */

/* ------------------------------------------------------------------ the fixed output */

/** The one output size. Matches ADR-004's original pipeline, so nothing downstream moves. */
export const BOX_ART_SIZE = 800;

/** `--navy-panel`. The ground a non-square photo is padded onto, so the grid stays even. */
export const BOX_ART_GROUND = "#123b5c";

export const BOX_ART_MIME = "image/webp";

/**
 * 0.8 puts a normalized box photo at roughly 100–250 KB. Below ~0.7 the pixel-sharp box
 * lettering starts to smear, above ~0.85 the file doubles for nothing a phone can see.
 */
export const BOX_ART_QUALITY = 0.8;

/**
 * The router's ceiling, restated here so the browser can refuse a file before decoding it.
 * The number itself is the string UploadThing's route config takes — one place, both uses.
 */
export const BOX_ART_MAX_FILE_SIZE = "4MB" as const;
export const BOX_ART_MAX_BYTES = 4 * 1024 * 1024;

/** The endpoint's name in the file router, and what `useUploadThing` is pointed at. */
export const BOX_ART_ENDPOINT = "boxArt";

/* ------------------------------------------------------------------ what may be picked */

/**
 * A picked file we are willing to decode.
 *
 * `accept="image/*"` on the input is a hint the file picker may ignore (and does, on some
 * Android file managers), so the type is checked again here. SVG is refused on purpose: it
 * is a document with script in it, and "normalize it to a raster" would mean rendering
 * somebody's XML in the owner's browser.
 */
const REFUSED_IMAGE_TYPES = new Set(["image/svg+xml"]);

export type BoxArtRejection = "not_an_image" | "too_big";

export function rejectPickedFile(file: { type: string; size: number }): BoxArtRejection | null {
  if (!file.type.startsWith("image/") || REFUSED_IMAGE_TYPES.has(file.type)) {
    return "not_an_image";
  }
  // The check is against the *source*: normalization shrinks almost everything, but a 40 MB
  // RAW-ish JPEG is also a decode that can hang a phone, so it never gets that far.
  if (file.size > BOX_ART_MAX_BYTES) return "too_big";
  return null;
}

/* ------------------------------------------------------------------ the geometry */

export interface ContainRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where a `sourceWidth × sourceHeight` image goes inside a `size × size` square: scaled to
 * fit **whole** (contain, never crop) and centred, so the padding lands evenly on the two
 * sides that need it.
 *
 * Contain rather than cover, deliberately: a Funko box is a tall rectangle, and covering an
 * 800×800 square with it would slice the top off every figure's head. The pad is the navy
 * panel colour, which is the card's own background — so a portrait box reads as artwork on
 * a card rather than as a photo with bars.
 *
 * Rounded to whole pixels because `drawImage` on a half pixel resamples, and this world is
 * supposed to look crisp.
 */
export function containRect(
  sourceWidth: number,
  sourceHeight: number,
  size: number = BOX_ART_SIZE,
): ContainRect {
  if (!(sourceWidth > 0) || !(sourceHeight > 0)) {
    // A zero-dimension decode is a broken file; fill the square rather than divide by zero.
    return { x: 0, y: 0, width: size, height: size };
  }

  const scale = Math.min(size / sourceWidth, size / sourceHeight);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  return {
    x: Math.round((size - width) / 2),
    y: Math.round((size - height) / 2),
    width,
    height,
  };
}

/** The uploaded file's name. Slug-derived, so the UploadThing dashboard is readable. */
export function boxArtFileName(slug: string): string {
  const stem = slug.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "") || "box-art";
  return `${stem.toLowerCase()}-${BOX_ART_SIZE}.webp`;
}

/* ------------------------------------------------------------------ the stored URL */

/**
 * `https://<app>.ufs.sh/f/<key>` → `<key>`.
 *
 * The column stores the absolute CDN URL (Data-Model.md), so deleting a replaced file means
 * getting its key back out of that string. Both spellings are handled: `<app>.ufs.sh` is
 * what v7 issues, `utfs.io` is the legacy host UploadThing still serves and may one day
 * deprecate — a row written before a migration must still be deletable.
 *
 * Anything else — a relative bucket path from a future pops.today pipeline, an empty string,
 * a URL from some other host — returns `null`, which callers read as "not ours to delete".
 * Silence is the right answer there: the alternative is a delete call aimed at a key we
 * invented.
 */
export function fileKeyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") return null;

  const host = parsed.hostname.toLowerCase();
  const isUploadThingHost = host === "utfs.io" || host === "ufs.sh" || host.endsWith(".ufs.sh");
  if (!isUploadThingHost) return null;

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length !== 2 || segments[0] !== "f") return null;

  const key = decodeURIComponent(segments[1]);
  return key.length > 0 ? key : null;
}

/**
 * Which stored file a replacement supersedes — i.e. what to hand `UTApi.deleteFiles`.
 *
 * `null` means "delete nothing", and it covers the three cases that matter: the figure had
 * no art, the stored URL is not an UploadThing one (a hand-set path, or a future pops.today
 * bucket key), or the browser re-uploaded a byte-identical file and UploadThing deduplicated
 * it to the **same key** — deleting that would delete the image we just saved.
 *
 * The free tier is 2 GB, which is ~10,000 normalized figures, so this is not a space
 * emergency. It is a tidiness rule with one sharp edge, and the sharp edge is the last case.
 */
export function replacedFileKey(
  previousImagePath: string | null | undefined,
  newKey: string,
): string | null {
  const key = fileKeyFromUrl(previousImagePath);
  return key && key !== newKey ? key : null;
}

/** Does `image_path` hold something `next/image` can be pointed at as an absolute URL? */
export function isRemoteImagePath(path: string | null | undefined): path is string {
  return typeof path === "string" && /^https:\/\//i.test(path.trim());
}

/* ------------------------------------------------------------------ the router's input */

/**
 * What the client sends alongside the file: which catalog row the art belongs to.
 *
 * A `type` and not an `interface`, and that is load-bearing: UploadThing constrains the input
 * to its `Json` type, and TypeScript only gives *type aliases* the implicit index signature
 * that satisfies it. An interface here fails to compile with a message about index signatures
 * that says nothing about why.
 */
export type BoxArtInput = {
  referenceFigureId: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The file router's `.input()` parser, written out rather than pulled from a schema library.
 *
 * One field, one shape, and the failure has to be a thrown `Error` the router turns into a
 * 400 — that is a dozen lines, against a dependency whose only other use here would be this.
 * It runs on the server before the middleware, so a malformed id never reaches Postgres
 * (which answers a bad uuid with an error, and an error page is a worse answer than "no").
 */
export function parseBoxArtInput(value: unknown): BoxArtInput {
  if (typeof value !== "object" || value === null) {
    throw new Error("Box art upload input must be an object.");
  }

  const id = (value as { referenceFigureId?: unknown }).referenceFigureId;
  if (typeof id !== "string" || !UUID_PATTERN.test(id.trim())) {
    throw new Error("Box art upload input needs a referenceFigureId uuid.");
  }

  return { referenceFigureId: id.trim().toLowerCase() };
}

/* ------------------------------------------------------------------ same-origin guard */

/**
 * Is this browser POST coming from our own page?
 *
 * The upload route is a Route Handler, so the CVE-2025-29927 lesson applies twice over: the
 * session is re-verified inside the router's middleware (that is the real gate), and this is
 * the CSRF half of it, per the Next.js data-security guidance. UploadThing does not check
 * `Origin` itself — it relies on the JSON content type triggering a preflight — and a header
 * we can check in four lines is cheaper than trusting that forever.
 *
 * `null` origin fails closed: browsers attach `Origin` to every POST, so its absence means
 * something that is not a browser form or fetch, and this endpoint has no such caller.
 * (The one non-browser POST on this route — UploadThing's signed `uploadthing-hook: callback`
 * — is routed around this check by the handler, because it is authenticated by signature.)
 */
export function isSameOrigin(origin: string | null, host: string | null): boolean {
  if (!origin || !host) return false;
  try {
    return new URL(origin).host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ the screen */

export type BoxArtErrorCode = BoxArtRejection | "decode_failed" | "upload_failed";

/**
 * The upload panel's whole life, as data.
 *
 * A reducer rather than four `useState`s because the states are genuinely exclusive — a
 * panel that is both `NORMALIZING…` and `UPLOAD FAILED` is a bug you only find by staring at
 * it, and this way it cannot be represented.
 */
export type BoxArtUploadState =
  | { phase: "idle" }
  | { phase: "normalizing" }
  | { phase: "uploading"; percent: number }
  | { phase: "done" }
  | { phase: "failed"; code: BoxArtErrorCode };

export type BoxArtUploadEvent =
  | { type: "picked" }
  | { type: "normalized" }
  | { type: "progress"; percent: number }
  | { type: "uploaded" }
  | { type: "failed"; code: BoxArtErrorCode }
  | { type: "reset" };

export const INITIAL_BOX_ART_STATE: BoxArtUploadState = { phase: "idle" };

/** Clamp and round, so a stray 103.7 from a progress event cannot paint a 104% bar. */
export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function boxArtUploadReducer(
  state: BoxArtUploadState,
  event: BoxArtUploadEvent,
): BoxArtUploadState {
  switch (event.type) {
    case "picked":
      // A second pick during a run restarts the panel: the owner changed his mind, and the
      // in-flight upload's own callbacks are ignored from here (the panel drops late events).
      return { phase: "normalizing" };
    case "normalized":
      return { phase: "uploading", percent: 0 };
    case "progress":
      // Progress after the upload finished (or before it started) is noise, not a state.
      if (state.phase !== "uploading") return state;
      return { phase: "uploading", percent: clampPercent(event.percent) };
    case "uploaded":
      return { phase: "done" };
    case "failed":
      return { phase: "failed", code: event.code };
    case "reset":
      return INITIAL_BOX_ART_STATE;
  }
}

/** Is the panel doing something? Drives the disabled button and the scanline sweep. */
export function isBoxArtBusy(state: BoxArtUploadState): boolean {
  return state.phase === "normalizing" || state.phase === "uploading";
}

/**
 * How full the bar is at each phase.
 *
 * Normalizing is a real wait on a phone (decode + resize + WebP encode of a 12 MP photo), so
 * it gets the first tenth of the bar rather than a separate spinner: one bar that moves the
 * whole time reads as one operation, which is what it is to the person watching.
 */
export function boxArtProgress(state: BoxArtUploadState): number {
  switch (state.phase) {
    case "idle":
      return 0;
    case "normalizing":
      return 10;
    case "uploading":
      return 10 + Math.round(state.percent * 0.9);
    case "done":
      return 100;
    case "failed":
      return 0;
  }
}

/** The chunky bar itself: `▓▓▓░░░░░░░`. Pixel font, so the blocks are the same width. */
export const BOX_ART_BAR_CELLS = 10;

export function progressBlocks(percent: number, cells: number = BOX_ART_BAR_CELLS): string {
  const filled = Math.round((clampPercent(percent) / 100) * cells);
  return "▓".repeat(filled) + "░".repeat(Math.max(0, cells - filled));
}

/* ------------------------------------------------------------------ the wording */

/**
 * Every string the panel can show, in one closed table — the same rule `QUICK_ADD_COPY` and
 * `SCAN_COPY` follow. A message painted from anywhere else is a message nobody reviewed.
 */
export const BOX_ART_COPY = {
  heading: "BOX ART",
  upload: "UPLOAD BOX ART",
  replace: "REPLACE BOX ART",
  normalizing: "NORMALIZING…",
  uploading: (percent: number) => `UPLOADING… ${clampPercent(percent)}%`,
  done: "BOX ART SECURED!",
  placeholderNote: "No box art yet — the shelf is drawing a spider instead.",
  hint: "ANY PHOTO — IT BECOMES 800×800 WEBP ON NAVY",
  notAdmin: "Not signed in as the owner.",
  unknownFigure: "That figure is not in the catalog.",
} as const;

export const BOX_ART_ERRORS: Record<BoxArtErrorCode, string> = {
  not_an_image: "THAT IS NOT AN IMAGE — PICK A PNG OR A JPG",
  too_big: "THAT FILE IS OVER 4MB — PICK A SMALLER ONE",
  decode_failed: "COULD NOT READ THAT IMAGE — TRY ANOTHER",
  upload_failed: "UPLOAD FAILED — TRY AGAIN",
};

/** The caption under the bar for whatever the panel is doing right now. */
export function boxArtCaption(state: BoxArtUploadState): string | null {
  switch (state.phase) {
    case "idle":
      return null;
    case "normalizing":
      return BOX_ART_COPY.normalizing;
    case "uploading":
      return BOX_ART_COPY.uploading(state.percent);
    case "done":
      return BOX_ART_COPY.done;
    case "failed":
      return BOX_ART_ERRORS[state.code];
  }
}

/** Alt text for a real box-art image. Meaningful, not `"image"`. */
export function boxArtAlt(name: string): string {
  return `${name} box art`;
}
