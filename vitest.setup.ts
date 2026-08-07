import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * Testing Library only auto-registers its `afterEach(cleanup)` when Vitest runs with
 * `globals: true`, and this project does not — so without this every `render()` in a file
 * would pile up in the same document and the second one would find two of everything.
 */
afterEach(cleanup);

/**
 * A four-line `<dialog>` polyfill for jsdom (Phase 10).
 *
 * jsdom 29 ships `HTMLDialogElement` with exactly one member — the reflected `open` property.
 * `show()`, `showModal()` and `close()` are not implemented, which was checked rather than
 * assumed (`Object.getOwnPropertyNames(HTMLDialogElement.prototype)` is `constructor, open`).
 *
 * The three methods are added here rather than worked around in `MapModal`, because the
 * component should call the browser API the browser actually has. What this cannot emulate is
 * the parts that make `showModal()` worth using — the top layer, `::backdrop`, the focus trap
 * and Escape — so `map-modal.test.tsx` asserts on the contract (`open`, the `close` event, the
 * body scroll lock, what is in the DOM) and leaves the rest to the platform.
 */
if (typeof HTMLDialogElement !== "undefined" && !HTMLDialogElement.prototype.showModal) {
  const open = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };

  HTMLDialogElement.prototype.show = open;
  HTMLDialogElement.prototype.showModal = open;
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement, returnValue?: string) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    if (returnValue !== undefined) this.returnValue = returnValue;
    this.dispatchEvent(new Event("close"));
  };
}
