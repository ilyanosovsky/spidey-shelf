import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { adminFigure, VARIANT_FIXTURE } from "@/test/fixtures";

import { ConfirmStep } from "./confirm-step";
import { DetailsStep } from "./details-step";
import { DoneStep } from "./done-step";
import { IdentifyStep } from "./identify-step";
import { NewFigureStep } from "./new-figure-step";

/**
 * Smoke tests for the five Quick Add frames.
 *
 * Every step is a pure function of its props (its server action arrives as one), so each
 * screen renders here with no session, no request and no database — the same arrangement the
 * public screens use.
 */

const noop = async () => {};

const REF = adminFigure().id;
const SIBLINGS = VARIANT_FIXTURE.filter((figure) => figure.id !== REF && figure.popNumber === 3);

describe("IdentifyStep", () => {
  it("offers an empty box and the escape hatch before anything is typed", () => {
    render(<IdentifyStep query="" parsed={{ kind: "empty" }} results={[]} errors={[]} />);

    expect(screen.getByLabelText("NUMBER OR NAME")).toHaveValue("");
    expect(screen.getByRole("button", { name: "SCAN THE CATALOG" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ADD AS NEW FIGURE/ })).toHaveAttribute(
      "href",
      "/admin/add?step=new",
    );
  });

  it("parks the Phase 7 scanner as a visibly dead button", () => {
    render(<IdentifyStep query="" parsed={{ kind: "empty" }} results={[]} errors={[]} />);

    const scan = screen.getByRole("button", { name: /SCAN — SOON/ });
    expect(scan).toBeDisabled();
    expect(scan).toHaveAttribute("aria-disabled", "true");
  });

  it("makes each result a tap straight into the confirm step", () => {
    render(
      <IdentifyStep
        query="3"
        parsed={{ kind: "number", popNumber: 3, raw: "3" }}
        results={[adminFigure()]}
        errors={[]}
      />,
    );

    expect(screen.getByRole("link", { name: /Spider-Man/ })).toHaveAttribute(
      "href",
      `/admin/add?step=confirm&ref=${REF}&q=3`,
    );
  });

  it("shows the admin-only flags a visitor never sees", () => {
    render(
      <IdentifyStep
        query="3"
        parsed={{ kind: "number", popNumber: 3, raw: "3" }}
        results={[adminFigure({ needsReview: true, ownedCount: 1 })]}
        errors={[]}
      />,
    );

    expect(screen.getByText("NEEDS REVIEW")).toBeInTheDocument();
    expect(screen.getByText("IN THE VAULT")).toBeInTheDocument();
  });

  it("still offers the new-figure path when nothing matched", () => {
    render(
      <IdentifyStep
        query="grogu"
        parsed={{ kind: "text", text: "grogu" }}
        results={[]}
        errors={[]}
      />,
    );

    expect(screen.getByText("NOTHING IN THE CATALOG MATCHES THAT.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ADD AS NEW FIGURE/ })).toHaveAttribute(
      "href",
      "/admin/add?step=new&q=grogu",
    );
  });

  it("spells out a code from the URL, and nothing else", () => {
    render(
      <IdentifyStep query="" parsed={{ kind: "empty" }} results={[]} errors={["FIGURE_GONE"]} />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("THAT FIGURE IS NO LONGER IN THE CATALOG");
  });
});

describe("NewFigureStep", () => {
  it("prefills the name when the owner searched words", () => {
    render(<NewFigureStep query="cosmic spidey" errors={[]} action={noop} />);

    expect(screen.getByLabelText("NAME")).toHaveValue("cosmic spidey");
    expect(screen.getByLabelText("POP NUMBER (OPTIONAL)")).toHaveValue("");
  });

  it("prefills the number when he searched a number", () => {
    render(<NewFigureStep query="1450" errors={[]} action={noop} />);

    expect(screen.getByLabelText("NAME")).toHaveValue("");
    expect(screen.getByLabelText("POP NUMBER (OPTIONAL)")).toHaveValue("1450");
  });

  it("offers the four buckets with PETER PARKER preselected", () => {
    render(<NewFigureStep query="" errors={[]} action={noop} />);

    expect(screen.getByLabelText("PETER PARKER")).toBeChecked();
    expect(screen.getByLabelText("SPIDER-VERSE")).not.toBeChecked();
    expect(screen.getByLabelText("FRIENDS & FOES")).toBeInTheDocument();
    expect(screen.getByLabelText("OTHER")).toBeInTheDocument();
  });
});

describe("ConfirmStep", () => {
  it("asks the one question, with the figure large", () => {
    render(
      <ConfirmStep
        figure={adminFigure()}
        siblings={[]}
        duplicate={null}
        query="3"
        errors={[]}
        duplicateAction={noop}
      />,
    );

    expect(screen.getByRole("heading", { name: "IS IT THIS ONE?" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CONFIRM — IT'S MINE" })).toHaveAttribute(
      "href",
      `/admin/add?step=details&ref=${REF}`,
    );
    expect(screen.getByRole("link", { name: "NOT THIS ONE" })).toHaveAttribute(
      "href",
      "/admin/add?q=3",
    );
  });

  it("offers the siblings as one-tap corrections", () => {
    render(
      <ConfirmStep
        figure={adminFigure()}
        siblings={SIBLINGS}
        duplicate={null}
        query=""
        errors={[]}
        duplicateAction={noop}
      />,
    );

    expect(screen.getByText("OR ONE OF THESE")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Spider-Man \(Metallic\)/ })).toHaveAttribute(
      "href",
      `/admin/add?step=confirm&ref=${SIBLINGS[0].id}`,
    );
  });

  it("warns and swaps the primary button when the figure is already in the vault", () => {
    render(
      <ConfirmStep
        figure={adminFigure({ ownedCount: 1 })}
        siblings={[]}
        duplicate={{ targetId: "owned-1", since: "2025-04-12", quantity: 1 }}
        query=""
        errors={[]}
        duplicateAction={noop}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("ALREADY IN THE VAULT (SINCE APR 2025)");
    expect(screen.getByRole("button", { name: "ADD DUPLICATE (+1)" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "CONFIRM — IT'S MINE" })).not.toBeInTheDocument();
  });
});

describe("DetailsStep", () => {
  const defaults = {
    acquiredAt: "2026-08-06",
    acquiredCity: "Moscow",
    acquiredCountry: "RU",
    status: "mine" as const,
  };

  it("comes pre-filled with today and the last place", () => {
    render(<DetailsStep figure={adminFigure()} defaults={defaults} errors={[]} action={noop} />);

    expect(screen.getByLabelText("DATE")).toHaveValue("2026-08-06");
    expect(screen.getByLabelText("CITY")).toHaveValue("Moscow");
    expect(screen.getByLabelText("COUNTRY")).toHaveValue("RU");
    expect(screen.getByLabelText("MINE")).toBeChecked();
  });

  it("offers both submits, with SAVE first so a stray Enter never skips the story", () => {
    render(<DetailsStep figure={adminFigure()} defaults={defaults} errors={[]} action={noop} />);

    const submits = screen.getAllByRole("button");
    expect(submits[0]).toHaveTextContent("SAVE THE SIGHTING");
    expect(submits[0]).toHaveAttribute("value", "save");
    expect(submits[1]).toHaveTextContent("SKIP FOR NOW");
    expect(submits[1]).toHaveAttribute("value", "skip");
  });

  it("keeps the chosen figure out of the visible form", () => {
    const { container } = render(
      <DetailsStep figure={adminFigure()} defaults={defaults} errors={[]} action={noop} />,
    );

    expect(container.querySelector('input[name="referenceFigureId"]')).toHaveValue(REF);
  });
});

describe("DoneStep", () => {
  const stats = { mine: 16, total: 20, peterOwned: 12, peterTotal: 120 };

  it("celebrates, shows the fresh counter and offers the next figure", () => {
    render(
      <DoneStep
        figure={adminFigure()}
        ownedId="owned-1"
        acquiredAt="2026-08-06"
        place="🇷🇺 MOSCOW"
        needsStory={false}
        slug="pop-marvel-spider-man-3"
        duplicateQuantity={null}
        stats={stats}
      />,
    );

    expect(screen.getByRole("heading", { name: "SIGHTING CONFIRMED!" })).toBeInTheDocument();
    expect(screen.getByText("12 / 120")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ADD ANOTHER" })).toHaveAttribute("href", "/admin/add");
    expect(screen.getByRole("link", { name: "VIEW IT" })).toHaveAttribute(
      "href",
      "/figure/pop-marvel-spider-man-3",
    );
  });

  it("only offers WRITE THE STORY when one is owed", () => {
    render(
      <DoneStep
        figure={adminFigure()}
        ownedId="owned-1"
        acquiredAt="2026-08-06"
        place="🇷🇺 MOSCOW"
        needsStory={false}
        slug="pop-marvel-spider-man-3"
        duplicateQuantity={null}
        stats={stats}
      />,
    );

    expect(screen.queryByRole("link", { name: "WRITE THE STORY" })).not.toBeInTheDocument();
  });

  it("links a skipped story straight to the edit form", () => {
    render(
      <DoneStep
        figure={adminFigure()}
        ownedId="owned-1"
        acquiredAt="2026-08-06"
        place="🇷🇺 MOSCOW"
        needsStory
        slug="pop-marvel-spider-man-3"
        duplicateQuantity={null}
        stats={stats}
      />,
    );

    expect(screen.getByRole("link", { name: "WRITE THE STORY" })).toHaveAttribute(
      "href",
      "/admin/collection/owned-1/edit",
    );
  });

  it("says what happened when a duplicate was bumped instead of inserted", () => {
    render(
      <DoneStep
        figure={adminFigure()}
        ownedId="owned-1"
        acquiredAt="2025-04-12"
        place="🇺🇸 LA"
        needsStory={false}
        slug="pop-marvel-spider-man-3"
        duplicateQuantity={2}
        stats={stats}
      />,
    );

    expect(screen.getByText(/QUANTITY IS NOW 2/)).toBeInTheDocument();
  });

  it("hides VIEW IT for a row that is not on the public shelf", () => {
    render(
      <DoneStep
        figure={adminFigure()}
        ownedId="owned-1"
        acquiredAt="2026-08-06"
        place="🇷🇺 MOSCOW"
        needsStory={false}
        slug={null}
        duplicateQuantity={null}
        stats={stats}
      />,
    );

    expect(screen.queryByRole("link", { name: "VIEW IT" })).not.toBeInTheDocument();
  });
});
