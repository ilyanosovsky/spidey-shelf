import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ownedRow } from "@/test/fixtures";

/**
 * The delete button inside the card imports the collection's server actions, and that module
 * reaches the database (and `server-only`) at import time. Only the button needs it, and this
 * file is not about the button — one stub keeps the card renderable in jsdom.
 */
vi.mock("./actions", () => ({
  deleteOwnedFigureAction: async () => {},
}));

const { VaultCard } = await import("./vault-card");

const ART = "https://si4zn51deh.ufs.sh/f/test-key_spider-man-800.webp";

/**
 * THE VAULT's card, and the Phase 10 addition to it: the picture.
 *
 * The owner uploads box art on the edit screen and then could not see it anywhere in the
 * admin — the list showed a number and a name. These two tests are the two states `BoxArt`
 * has everywhere else on the site, asserted here so the admin cannot drift away from them.
 */
describe("VaultCard", () => {
  it("still shows the number, the name and the row's chips", () => {
    render(<VaultCard figure={ownedRow()} />);

    expect(screen.getAllByText("#3")[0]).toBeInTheDocument();
    expect(screen.getByText("Spider-Man")).toBeInTheDocument();
    expect(screen.getByText("MINE")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "EDIT" })).toHaveAttribute(
      "href",
      `/admin/collection/${ownedRow().id}/edit`,
    );
  });

  it("draws the pixel spider while the catalog row has no uploaded art", () => {
    render(<VaultCard figure={ownedRow()} />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    // The placeholder is `aria-hidden`; its cover number is how it is found — so #3 is on
    // the card twice, once as the amber badge and once painted on the drawn box.
    expect(screen.getAllByText("#3")).toHaveLength(2);
  });

  it("shows the uploaded box art once `image_path` points at one", () => {
    render(<VaultCard figure={ownedRow({ imagePath: ART })} />);

    const image = screen.getByRole("img", { name: "Spider-Man box art" });
    expect(image.getAttribute("src")).toContain(encodeURIComponent(ART));
    // The drawn box is gone, so the number is on the card exactly once.
    expect(screen.getAllByText("#3")).toHaveLength(1);
    // A 64/80px box must never fetch the 800px file at full width.
    expect(image).toHaveAttribute("sizes", "(min-width: 640px) 80px, 64px");
  });

  it("survives a row that is not linked to a catalog figure", () => {
    render(<VaultCard figure={ownedRow({ referenceFigureId: null, name: null, slug: null })} />);

    expect(screen.getByText("(not in the catalog)")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
