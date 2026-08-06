import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";

import { SHELF_FIXTURE } from "@/test/fixtures";

import { ShelfScreen } from "./shelf-screen";

const PROGRESS = { owned: 11, total: 120 };

describe("ShelfScreen", () => {
  it("renders the gadget header and the live counter", () => {
    render(<ShelfScreen entries={SHELF_FIXTURE} progress={PROGRESS} filter="all" />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/SPIDEY/);
    expect(screen.getByText("11 / 120")).toBeInTheDocument();
    expect(screen.getByText("PETER PARKER COLLECTED")).toBeInTheDocument();
    expect(screen.getByText("109 SPIDERS STILL OUT THERE")).toBeInTheDocument();
  });

  it("shows every public figure and never a staged one", () => {
    render(<ShelfScreen entries={SHELF_FIXTURE} progress={PROGRESS} filter="all" />);

    const shelf = screen.getByRole("region", { name: "The shelf" });
    expect(within(shelf).getAllByRole("link")).toHaveLength(5);
    expect(screen.queryByText("Spider-Man (Staged)")).not.toBeInTheDocument();
  });

  it("filters the grid by the active tab and marks it current", () => {
    render(<ShelfScreen entries={SHELF_FIXTURE} progress={PROGRESS} filter="spider_verse" />);

    const shelf = screen.getByRole("region", { name: "The shelf" });
    const links = within(shelf).getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/figure/pop-spider-verse-miles-g-morales-1412");

    const tabs = screen.getByRole("navigation", { name: "Categories" });
    expect(within(tabs).getByRole("link", { current: "page" })).toHaveTextContent("SPIDER-VERSE");
    expect(within(tabs).getByRole("link", { name: "ALL" })).toHaveAttribute("href", "/");
    expect(within(tabs).getByRole("link", { name: "PETER PARKER" })).toHaveAttribute(
      "href",
      "/?cat=peter",
    );
  });

  it("has a pixel message for an empty sector", () => {
    render(<ShelfScreen entries={SHELF_FIXTURE} progress={PROGRESS} filter="friends_foes" />);

    expect(screen.getByText("NO SIGHTINGS IN THIS SECTOR YET")).toBeInTheDocument();
    const shelf = screen.getByRole("region", { name: "The shelf" });
    expect(within(shelf).queryAllByRole("link")).toHaveLength(0);
  });

  it("puts the newest arrivals in the ribbon and the latest one in the ticker", () => {
    render(<ShelfScreen entries={SHELF_FIXTURE} progress={PROGRESS} filter="all" />);

    expect(screen.getByRole("heading", { name: "NEW SIGHTINGS" })).toBeInTheDocument();
    expect(screen.getAllByTitle("New sighting").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/LATEST SIGHTING: PETER B\. PARKER & MAYDAY #1239/).length,
    ).toBeGreaterThan(0);
  });

  it("still renders an empty shelf", () => {
    render(<ShelfScreen entries={[]} progress={{ owned: 0, total: 120 }} filter="all" />);

    expect(screen.getByText("0 / 120")).toBeInTheDocument();
    expect(screen.getByText("NO SIGHTINGS IN THIS SECTOR YET")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "NEW SIGHTINGS" })).not.toBeInTheDocument();
  });
});
