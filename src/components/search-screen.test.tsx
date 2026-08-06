import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { catalogResult } from "@/test/fixtures";

import { SearchScreen } from "./search-screen";

describe("SearchScreen", () => {
  it("offers an empty box before anything is typed", () => {
    render(<SearchScreen query="" parsed={{ kind: "empty" }} results={[]} />);

    expect(screen.getByLabelText("ENTER POP NUMBER OR NAME")).toHaveValue("");
    expect(screen.getByRole("button", { name: "CHECK THE SHELF" })).toBeInTheDocument();
    expect(screen.queryByText("NOT IN THE CATALOG (YET)")).not.toBeInTheDocument();
  });

  it("keeps the query in the box so it can be edited", () => {
    render(
      <SearchScreen
        query="1450"
        parsed={{ kind: "number", popNumber: 1450, raw: "1450" }}
        results={[catalogResult({ slug: "a", popNumber: 1450, ownedCount: 1 })]}
      />,
    );

    expect(screen.getByLabelText("ENTER POP NUMBER OR NAME")).toHaveValue("1450");
  });

  it("stamps OWNED on a figure already on the shelf", () => {
    render(
      <SearchScreen
        query="1450"
        parsed={{ kind: "number", popNumber: 1450, raw: "1450" }}
        results={[
          catalogResult({
            slug: "pop-marvel-spider-man-last-stand-1450",
            name: "Spider-Man (Last Stand)",
            popNumber: 1450,
            ownedCount: 1,
            hasPublicPage: true,
          }),
        ]}
      />,
    );

    expect(screen.getByText("OWNED")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Spider-Man \(Last Stand\)/ })).toHaveAttribute(
      "href",
      "/figure/pop-marvel-spider-man-last-stand-1450",
    );
    expect(screen.getByText("1 MATCH · 1 ALREADY ON THE SHELF")).toBeInTheDocument();
  });

  it("stamps NOT OWNED YET with a gift idea on a figure he never had", () => {
    render(
      <SearchScreen
        query="334"
        parsed={{ kind: "number", popNumber: 334, raw: "334" }}
        results={[catalogResult()]}
      />,
    );

    expect(screen.getByText("NOT OWNED YET")).toBeInTheDocument();
    expect(screen.getByText("GIFT IDEA")).toBeInTheDocument();
    expect(screen.getByText("1 MATCH")).toBeInTheDocument();
  });

  it("footnotes a figure that was in the collection once", () => {
    render(
      <SearchScreen
        query="718"
        parsed={{ kind: "number", popNumber: 718, raw: "718" }}
        results={[
          catalogResult({
            slug: "pop-disney-lilo-stitch-hula-stitch-718",
            name: "Hula Stitch",
            popNumber: 718,
            category: "other",
            hadOnce: true,
            hasPublicPage: true,
          }),
        ]}
      />,
    );

    expect(screen.getByText("NOT OWNED")).toBeInTheDocument();
    expect(screen.getByText("was in the collection once")).toBeInTheDocument();
    expect(screen.queryByText("GIFT IDEA")).not.toBeInTheDocument();
  });

  it("shows every variant that shares a number, owned one first", () => {
    render(
      <SearchScreen
        query="3"
        parsed={{ kind: "number", popNumber: 3, raw: "3" }}
        results={[
          catalogResult({ slug: "chase", name: "Spider-Man (Chase)", popNumber: 3 }),
          catalogResult({ slug: "plain", name: "Spider-Man", popNumber: 3, ownedCount: 1 }),
        ]}
      />,
    );

    const names = screen.getAllByRole("heading", { level: 3 }).map((node) => node.textContent);
    expect(names).toEqual(["Spider-Man", "Spider-Man (Chase)"]);
    expect(screen.getByText("OWNED")).toBeInTheDocument();
    expect(screen.getByText("NOT OWNED YET")).toBeInTheDocument();
  });

  it("says so when nothing matched, without asking anyone to write to the owner", () => {
    render(<SearchScreen query="batman" parsed={{ kind: "text", text: "batman" }} results={[]} />);

    expect(screen.getByText("NOT IN THE CATALOG (YET)")).toBeInTheDocument();
    expect(screen.getByText(/Spider-Man lines/)).toBeInTheDocument();
    expect(screen.queryByText(/email/i)).not.toBeInTheDocument();
  });

  it("is a GET form, so the answer is a shareable URL", () => {
    const { container } = render(<SearchScreen query="" parsed={{ kind: "empty" }} results={[]} />);

    const form = container.querySelector("form");
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/search");
    expect(container.querySelector("input[name='q']")).toBeInTheDocument();
  });
});
