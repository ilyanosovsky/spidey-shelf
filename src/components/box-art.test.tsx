import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { catalogFigure, catalogResult, shelfEntry } from "@/test/fixtures";

import { BoxArt } from "./box-art";
import { FigureCard } from "./figure-card";
import { SearchResultCard } from "./search-result-card";
import { WantedCard } from "./wanted-card";

const ART = "https://si4zn51deh.ufs.sh/f/test-key_spider-man-800.webp";

/**
 * The two states every figure has had since Phase 4 and will keep having: a drawn spider
 * while `image_path` is NULL, and the owner's uploaded box art once it is not.
 *
 * The placeholder is `aria-hidden`, so it is found by its cover number rather than by a role;
 * the real image has meaningful alt text, which is the whole point of asserting on it.
 */
describe("BoxArt", () => {
  it("draws the pixel spider when there is no uploaded art", () => {
    render(
      <BoxArt slug="pop-marvel-spider-man-3" name="Spider-Man" category="peter" popNumber={3} />,
    );

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("#3")).toBeInTheDocument();
  });

  it("renders the uploaded art with the figure's name in the alt text", () => {
    render(
      <BoxArt
        slug="pop-marvel-spider-man-last-stand-1450"
        name="Spider-Man (Last Stand)"
        category="peter"
        popNumber={1450}
        imagePath={ART}
      />,
    );

    const image = screen.getByRole("img", { name: "Spider-Man (Last Stand) box art" });
    expect(image).toBeInTheDocument();
    expect(image.getAttribute("src")).toContain(encodeURIComponent(ART));
  });

  it("falls back to the spider for anything that is not an absolute https url", () => {
    for (const path of ["", "   ", "catalog/1450.webp", null]) {
      const { unmount } = render(
        <BoxArt
          slug="pop-marvel-spider-man-3"
          name="Spider-Man"
          category="peter"
          popNumber={3}
          imagePath={path}
        />,
      );
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
      unmount();
    }
  });
});

describe("the cards render whichever art the figure has", () => {
  it("FigureCard: placeholder by default, box art when the catalog row has one", () => {
    const { unmount } = render(<FigureCard entry={shelfEntry({ name: "Spider-Man" })} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    unmount();

    render(<FigureCard entry={shelfEntry({ name: "Spider-Man", imagePath: ART })} />);
    expect(screen.getByRole("img", { name: "Spider-Man box art" })).toBeInTheDocument();
    // The amber number badge stays on top of the art, not only on top of the placeholder.
    expect(screen.getByText("#3")).toBeInTheDocument();
  });

  it("WantedCard: same two states", () => {
    const { unmount } = render(<WantedCard figure={catalogFigure({ name: "Venom" })} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("WANTED")).toBeInTheDocument();
    unmount();

    render(<WantedCard figure={catalogFigure({ name: "Venom", imagePath: ART })} />);
    expect(screen.getByRole("img", { name: "Venom box art" })).toBeInTheDocument();
  });

  it("SearchResultCard: same two states, and the verdict is unaffected", () => {
    const { unmount } = render(
      <SearchResultCard result={catalogResult({ name: "Miles Morales", ownedCount: 1 })} />,
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("OWNED")).toBeInTheDocument();
    unmount();

    render(
      <SearchResultCard
        result={catalogResult({ name: "Miles Morales", ownedCount: 1, imagePath: ART })}
      />,
    );
    expect(screen.getByRole("img", { name: "Miles Morales box art" })).toBeInTheDocument();
    expect(screen.getByText("OWNED")).toBeInTheDocument();
  });
});
