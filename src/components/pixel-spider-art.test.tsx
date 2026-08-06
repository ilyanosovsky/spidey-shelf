import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { CATEGORY_ACCENT, PixelSpiderArt, speckCellsFor } from "./pixel-spider-art";

function markup(props: Parameters<typeof PixelSpiderArt>[0]): string {
  const { container, unmount } = render(<PixelSpiderArt {...props} />);
  const html = container.innerHTML;
  unmount();
  return html;
}

const BASE = {
  slug: "pop-marvel-spider-man-last-stand-1450",
  category: "peter" as const,
  popNumber: 1450,
};

describe("PixelSpiderArt", () => {
  it("is deterministic: the same figure always draws the same sprite", () => {
    expect(markup(BASE)).toBe(markup(BASE));
  });

  it("gives every category its own hue", () => {
    const hues = (["peter", "spider_verse", "friends_foes", "other"] as const).map(
      (category) => CATEGORY_ACCENT[category],
    );
    expect(new Set(hues).size).toBe(4);

    const peter = markup(BASE);
    const verse = markup({ ...BASE, category: "spider_verse" });
    expect(peter).toContain(CATEGORY_ACCENT.peter);
    expect(verse).toContain(CATEGORY_ACCENT.spider_verse);
    expect(peter).not.toBe(verse);
  });

  it("falls back to the default bucket for an unknown category", () => {
    expect(markup({ ...BASE, category: null })).toBe(markup({ ...BASE, category: "other" }));
  });

  it("varies the specks per figure but keeps them stable per slug", () => {
    const one = speckCellsFor("pop-marvel-spider-man-3");
    const two = speckCellsFor("pop-marvel-spider-man-last-stand-1450");
    expect(one).toEqual(speckCellsFor("pop-marvel-spider-man-3"));
    expect(one).not.toEqual(two);
  });

  it("always picks three distinct specks", () => {
    for (const slug of ["a", "pop-marvel-spider-man-3", "x".repeat(64), "1239"]) {
      const cells = speckCellsFor(slug);
      expect(cells).toHaveLength(3);
      expect(new Set(cells.map((cell) => cell.join(","))).size).toBe(3);
    }
  });

  it("draws the pop number and stays decorative for screen readers", () => {
    const { container } = render(<PixelSpiderArt {...BASE} />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(container.textContent).toContain("#1450");
    expect(container.querySelectorAll("rect").length).toBeGreaterThan(20);
  });

  it("never prints a missing number as null", () => {
    const { container } = render(<PixelSpiderArt {...BASE} popNumber={null} />);
    expect(container.textContent).toContain("#—");
  });
});
