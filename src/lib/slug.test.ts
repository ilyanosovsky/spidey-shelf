import { describe, expect, it } from "vitest";
import { figureSlug, slugify } from "./slug";

describe("slugify", () => {
  it("lowercases and replaces non-alphanumerics with dashes", () => {
    expect(slugify("Spider-Man (Fear Itself Suit)")).toBe("spider-man-fear-itself-suit");
  });

  it("collapses repeated separators and trims edge dashes", () => {
    expect(slugify("  Peter B. Parker & Mayday!  ")).toBe("peter-b-parker-mayday");
  });

  it("strips diacritics", () => {
    expect(slugify("Pokémon Café")).toBe("pokemon-cafe");
  });
});

describe("figureSlug", () => {
  it("combines line, name and number", () => {
    expect(figureSlug("Pop! Marvel", "Spider-Man Last Stand", 1450)).toBe(
      "pop-marvel-spider-man-last-stand-1450",
    );
  });

  it("works without a number (SE releases)", () => {
    expect(figureSlug("Pop! Marvel", "Spider-Man", null)).toBe("pop-marvel-spider-man");
  });

  it("disambiguates identical numbers across lines", () => {
    const marvel = figureSlug("Pop! Marvel", "Spider-Man", 3);
    const animation = figureSlug("Pop! Animation", "Spider-Man", 3);
    expect(marvel).not.toBe(animation);
  });
});
