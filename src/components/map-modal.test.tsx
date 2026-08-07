import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MapModal, MAP_MODAL_COPY, MAP_MODAL_ZOOM } from "./map-modal";

/**
 * The expandable SIGHTINGS MAP (Phase 10).
 *
 * jsdom 29 ships `HTMLDialogElement` with the reflected `open` property and **nothing else** —
 * no `showModal()`, no `close()` — so `vitest.setup.ts` adds those three methods. What no
 * polyfill can give this environment is the top layer, `::backdrop`, the focus trap and
 * Escape, which is why these tests assert the contract (is it open, is the map inside it, is
 * the page behind it locked) and leave the modality itself to the platform.
 *
 * Layout is not real either: `scrollWidth` is always 0, so the "open in the middle" centring
 * cannot be asserted — it is written to be a harmless no-op when it is (`Math.max(0, …)`).
 */
function Map() {
  return <p data-testid="map">the map</p>;
}

describe("MapModal", () => {
  it("puts the whole map behind one labelled button, with the chip on top", () => {
    render(
      <MapModal>
        <Map />
      </MapModal>,
    );

    expect(screen.getByRole("button", { name: MAP_MODAL_COPY.open })).toBeInTheDocument();
    expect(screen.getByText(MAP_MODAL_COPY.expand)).toBeInTheDocument();
    // The chip is decoration — the button's accessible name is the sentence.
    expect(screen.getByText(MAP_MODAL_COPY.expand)).toHaveAttribute("aria-hidden", "true");
  });

  it("ships the dialog closed and empty, so the map is in the DOM exactly once", () => {
    render(
      <MapModal>
        <Map />
      </MapModal>,
    );

    const dialog = document.querySelector("dialog");
    expect(dialog).not.toBeNull();
    expect(dialog?.open).toBe(false);
    expect(dialog).toHaveAttribute("aria-label", MAP_MODAL_COPY.dialog);
    expect(screen.getAllByTestId("map")).toHaveLength(1);
  });

  it("opens as a modal, scaled, with the map inside it", () => {
    render(
      <MapModal>
        <Map />
      </MapModal>,
    );

    fireEvent.click(screen.getByRole("button", { name: MAP_MODAL_COPY.open }));

    const dialog = document.querySelector("dialog");
    expect(dialog?.open).toBe(true);
    expect(screen.getAllByTestId("map")).toHaveLength(2);
    expect(screen.getByRole("button", { name: MAP_MODAL_COPY.close })).toBeInTheDocument();

    const scaled = dialog?.querySelector<HTMLElement>("[style*='width']");
    expect(scaled?.style.width).toBe(`${MAP_MODAL_ZOOM * 100}%`);
  });

  it("locks the page behind it while it is open, and gives the scroll back on close", () => {
    render(
      <MapModal>
        <Map />
      </MapModal>,
    );

    fireEvent.click(screen.getByRole("button", { name: MAP_MODAL_COPY.open }));
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(screen.getByRole("button", { name: MAP_MODAL_COPY.close }));
    expect(document.body.style.overflow).toBe("");
  });

  it("closes on CLOSE, and takes the second copy of the map out with it", () => {
    render(
      <MapModal>
        <Map />
      </MapModal>,
    );

    fireEvent.click(screen.getByRole("button", { name: MAP_MODAL_COPY.open }));
    fireEvent.click(screen.getByRole("button", { name: MAP_MODAL_COPY.close }));

    expect(document.querySelector("dialog")?.open).toBe(false);
    expect(screen.getAllByTestId("map")).toHaveLength(1);
  });

  it("closes when the dialog's own gutter is clicked — the backdrop", () => {
    render(
      <MapModal>
        <Map />
      </MapModal>,
    );

    fireEvent.click(screen.getByRole("button", { name: MAP_MODAL_COPY.open }));
    const dialog = document.querySelector("dialog") as HTMLDialogElement;

    // A click on the panel inside must NOT close it.
    fireEvent.click(screen.getAllByTestId("map")[1]);
    expect(dialog.open).toBe(true);

    fireEvent.click(dialog);
    expect(dialog.open).toBe(false);
  });

  it("follows the browser when Escape closes the dialog", () => {
    render(
      <MapModal>
        <Map />
      </MapModal>,
    );

    fireEvent.click(screen.getByRole("button", { name: MAP_MODAL_COPY.open }));
    const dialog = document.querySelector("dialog") as HTMLDialogElement;

    // Escape is the browser's own behaviour: it closes the dialog and fires `close`, which
    // is the event the component listens to. Reproduce the event, not the keystroke.
    fireEvent(dialog, new Event("close"));

    expect(dialog.open).toBe(false);
    expect(screen.getAllByTestId("map")).toHaveLength(1);
    expect(document.body.style.overflow).toBe("");
  });
});
