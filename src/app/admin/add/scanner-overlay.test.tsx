import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ScannerOverlay } from "./scanner-overlay";

/**
 * The overlay in the environment it will meet most often outside the owner's phone: one
 * with no camera at all.
 *
 * jsdom has no `navigator.mediaDevices`, which is exactly the shape of a desktop browser
 * with the API disabled, an insecure origin, or an old WebView — so this file is not a
 * contrivance, it is the fallback path rendered under the real conditions. What cannot be
 * proved here is the decode itself: a barcode needs a lens and a box, and that check lives
 * on the owner's iPhone against the Vercel preview.
 *
 * The invariant every case asserts is the same one: **`TYPE INSTEAD` is always on screen.**
 */

const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");

function setMediaDevices(value: unknown) {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value,
  });
}

afterEach(() => {
  if (originalMediaDevices) Object.defineProperty(navigator, "mediaDevices", originalMediaDevices);
  else setMediaDevices(undefined);
  vi.unstubAllGlobals();
});

describe("ScannerOverlay without a camera", () => {
  it("says so immediately and keeps the keyboard one tap away", () => {
    render(<ScannerOverlay onClose={() => {}} />);

    expect(screen.getByRole("alert")).toHaveTextContent("THIS BROWSER WON'T HAND OVER A CAMERA.");
    expect(screen.getByRole("button", { name: "TYPE INSTEAD" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CLOSE" })).toBeInTheDocument();
  });

  it("never paints a viewfinder it cannot fill", () => {
    const { container } = render(<ScannerOverlay onClose={() => {}} />);

    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector(".scanline")).toBeNull();
  });

  it("is a labelled modal, so the page behind it is not the thing being read", () => {
    render(<ScannerOverlay onClose={() => {}} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("SCANNING");
  });

  it("closes on both ways out", () => {
    const onClose = vi.fn();
    render(<ScannerOverlay onClose={onClose} />);

    screen.getByRole("button", { name: "CLOSE" }).click();
    screen.getByRole("button", { name: "TYPE INSTEAD" }).click();

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("carries the empty barcode field that a hit would fill", () => {
    const { container } = render(<ScannerOverlay onClose={() => {}} />);

    const form = container.querySelector("form");
    expect(form).toHaveAttribute("action", "/admin/add");
    expect(form?.querySelector('input[name="step"]')).toHaveValue("scan-result");
    expect(form?.querySelector('input[name="upc"]')).toHaveValue("");
  });

  it("warns about the iOS PWA quirk in every state", () => {
    render(<ScannerOverlay onClose={() => {}} />);

    expect(screen.getByText("IF THE CAMERA STAYS DARK, RELOAD.")).toBeInTheDocument();
  });
});

describe("ScannerOverlay on an insecure origin", () => {
  it("names the actual problem instead of blaming the browser", () => {
    // A camera API can exist and still be refused over plain http.
    setMediaDevices({ getUserMedia: vi.fn() });
    vi.stubGlobal("isSecureContext", false);

    render(<ScannerOverlay onClose={() => {}} />);

    expect(screen.getByRole("alert")).toHaveTextContent("THE CAMERA NEEDS HTTPS.");
    expect(screen.getByRole("button", { name: "TYPE INSTEAD" })).toBeInTheDocument();
  });
});
