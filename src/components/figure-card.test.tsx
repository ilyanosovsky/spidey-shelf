import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { shelfEntry } from "@/test/fixtures";

import { FigureCard } from "./figure-card";

describe("FigureCard", () => {
  it("renders a figure that is on the shelf", () => {
    render(
      <FigureCard
        entry={shelfEntry({
          slug: "pop-marvel-spider-man-last-stand-1450",
          name: "Spider-Man (Last Stand)",
          popNumber: 1450,
          acquiredAt: "2025-04-12",
          acquiredCity: "LA",
          acquiredCountry: "US",
        })}
      />,
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/figure/pop-marvel-spider-man-last-stand-1450");
    expect(screen.getByText("Spider-Man (Last Stand)")).toBeInTheDocument();
    // Once on the amber badge, once as the box art's cover number.
    expect(screen.getAllByText("#1450").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("\u{1F1FA}\u{1F1F8} LA")).toBeInTheDocument();
    expect(screen.getByText("APR 2025")).toBeInTheDocument();
    expect(screen.getByText("PETER PARKER")).toBeInTheDocument();
    expect(screen.queryByText("NOT MINE ANYMORE")).not.toBeInTheDocument();
    expect(link.className).not.toContain("opacity-60");
  });

  it("dims a figure that left the shelf and says so", () => {
    render(
      <FigureCard
        entry={shelfEntry({
          slug: "pop-lilo-stitch-hula-stitch-718",
          name: "Hula Stitch",
          popNumber: 718,
          category: "other",
          status: "not_mine_anymore",
        })}
      />,
    );

    expect(screen.getByText("NOT MINE ANYMORE")).toBeInTheDocument();
    expect(screen.getByRole("link").className).toContain("opacity-60");
    expect(screen.getByText("OTHER")).toBeInTheDocument();
  });

  it("stars a new sighting only when asked", () => {
    const entry = shelfEntry({ slug: "pop-marvel-spider-man-3" });
    const { unmount } = render(<FigureCard entry={entry} />);
    expect(screen.queryByText("New sighting")).not.toBeInTheDocument();
    unmount();

    render(<FigureCard entry={entry} isNew />);
    expect(screen.getByText("New sighting")).toBeInTheDocument();
  });

  it("wears a price chip when the cache has one, and nothing when it does not", () => {
    const entry = shelfEntry({ slug: "pop-marvel-spider-man-3" });

    const { unmount } = render(<FigureCard entry={entry} />);
    expect(screen.queryByText(/^~\$/)).not.toBeInTheDocument();
    unmount();

    render(<FigureCard entry={entry} price="~$24" />);
    expect(screen.getByText("~$24")).toBeInTheDocument();
  });

  it("keeps the card the same height with and without the chip", () => {
    const entry = shelfEntry({ slug: "pop-marvel-spider-man-3" });

    const { container, unmount } = render(<FigureCard entry={entry} />);
    // The category line and the chip share one row with a floor on its height, so the grid
    // does not step when the nightly sweep fills a gap.
    const bare = container.querySelector(".min-h-7");
    expect(bare).not.toBeNull();
    unmount();

    const priced = render(<FigureCard entry={entry} price="~$24" />);
    expect(priced.container.querySelectorAll(".min-h-7")).toHaveLength(1);
  });

  it("survives a figure with no number and no place", () => {
    render(
      <FigureCard
        entry={shelfEntry({
          popNumber: null,
          acquiredAt: null,
          acquiredCity: null,
          acquiredCountry: null,
        })}
      />,
    );

    expect(screen.getAllByText("#—").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });
});
