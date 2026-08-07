"use client";

import { useRouter } from "next/navigation";
import { useCallback, useReducer, useRef, useState } from "react";

import { BoxArt } from "@/components/box-art";
import { PixelButton } from "@/components/pixel-button";
import { ToothedBanner } from "@/components/toothed-banner";
import {
  BOX_ART_COPY,
  BOX_ART_ENDPOINT,
  boxArtCaption,
  boxArtProgress,
  boxArtUploadReducer,
  INITIAL_BOX_ART_STATE,
  isBoxArtBusy,
  progressBlocks,
  rejectPickedFile,
} from "@/lib/box-art";
import type { FigureCategory } from "@/lib/categories";
import { useUploadThing } from "@/lib/uploadthing";

/**
 * BOX ART — the owner's half of ADR-011.
 *
 * The only client component in the admin besides the delete confirm and the scanner, and it
 * is one for the same reason the scanner is: a file picker, a canvas and a progress number
 * are not things a server can hand over. Everything it shows is house furniture —
 * `PixelButton`, an LCD strip, a `ToothedBanner` — because the stock `<UploadButton />` would
 * paint somebody else's design system into the middle of the gadget.
 *
 * The state machine, the wording and the bar's blocks are pure functions in
 * `src/lib/box-art.ts`, so this file is wiring: pick → normalize → upload → refresh.
 */
export function BoxArtPanel({
  referenceFigureId,
  slug,
  name,
  category,
  popNumber,
  imagePath,
}: {
  referenceFigureId: string;
  slug: string;
  name: string;
  category: FigureCategory | null;
  popNumber: number | null;
  imagePath: string | null;
}) {
  const router = useRouter();
  const [state, dispatch] = useReducer(boxArtUploadReducer, INITIAL_BOX_ART_STATE);

  /**
   * The URL the last successful upload returned, if there was one.
   *
   * Derived rather than synced: `shownImagePath` prefers it over the prop, so the new art is
   * painted the instant `onClientUploadComplete` fires — a beat before `router.refresh()`
   * brings the server component back carrying the same URL. Copying the prop into state in an
   * effect would do the same thing with a cascading render and a frame of the old picture.
   */
  const [uploadedImagePath, setUploadedImagePath] = useState<string | null>(null);
  const shownImagePath = uploadedImagePath ?? imagePath;

  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Which pick the callbacks belong to.
   *
   * `startUpload` has no cancel, so a second pick while the first is in flight would
   * otherwise let the older upload's `onUploadProgress` paint over the newer one's bar. Every
   * callback compares against this and drops anything stale.
   */
  const runRef = useRef(0);

  const { startUpload } = useUploadThing(BOX_ART_ENDPOINT, {
    // 1% steps: the bar is ten blocks, and "coarse" (10%) makes it jump a whole block at a
    // time, which reads as a stuck upload rather than a slow one.
    uploadProgressGranularity: "fine",
    onUploadProgress: (percent) => dispatch({ type: "progress", percent }),
    onClientUploadComplete: (results) => {
      const uploaded = results[0];
      if (uploaded?.serverData?.imagePath) setUploadedImagePath(uploaded.serverData.imagePath);
      dispatch({ type: "uploaded" });
      // The catalog row changed, and it is read by half the site. `force-dynamic` means one
      // refresh is enough — there is no cache window to wait out.
      router.refresh();
    },
    onUploadError: () => dispatch({ type: "failed", code: "upload_failed" }),
  });

  const onPick = useCallback(
    async (file: File | undefined) => {
      if (!file) return;

      const run = ++runRef.current;
      const isStale = () => runRef.current !== run;

      const rejection = rejectPickedFile(file);
      if (rejection) {
        dispatch({ type: "failed", code: rejection });
        return;
      }

      dispatch({ type: "picked" });

      let normalized: File;
      try {
        // Imported here, not at the top: the canvas module is only needed once a file has
        // actually been chosen, and this screen is mostly opened to fix a typo in a story.
        const { normalizeBoxArt } = await import("@/lib/box-art-canvas");
        normalized = await normalizeBoxArt(file, { slug });
      } catch {
        if (!isStale()) dispatch({ type: "failed", code: "decode_failed" });
        return;
      }

      if (isStale()) return;
      dispatch({ type: "normalized" });

      try {
        await startUpload([normalized], { referenceFigureId });
      } catch {
        // `useUploadThing` already routes failures through `onUploadError`; this catch is for
        // the ones that reject the promise instead (an aborted request, an offline phone).
        if (!isStale()) dispatch({ type: "failed", code: "upload_failed" });
      }
    },
    [referenceFigureId, slug, startUpload],
  );

  const busy = isBoxArtBusy(state);
  const caption = boxArtCaption(state);
  const percent = boxArtProgress(state);
  const hasArt = Boolean(shownImagePath);

  return (
    <section aria-labelledby="box-art-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="box-art-heading" className="font-pixel text-[10px] tracking-wider text-amber">
          {BOX_ART_COPY.heading}
        </h2>
        <p className="font-pixel text-[10px] leading-relaxed tracking-wider text-cream/60">
          {BOX_ART_COPY.hint}
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="relative mx-auto w-40 shrink-0 overflow-hidden sm:mx-0 sm:w-44">
          <BoxArt
            slug={slug}
            name={name}
            category={category}
            popNumber={popNumber}
            imagePath={shownImagePath}
            size="hero"
            sizes="176px"
          />
          {/* The sweep from the scanner, reused: it says "working" without a spinner, and it
              is already parked in the middle under `prefers-reduced-motion`. */}
          {busy ? (
            <span
              aria-hidden="true"
              className="scanline pointer-events-none absolute right-0 left-0 h-[3px] bg-amber"
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          {state.phase === "done" ? (
            <ToothedBanner as="p" tone="green" className="max-w-[260px]">
              {BOX_ART_COPY.done}
            </ToothedBanner>
          ) : null}

          {!hasArt && state.phase === "idle" ? (
            <p className="text-sm text-cream/70">{BOX_ART_COPY.placeholderNote}</p>
          ) : null}

          {state.phase !== "idle" && state.phase !== "done" ? (
            <div className="rounded border-2 border-ink-px bg-lcd-bg px-3 py-3">
              <p
                aria-hidden="true"
                className={`font-pixel text-sm leading-relaxed tracking-widest tabular-nums ${
                  state.phase === "failed" ? "text-coral" : "text-lcd-glow"
                }`}
              >
                {progressBlocks(percent)}
              </p>
              <p
                role="status"
                className={`font-pixel mt-3 text-[10px] leading-relaxed tracking-wider ${
                  state.phase === "failed" ? "text-coral" : "text-lcd-glow"
                }`}
              >
                {caption}
              </p>
            </div>
          ) : null}

          {/* The picker itself is never the visible control: a bare file input cannot be
              given a 44px pixel button's look, and every browser draws it differently. */}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(event) => {
              const file = event.target.files?.[0];
              // Reset first, so picking the same file twice (after a failure) still fires.
              event.target.value = "";
              void onPick(file);
            }}
          />

          <div className="mt-4">
            <PixelButton
              variant="primary"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {hasArt ? BOX_ART_COPY.replace : BOX_ART_COPY.upload}
            </PixelButton>
          </div>
        </div>
      </div>
    </section>
  );
}
