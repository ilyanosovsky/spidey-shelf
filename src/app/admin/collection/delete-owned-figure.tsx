"use client";

import { useState } from "react";

import { pixelButton } from "../ui";
import { deleteOwnedFigureAction } from "./actions";

/**
 * Two-step delete. `window.confirm()` was the other option; a rendered confirm step reads
 * as part of the gadget instead of as a browser dialog, and it still works if the click
 * happens before hydration — the second step is a plain form post.
 */
export function DeleteOwnedFigure({ id, name }: { id: string; name: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={pixelButton.quiet}
        aria-label={`Delete ${name}`}
      >
        DELETE
      </button>
    );
  }

  return (
    <form action={deleteOwnedFigureAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <p className="font-pixel w-full text-[8px] leading-relaxed text-coral">
        DELETE {name.toUpperCase()} FOR GOOD?
      </p>
      <button type="submit" className={pixelButton.danger}>
        YES, DELETE
      </button>
      <button type="button" onClick={() => setConfirming(false)} className={pixelButton.quiet}>
        CANCEL
      </button>
    </form>
  );
}
