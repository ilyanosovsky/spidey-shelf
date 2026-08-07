"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { pixelButtonClass } from "@/components/pixel-button";
import { SCAN_COPY } from "@/lib/barcode/scan-flow";

/**
 * The `⌖ SCAN THE BOX` button, and the only reason step 1 has any client JavaScript.
 *
 * It is deliberately tiny, and the overlay behind it is deliberately not imported at the
 * top of this file. `next/dynamic` with `ssr: false` keeps the camera code, the decode
 * loop and — behind one more dynamic import inside it — the megabyte of zxing WebAssembly
 * out of the chunk this page loads. Pressing the button is what fetches them; the rest of
 * Quick Add stays the zero-JavaScript flow Phase 6 built, and the public site never sees
 * any of it at all.
 *
 * `ssr: false` also states the obvious honestly: a viewfinder has nothing to render on a
 * server, and rendering one that cannot fill would be a promise the page cannot keep.
 */
const ScannerOverlay = dynamic(
  () => import("./scanner-overlay").then((module) => module.ScannerOverlay),
  { ssr: false },
);

export function ScanButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={pixelButtonClass("secondary", "mt-3 w-full")}
      >
        {SCAN_COPY.scan}
      </button>
      {open ? <ScannerOverlay onClose={() => setOpen(false)} /> : null}
    </>
  );
}
