"use client";

import { useEffect, useRef, useState } from "react";

import { pixelButtonClass } from "./pixel-button";

/**
 * "Send this one to whoever asked what to get me."
 *
 * The only client component on the public site, and it is client-side for a reason no
 * server can satisfy: `navigator.share` opens the phone's native share sheet, which is how
 * a gift link actually travels. Where that API does not exist (every desktop browser but
 * Safari) it copies the link and says so.
 *
 * Self-contained on purpose — it takes a relative href and resolves it against the current
 * origin at click time, so nothing about the deployment URL has to be configured, and the
 * component can be dropped on any card without a provider around it.
 */
export function ShareButton({
  href,
  title,
  className = "",
}: {
  /** Relative URL, e.g. `/search?q=334`. Resolved against the current origin on click. */
  href: string;
  /** What the share sheet announces — the figure's name. */
  title: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A card can unmount while the "LINK COPIED" flash is still pending (tab switch, filter
  // change) — clearing the timer keeps React from setting state on a dead component.
  useEffect(() => () => (timer.current ? clearTimeout(timer.current) : undefined), []);

  async function share() {
    const url = new URL(href, window.location.origin).toString();

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        // The user closing the share sheet is not a failure — do not "helpfully" copy.
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // No share sheet and no clipboard permission: the address bar still has the link.
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      aria-label={`Share ${title}`}
      className={pixelButtonClass("quiet", `w-full ${className}`)}
    >
      {copied ? "LINK COPIED" : "SHARE"}
    </button>
  );
}
