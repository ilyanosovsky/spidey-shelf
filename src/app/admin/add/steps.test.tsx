import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BOX_ART_COPY } from "@/lib/box-art";
import { adminFigure, VARIANT_FIXTURE } from "@/test/fixtures";

import { ConfirmStep } from "./confirm-step";
import { DetailsStep } from "./details-step";
import { DoneStep } from "./done-step";
import { FixStep } from "./fix-step";
import { IdentifyStep } from "./identify-step";
import { NewFigureStep } from "./new-figure-step";
import { ScanFailedStep, ScanResultStep } from "./scan-result-step";

/**
 * Smoke tests for the Quick Add frames.
 *
 * Every step is a pure function of its props (its server action arrives as one), so each
 * screen renders here with no session, no request and no database — the same arrangement the
 * public screens use. Phase 7 added one exception and it is deliberately narrow: step 1's
 * SCAN button is a client component, and the camera behind it is not imported until it is
 * pressed.
 */

const noop = async () => {};

/**
 * Phase 14 put the BOX ART panel on the details step, and it is a client component with two
 * things a test cannot have: an app router and an UploadThing endpoint. Both are replaced by
 * the smallest stand-in that lets the panel render — its behaviour is tested where it lives,
 * in `../box-art-panel.test.tsx`; here it only has to be present and out of the form's way.
 */
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/lib/uploadthing", () => ({
  useUploadThing: () => ({ startUpload: vi.fn(), isUploading: false, routeConfig: undefined }),
}));

const REF = adminFigure().id;
const SIBLINGS = VARIANT_FIXTURE.filter((figure) => figure.id !== REF && figure.popNumber === 3);

/** The Phase 7 research fixture: a real Funko Spider-Man barcode, in its stored form. */
const UPC = "0889698636759";

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

  it("offers the camera as a live button now that Phase 7 has landed", () => {
    render(<IdentifyStep query="" parsed={{ kind: "empty" }} results={[]} errors={[]} />);

    const scan = screen.getByRole("button", { name: /SCAN THE BOX/ });
    expect(scan).toBeEnabled();
    // The overlay is behind a dynamic import: nothing camera-shaped is in the first paint.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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

  it("offers the six buckets with PETER PARKER preselected", () => {
    render(<NewFigureStep query="" errors={[]} action={noop} />);

    expect(screen.getByLabelText("PETER PARKER")).toBeChecked();
    expect(screen.getByLabelText("SPIDER-VERSE")).not.toBeChecked();
    expect(screen.getByLabelText("FRIENDS & FOES")).toBeInTheDocument();
    expect(screen.getByLabelText("STITCH")).toBeInTheDocument();
    expect(screen.getByLabelText("GROGU")).toBeInTheDocument();
    expect(screen.getByLabelText("OTHER")).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(6);
  });

  it("takes a scan's name AND number, which no single ?q= could carry", () => {
    render(
      <NewFigureStep
        query="Spider-Man Last Stand"
        prefill={{ name: "Spider-Man Last Stand", popNumber: "1450" }}
        upc={UPC}
        notice="BARCODE NOT FOUND. TYPE THE NUMBER?"
        errors={[]}
        action={noop}
      />,
    );

    expect(screen.getByLabelText("NAME")).toHaveValue("Spider-Man Last Stand");
    expect(screen.getByLabelText("POP NUMBER (OPTIONAL)")).toHaveValue("1450");
    expect(screen.getByRole("status")).toHaveTextContent("BARCODE NOT FOUND");
  });

  it("carries the scanned barcode into the insert", () => {
    const { container } = render(<NewFigureStep query="" upc={UPC} errors={[]} action={noop} />);

    expect(container.querySelector('input[name="upc"]')).toHaveValue(UPC);
  });

  it("has no barcode field at all when the figure was typed", () => {
    const { container } = render(<NewFigureStep query="grogu" errors={[]} action={noop} />);

    expect(container.querySelector('input[name="upc"]')).toBeNull();
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

  it("says MATCHED BY BARCODE only when the catalog itself knew the code", () => {
    const { rerender } = render(
      <ConfirmStep
        figure={adminFigure()}
        siblings={[]}
        duplicate={null}
        query=""
        upc={UPC}
        matchedByBarcode
        errors={[]}
        duplicateAction={noop}
      />,
    );

    expect(screen.getByText(/MATCHED BY BARCODE/)).toBeInTheDocument();
    expect(screen.getByText(/8 89698 63675 9/)).toBeInTheDocument();

    rerender(
      <ConfirmStep
        figure={adminFigure()}
        siblings={[]}
        duplicate={null}
        query=""
        upc={UPC}
        errors={[]}
        duplicateAction={noop}
      />,
    );

    // A guess out of a product title is not a match, and must not claim to be one.
    expect(screen.queryByText(/MATCHED BY BARCODE/)).not.toBeInTheDocument();
    expect(screen.getByText(/8 89698 63675 9/)).toBeInTheDocument();
  });

  it("carries the barcode into the details step and into every sibling", () => {
    render(
      <ConfirmStep
        figure={adminFigure()}
        siblings={SIBLINGS}
        duplicate={null}
        query=""
        upc={UPC}
        errors={[]}
        duplicateAction={noop}
      />,
    );

    expect(screen.getByRole("link", { name: "CONFIRM — IT'S MINE" })).toHaveAttribute(
      "href",
      `/admin/add?step=details&ref=${REF}&upc=${UPC}`,
    );
    expect(screen.getByRole("link", { name: /Spider-Man \(Metallic\)/ })).toHaveAttribute(
      "href",
      `/admin/add?step=confirm&ref=${SIBLINGS[0].id}&upc=${UPC}`,
    );
  });

  it("carries the barcode through the duplicate bump too", () => {
    const { container } = render(
      <ConfirmStep
        figure={adminFigure({ ownedCount: 1 })}
        siblings={[]}
        duplicate={{ targetId: "owned-1", since: "2025-04-12", quantity: 1 }}
        query=""
        upc={UPC}
        errors={[]}
        duplicateAction={noop}
      />,
    );

    expect(container.querySelector('form input[name="upc"]')).toHaveValue(UPC);
  });

  it("offers the escape hatch for a row whose data is wrong (Phase 12)", () => {
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

    expect(screen.getByRole("link", { name: "WRONG DATA? FIX THIS FIGURE" })).toHaveAttribute(
      "href",
      `/admin/add?step=fix&ref=${REF}&q=3`,
    );
  });

  it("carries the barcode into the fix detour, so a correction costs no backfill", () => {
    render(
      <ConfirmStep
        figure={adminFigure()}
        siblings={[]}
        duplicate={null}
        query="3"
        upc={UPC}
        matchedByBarcode
        errors={[]}
        duplicateAction={noop}
      />,
    );

    expect(screen.getByRole("link", { name: "WRONG DATA? FIX THIS FIGURE" })).toHaveAttribute(
      "href",
      `/admin/add?step=fix&ref=${REF}&q=3&upc=${UPC}&via=barcode`,
    );
  });
});

describe("DetailsStep", () => {
  const defaults = {
    acquiredAt: "2026-08-06",
    acquiredCity: "Moscow",
    acquiredCountry: "RU",
    status: "mine" as const,
  };

  const cities = { RU: ["Moscow"], GE: ["Batumi", "Tbilisi"] };

  it("comes pre-filled with today and the last place", () => {
    render(
      <DetailsStep
        figure={adminFigure()}
        defaults={defaults}
        citiesByCountry={cities}
        errors={[]}
        action={noop}
      />,
    );

    expect(screen.getByLabelText("DATE")).toHaveValue("2026-08-06");
    expect(screen.getByLabelText("CITY")).toHaveValue("Moscow");
    // The stored code is shown as the datalist's own format, which round-trips back to `RU`.
    expect(screen.getByLabelText("COUNTRY")).toHaveValue("Russia (RU)");
    expect(screen.getByLabelText("MINE")).toBeChecked();
  });

  it("offers three statuses, VERONIKA'S spanning the row on a phone", () => {
    render(
      <DetailsStep
        figure={adminFigure()}
        defaults={defaults}
        citiesByCountry={cities}
        errors={[]}
        action={noop}
      />,
    );

    const radios = screen.getAllByRole("radio");
    expect(radios.map((radio) => radio.getAttribute("value"))).toEqual([
      "mine",
      "not_mine_anymore",
      "veronika",
    ]);
    expect(screen.getByLabelText("NOT MINE ANYMORE")).not.toBeChecked();
    // Three columns cannot hold VERONIKA'S in the pixel font at 375px.
    const hers = screen.getByLabelText("VERONIKA'S").closest("label");
    expect(hers).toHaveClass("col-span-2", "sm:col-span-1", "min-h-11");
  });

  it("preselects VERONIKA'S when the defaults say so", () => {
    render(
      <DetailsStep
        figure={adminFigure({ category: "stitch" })}
        defaults={{ ...defaults, status: "veronika" }}
        citiesByCountry={cities}
        errors={[]}
        action={noop}
      />,
    );

    expect(screen.getByLabelText("VERONIKA'S")).toBeChecked();
    expect(screen.getByLabelText("MINE")).not.toBeChecked();
  });

  it("offers both submits, with SAVE first so a stray Enter never skips the story", () => {
    render(
      <DetailsStep
        figure={adminFigure()}
        defaults={defaults}
        citiesByCountry={cities}
        errors={[]}
        action={noop}
      />,
    );

    // Scoped to the form: the BOX ART button above it is not a submit and not inside it.
    const form = screen.getByRole("button", { name: "SAVE THE SIGHTING" }).closest("form");
    const submits = within(form as HTMLFormElement).getAllByRole("button");
    expect(submits).toHaveLength(2);
    expect(submits[0]).toHaveTextContent("SAVE THE SIGHTING");
    expect(submits[0]).toHaveAttribute("value", "save");
    expect(submits[1]).toHaveTextContent("SKIP FOR NOW");
    expect(submits[1]).toHaveAttribute("value", "skip");
  });

  it("offers the box art upload right here, outside the form and without a second picture", () => {
    const { container } = render(
      <DetailsStep
        figure={adminFigure()}
        defaults={defaults}
        citiesByCountry={cities}
        errors={[]}
        action={noop}
      />,
    );

    const upload = screen.getByRole("button", { name: BOX_ART_COPY.upload });
    // A plain button outside the form: pressing it must never submit the sighting, and a
    // stray Enter in the city field must still reach SAVE first.
    expect(upload).toHaveAttribute("type", "button");
    expect(upload.closest("form")).toBeNull();
    expect(container.querySelector('input[type="file"]')?.closest("form")).toBeNull();

    // The summary above is the only picture — the panel does not draw a second one.
    expect(container.querySelectorAll(".aspect-square")).toHaveLength(1);
  });

  it("says REPLACE when the catalog row already has its picture", () => {
    render(
      <DetailsStep
        figure={adminFigure({ imagePath: "https://si4zn51deh.ufs.sh/f/key_spider-man-800.webp" })}
        defaults={defaults}
        citiesByCountry={cities}
        errors={[]}
        action={noop}
      />,
    );

    expect(screen.getByRole("button", { name: BOX_ART_COPY.replace })).toBeInTheDocument();
  });

  it("keeps the chosen figure out of the visible form", () => {
    const { container } = render(
      <DetailsStep
        figure={adminFigure()}
        defaults={defaults}
        citiesByCountry={cities}
        errors={[]}
        action={noop}
      />,
    );

    expect(container.querySelector('input[name="referenceFigureId"]')).toHaveValue(REF);
    // No scan, no field — the backfill is a no-op it never has to reason about.
    expect(container.querySelector('input[name="upc"]')).toBeNull();
  });

  it("hands the scanned barcode to the save, which is where the catalog learns it", () => {
    const { container } = render(
      <DetailsStep
        figure={adminFigure()}
        defaults={defaults}
        citiesByCountry={cities}
        upc={UPC}
        errors={[]}
        action={noop}
      />,
    );

    expect(container.querySelector('input[name="upc"]')).toHaveValue(UPC);
  });
});

describe("ScanResultStep", () => {
  it("shows the code, what the lookup called it, and asks rather than decides", () => {
    render(
      <ScanResultStep
        upc={UPC}
        notice="BARCODE FOUND — PICK THE VARIANT."
        parsedTitle="Spider-Man Last Stand"
        candidates={[adminFigure()]}
      />,
    );

    expect(screen.getByText("8 89698 63675 9")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("BARCODE FOUND");
    expect(screen.getByText("Spider-Man Last Stand")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "IS IT ONE OF THESE?" })).toBeInTheDocument();
  });

  it("marks every candidate as a guess, not a barcode match", () => {
    render(
      <ScanResultStep
        upc={UPC}
        notice="BARCODE FOUND — PICK THE VARIANT."
        parsedTitle="Spider-Man"
        candidates={[adminFigure()]}
      />,
    );

    expect(screen.getByRole("link", { name: /Spider-Man/ })).toHaveAttribute(
      "href",
      `/admin/add?step=confirm&ref=${REF}&upc=${UPC}&via=lookup`,
    );
  });

  it("keeps the escape hatches, both of them, carrying the barcode", () => {
    render(
      <ScanResultStep upc={UPC} notice="BARCODE FOUND." parsedTitle="Venom" candidates={[]} />,
    );

    expect(screen.getByRole("link", { name: /ADD AS NEW FIGURE/ })).toHaveAttribute(
      "href",
      `/admin/add?step=new&upc=${UPC}&q=Venom`,
    );
    expect(screen.getByRole("link", { name: "TYPE INSTEAD" })).toHaveAttribute(
      "href",
      "/admin/add",
    );
  });
});

describe("ScanFailedStep", () => {
  it("explains a checksum failure instead of pretending it scanned nothing", () => {
    render(<ScanFailedStep notice="THAT BARCODE DOES NOT CHECK OUT. TYPE THE NUMBER?" />);

    expect(screen.getByRole("alert")).toHaveTextContent("THAT BARCODE DOES NOT CHECK OUT");
    expect(screen.getByRole("link", { name: "TYPE INSTEAD" })).toHaveAttribute(
      "href",
      "/admin/add",
    );
  });
});

describe("DoneStep", () => {
  const stats = { onShelf: 16, total: 20, peterOwned: 12, peterTotal: 120 };

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

describe("the step rail", () => {
  /** The three cells, in DOM order, off whichever frame rendered them. */
  function railCells(container: HTMLElement): HTMLElement[] {
    const rail = container.querySelector('ol[aria-label="Quick add progress"]');
    return [...(rail?.querySelectorAll("li") ?? [])] as HTMLElement[];
  }

  it("is three strictly equal columns — `auto` is what let one chip outgrow the others", () => {
    const { container } = render(
      <ConfirmStep
        figure={adminFigure()}
        siblings={[]}
        duplicate={null}
        query=""
        errors={[]}
        duplicateAction={noop}
      />,
    );

    const rail = container.querySelector('ol[aria-label="Quick add progress"]');
    expect(rail?.className).toContain("grid-cols-[repeat(3,minmax(0,1fr))]");
    expect(railCells(container)).toHaveLength(3);
  });

  it("keeps every label on one line, at the 10px pixel-font floor", () => {
    const { container } = render(
      <ConfirmStep
        figure={adminFigure()}
        siblings={[]}
        duplicate={null}
        query=""
        errors={[]}
        duplicateAction={noop}
      />,
    );

    for (const cell of railCells(container)) {
      expect(cell.className).toContain("whitespace-nowrap");
      expect(cell.className).toContain("overflow-hidden");
      expect(cell.className).toContain("min-w-0");
      expect(cell.className).toContain("text-[10px]");
      // The number is its own row above the word — that is what makes DETAILS fit at 375px.
      expect(cell.querySelectorAll("span")).toHaveLength(2);
    }
  });

  it("reads 1 FIND · 2 CONFIRM · 3 DETAILS, and lights exactly one", () => {
    const { container } = render(
      <ConfirmStep
        figure={adminFigure()}
        siblings={[]}
        duplicate={null}
        query=""
        errors={[]}
        duplicateAction={noop}
      />,
    );

    expect(railCells(container).map((cell) => cell.textContent)).toEqual([
      "1FIND",
      "2CONFIRM",
      "3DETAILS",
    ]);
    const current = railCells(container).filter((cell) => cell.getAttribute("aria-current"));
    expect(current).toHaveLength(1);
    expect(current[0].textContent).toBe("2CONFIRM");
  });

  it("does not move when the FIX detour is open — a correction is part of confirming", () => {
    const { container } = render(
      <FixStep figure={adminFigure()} query="" errors={[]} action={noop} />,
    );

    const current = railCells(container).filter((cell) => cell.getAttribute("aria-current"));
    expect(current[0].textContent).toBe("2CONFIRM");
  });
});

describe("FixStep", () => {
  it("comes prefilled with the row it is about to correct", () => {
    render(<FixStep figure={adminFigure()} query="3" errors={[]} action={noop} />);

    expect(screen.getByLabelText("NAME")).toHaveValue(adminFigure().name);
    expect(screen.getByLabelText("POP NUMBER (OPTIONAL)")).toHaveValue("3");
    expect(screen.getByLabelText("PRODUCT LINE (OPTIONAL)")).toHaveValue(
      adminFigure().productLine ?? "",
    );
    expect(screen.getByLabelText("PETER PARKER")).toBeChecked();
  });

  it("leaves the number blank rather than writing `null` into the box", () => {
    render(
      <FixStep figure={adminFigure({ popNumber: null })} query="" errors={[]} action={noop} />,
    );

    expect(screen.getByLabelText("POP NUMBER (OPTIONAL)")).toHaveValue("");
  });

  it("carries the whole context back to the same confirm screen", () => {
    const { container } = render(
      <FixStep
        figure={adminFigure()}
        query="3"
        upc={UPC}
        via="barcode"
        errors={[]}
        action={noop}
      />,
    );

    expect(screen.getByRole("link", { name: "BACK" })).toHaveAttribute(
      "href",
      `/admin/add?step=confirm&ref=${REF}&q=3&upc=${UPC}&via=barcode`,
    );
    expect(container.querySelector('form input[name="referenceFigureId"]')).toHaveValue(REF);
    expect(container.querySelector('form input[name="upc"]')).toHaveValue(UPC);
    expect(container.querySelector('form input[name="via"]')).toHaveValue("barcode");
    expect(container.querySelector('form input[name="q"]')).toHaveValue("3");
  });

  it("offers no barcode field when the add did not start at the camera", () => {
    const { container } = render(
      <FixStep figure={adminFigure()} query="" errors={[]} action={noop} />,
    );

    expect(container.querySelector('form input[name="upc"]')).toBeNull();
    expect(container.querySelector('form input[name="via"]')).toBeNull();
  });

  it("never offers to edit the slug — it is the natural key", () => {
    const { container } = render(
      <FixStep figure={adminFigure()} query="" errors={[]} action={noop} />,
    );

    expect(container.querySelector('[name="slug"]')).toBeNull();
    expect(container.querySelector('[name="needsReview"]')).toBeNull();
  });

  it("spells out what the last submit refused", () => {
    render(<FixStep figure={adminFigure()} query="" errors={["BAD_NUMBER"]} action={noop} />);

    expect(screen.getByRole("alert")).toHaveTextContent("POP NUMBER MUST BE DIGITS ONLY");
  });
});
