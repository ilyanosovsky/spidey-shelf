import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SightingFields } from "./sighting-fields";

/**
 * The three WHERE/WHEN fields, shared by Quick Add's details step and the edit form.
 *
 * Three things are worth a test here and the rest is markup: the country box round-trips a
 * stored code through a human-readable label, the city list narrows when the country changes
 * (the only reason this component holds state at all), and the date input is still a native
 * `<input type="date">` — because the moment it stops being one, the calendar sheet stops
 * opening on a phone and nobody would notice in jsdom.
 */

const CITIES = {
  IL: ["Haifa"],
  GE: ["Batumi", "Tbilisi"],
  US: ["LA"],
};

function options(listId: string, container: HTMLElement): string[] {
  return [...container.querySelectorAll(`#${listId} option`)].map(
    (option) => option.getAttribute("value") ?? "",
  );
}

describe("SightingFields", () => {
  it("shows a stored country code as a place the owner can read", () => {
    render(<SightingFields date="2026-08-07" city="Haifa" country="IL" citiesByCountry={CITIES} />);

    expect(screen.getByLabelText("COUNTRY")).toHaveValue("Israel (IL)");
    expect(screen.getByLabelText("CITY")).toHaveValue("Haifa");
  });

  it("keeps the DATE a native date input — that is what opens the calendar on a phone", () => {
    render(<SightingFields date="2026-08-07" city="" country="" citiesByCountry={CITIES} />);

    const date = screen.getByLabelText("DATE");
    expect(date).toHaveAttribute("type", "date");
    expect(date).toHaveValue("2026-08-07");
    expect(date).toBeRequired();
  });

  it("offers the whole ISO list, and the format the resolver round-trips", () => {
    const { container } = render(
      <SightingFields date="2026-08-07" city="" country="" citiesByCountry={CITIES} />,
    );

    const list = options("sighting-country-options", container);
    expect(list).toHaveLength(250);
    expect(list).toContain("Israel (IL)");
    expect(list).toContain("Georgia (GE)");
    expect(screen.getByLabelText("COUNTRY")).toHaveAttribute("list", "sighting-country-options");
  });

  it("narrows the city suggestions to the country in the box", () => {
    const { container } = render(
      <SightingFields date="2026-08-07" city="Haifa" country="IL" citiesByCountry={CITIES} />,
    );

    expect(options("sighting-city-options", container)).toEqual(["Haifa"]);

    fireEvent.change(screen.getByLabelText("COUNTRY"), { target: { value: "Georgia (GE)" } });
    expect(options("sighting-city-options", container)).toEqual(["Batumi", "Tbilisi"]);
  });

  it("accepts a bare code and a plain name too, not only the datalist's format", () => {
    const { container } = render(
      <SightingFields date="2026-08-07" city="" country="" citiesByCountry={CITIES} />,
    );

    fireEvent.change(screen.getByLabelText("COUNTRY"), { target: { value: "ge" } });
    expect(options("sighting-city-options", container)).toEqual(["Batumi", "Tbilisi"]);

    fireEvent.change(screen.getByLabelText("COUNTRY"), { target: { value: "Israel" } });
    expect(options("sighting-city-options", container)).toEqual(["Haifa"]);
  });

  it("offers nothing mid-typing rather than the previous country's cities", () => {
    const { container } = render(
      <SightingFields date="2026-08-07" city="" country="GE" citiesByCountry={CITIES} />,
    );

    fireEvent.change(screen.getByLabelText("COUNTRY"), { target: { value: "Portu" } });
    expect(options("sighting-city-options", container)).toEqual([]);
  });

  it("leaves CITY free text — a new city is the whole point of a travel log", () => {
    render(<SightingFields date="2026-08-07" city="" country="PT" citiesByCountry={CITIES} />);

    const city = screen.getByLabelText("CITY");
    expect(city).toHaveAttribute("type", "text");
    expect(city).not.toBeRequired();
  });

  it("posts under the names both server parsers already read", () => {
    const { container } = render(
      <SightingFields date="2026-08-07" city="Haifa" country="IL" citiesByCountry={CITIES} />,
    );

    expect(container.querySelector('input[name="acquiredAt"]')).not.toBeNull();
    expect(container.querySelector('input[name="acquiredCity"]')).not.toBeNull();
    expect(container.querySelector('input[name="acquiredCountry"]')).not.toBeNull();
  });

  it("goes inert while a save is in flight", () => {
    render(
      <SightingFields
        date="2026-08-07"
        city="Haifa"
        country="IL"
        citiesByCountry={CITIES}
        disabled
      />,
    );

    expect(screen.getByLabelText("DATE")).toBeDisabled();
    expect(screen.getByLabelText("CITY")).toBeDisabled();
    expect(screen.getByLabelText("COUNTRY")).toBeDisabled();
  });

  it("sizes the DATE box to its parent — iOS Safari ignores width:100% without this", () => {
    render(<SightingFields date="2026-08-07" city="" country="" citiesByCountry={CITIES} />);

    const date = screen.getByLabelText("DATE");
    expect(date.className).toContain("box-border");
    expect(date.className).toContain("min-w-0");
    expect(date.className).toContain("appearance-none");
  });
});
