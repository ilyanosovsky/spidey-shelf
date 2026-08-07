"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";

import { FOCUS_RING, pixelButtonClass } from "./pixel-button";

/**
 * The SIGHTINGS MAP, expanded (Phase 10).
 *
 * On a phone the map panel is ~340px wide and the crop spans Los Angeles to Tbilisi, which
 * puts three of the nine cities inside five millimetres of each other. The owner asked for a
 * tap that opens it big with scrolling inside, so this is a native `<dialog>` and its
 * `showModal()`: the top layer, the `::backdrop`, Escape, and the focus trap are all browser
 * behaviour, and re-implementing any of them in React would be worse in every case.
 *
 * **The map itself stays a server component.** It arrives as `children` — a rendered
 * ReactNode — exactly like `BoxArtImage`'s placeholder in Phase 9, so `SightingsMap`, the
 * 27 KB landmass path and `src/lib/geo.ts` never enter a browser bundle. What ships is this
 * file: a button, a dialog, and one boolean.
 *
 * The trigger is an **overlay** rather than a wrapper: `<button>` may only contain phrasing
 * content, and the map is an `<svg>` with a `<p>` caption under it in a `<div>`. An absolutely
 * positioned button over the panel gives the same "the whole map is tappable" target without
 * putting flow content inside a button.
 */

export const MAP_MODAL_COPY = {
  /** The chip in the panel's top-right corner. `⤢` is the arrow the design brief uses. */
  expand: "⤢ EXPAND",
  /** What a screen reader hears on the trigger — the chip is decoration. */
  open: "Expand the sightings map",
  close: "CLOSE",
  dialog: "SIGHTINGS MAP",
  hint: "DRAG TO EXPLORE",
} as const;

/**
 * How much wider than its container the map is drawn once expanded.
 *
 * 2.5× is what separates Tbilisi from Batumi on a 375px screen without turning the crop into
 * a maze: the panel becomes ~940px of scrollable width, roughly two and a half swipes.
 */
export const MAP_MODAL_ZOOM = 2.5;

export function MapModal({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (!open) {
      if (dialog.open) dialog.close();
      return;
    }

    // `showModal` is guarded rather than assumed: it is what puts the element in the top
    // layer and lights up `::backdrop`, and a runtime without it should still show the map.
    if (!dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }

    // Open in the middle of the map, not in the top-left corner of the Atlantic.
    const scroller = scrollerRef.current;
    if (scroller) {
      scroller.scrollLeft = Math.max(0, (scroller.scrollWidth - scroller.clientWidth) / 2);
      scroller.scrollTop = Math.max(0, (scroller.scrollHeight - scroller.clientHeight) / 2);
    }

    // The page behind a modal must not scroll under the finger — `<dialog>` handles focus
    // and inertness, but not this.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  /**
   * A click that lands on the dialog element itself is a click on the gutter around the
   * panel — i.e. on the backdrop. Anything inside the panel stops at the panel.
   */
  const onDialogClick = useCallback((event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) setOpen(false);
  }, []);

  return (
    <div className={className}>
      <div className="relative">
        {children}

        <button
          type="button"
          aria-label={MAP_MODAL_COPY.open}
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          className={`absolute inset-0 cursor-zoom-in rounded ${FOCUS_RING}`}
        >
          <span
            aria-hidden="true"
            className="font-pixel absolute top-2 right-2 rounded border-2 border-ink-px bg-amber px-2 py-1 text-[10px] leading-none tracking-wider text-ink-px"
          >
            {MAP_MODAL_COPY.expand}
          </span>
        </button>
      </div>

      <dialog
        ref={dialogRef}
        aria-label={MAP_MODAL_COPY.dialog}
        onClose={() => setOpen(false)}
        onClick={onDialogClick}
        className="map-modal m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-2 text-cream sm:p-4"
      >
        {open ? (
          <div className="flex h-full w-full flex-col gap-3 rounded-lg border-4 border-blue-frame bg-navy-deep p-3 sm:p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-pixel text-[10px] leading-relaxed tracking-wider text-cream">
                {MAP_MODAL_COPY.dialog}
              </p>
              <p className="font-pixel text-[10px] leading-relaxed tracking-wider text-lcd-glow">
                {MAP_MODAL_COPY.hint}
              </p>
            </div>

            {/*
             * Both axes scroll: at 2.5× a wide crop overflows sideways and a tall one
             * downwards, and which of the two it is depends on the cities in the database.
             * `overscroll-contain` stops a swipe that runs out of map from scrolling the
             * page behind the modal.
             */}
            <div
              ref={scrollerRef}
              className="map-modal-scroller flex-1 overflow-auto overscroll-contain rounded border-2 border-ink-px"
            >
              <div style={{ width: `${MAP_MODAL_ZOOM * 100}%` }}>{children}</div>
            </div>

            {/* Bottom, and full width: on a 6" phone the top of the screen is not reachable. */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={pixelButtonClass("primary", "w-full")}
            >
              {MAP_MODAL_COPY.close}
            </button>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
